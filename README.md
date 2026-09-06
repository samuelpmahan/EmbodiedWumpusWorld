# Embodied Wumpus World LAB

**PxC: the things computation can work with, and what those things are made of.**

A dependency-free JavaScript LAB with human play, policy watching, recorded inspection,
and a small executable demonstration of how priors change beliefs.

Requires Node.js 22 or newer. No install/build step.

```sh
node src/cli.js play
node src/cli.js watch --seed 1
node src/cli.js demo --inspect
node src/cli.js priors --prior 0.2 --compare 0.5
npm test
```

In a terminal: `f` forward, `l/r` turn, `g` grab, `s` shoot, `c` climb;
`n` policy step, space run/pause, `+/-` speed, `v` spectator reveal,
`i` belief/Tick inspection, `[/]` recorded history, `q` quit.
Watch starts paused. Human actions are accepted at the live end of history.

The same `materialize()` function produces the interactive terminal and printable
debug output. Noninteractive play/watch prints the initial frame; `demo` runs up
to 12 policy actions (change with `--steps`).

## Priors you can deconstruct

`priors` puts a prior, neighborhood, observation, hypotheses and conditioned
distribution into PxC. It calls registered calculations through recorded Ticks.
With two independent adjacent pit probabilities of 0.2, a perfect breeze
observation leaves A-only/B-only/both with weights 4/9, 4/9, 1/9.
Changing the prior to 0.5 changes the marginal risk at A from 55.56% to 66.67%.
Both runs hold the observation fixed.

The reusable conditioning and marginalization functions also power the game's
pit belief model. The bundled policy is a small pit-risk explorer with a return
route after collecting gold. It does not yet infer Wumpus locations or optimize
expected utility; its decisions can lose. Terminal belief inspection retains
the last live belief instead of treating death as a survived cell.

## Bring a policy

```js
export function createPolicy() {
  return {
    observe(percept) {},
    recordAction(action) {},
    chooseAction() { return 'climb'; },
    inspect() { return { note: 'Leave immediately' }; },
  };
}
```

```sh
node src/cli.js watch --policy ./my-policy.js --save run.json
node src/cli.js replay run.json
node src/cli.js play --world fixtures/demo.wumpus
```

Policies receive percepts and their own actions, not world objects. Imported
JavaScript is trusted local code, not a security sandbox. Replays store world
truth for optional spectator reveal; keep that separate from blind policy input.
Replay browsing never calls the policy. Policy failures stop execution visibly.

## Reusable LAB and provenance

- `src/core`: PxC address space, registered functions, transactional Tick records,
  finite probability math and geometry/set atoms.
- `src/wumpus`: world rules, percepts, pit hypotheses and a policy instance.
- `src/session.js`: world/policy execution and recorded frames.
- `src/tui/materialize.js`: read-only presentation shared by CLI and TUI.
- `src/priors.js`: the first deconstructable inference composition.

The core adapts ChainSpot's existing `exec/board.ts` interfaces and execution
concepts from the supplied Sweep-Ready bundle (packaged checkpoint
`60f53cd9ae8ab210dc73aa884086e315dccbe0a2`). This is a first extraction into a
standalone domain consumer; ChainSpot itself has not been migrated to depend on
this package. A ChainSpot-shaped fixture tests the same core with component
materials. Existing Storybook molecules remain in ChainSpot.

Wumpus semantics follow Larry Holder's MIT-licensed WSU simulator:
https://gitlab.eecs.wsu.edu/42898/wumpus-world-simulator
See `docs/wumpus.md` for model details and validation limits. The seeded JS
generator is reproducible but does not reproduce C `rand()` seed sequences.

Next composition seams: expose the full world perception DAG as separate
materials, make policy atom selections editable, add Wumpus constraints, and
migrate a real ChainSpot producer onto the shared package. The current policy
is stateful outside PxC; Tick rollback protects PxC writes, not arbitrary state
inside a third-party policy.

### A return to Wumpus

The browser opens in **Remember Wumpus**, with a practice cave and a short learning sequence. Move forward once to encounter a breeze; select a square to open its recorded pit evidence. **Play & reason** and **Inspect the machinery** offer alternative panel presets. Each slot can show any panel; selecting a panel already visible swaps the two. Choices persist in this browser. Narrow screens use three slot tabs; panels scroll internally within the viewport.

The prior slider is a separate two-neighbor experiment, with a fixed breeze observation. Starting priors for the actual game live under Run settings. Cell explanations use only the policy's recorded observations and beliefs. Zero pit risk does not establish safety from a Wumpus.

### Belief debugger

Choose **Belief debugger** in the workspace selector. The reasoning explorer combines pit and Wumpus inference, shows candidate danger bounds, and routes through visited cells. Its maximum danger bound is a Run argument; the original pit explorer remains selectable.

- **Alternate prior & branches:** recompute this frame from the same observations, compare selected-square probabilities, then fork the same cave/history to try a different future. Switch branches without destroying the original.
- **Map:** show pit probabilities, Wumpus location probabilities, or alternate-prior percentage-point changes. Reveal is still observer-only.
- **PxC material lineage:** follow a decision through named calculations to captured assumptions and agent knowledge. Constraint evaluations read their materials and basis through PxC and report satisfied, violated, or unknown.
- Reasoning decisions and their investigation receipts accompany their action in exported replays. Large hypothesis arrays are omitted from investigation receipts; exact counts and marginals remain.

The investigation uses a separate PxC containing no hidden world. It recomputes finite Bayesian pits and uniform compatible stationary Wumpus locations. A scream removes live danger but preserves the location distribution. The danger bound is `min(1, pit + live Wumpus)`, not an independence formula. The advisor does not plan shots or maximize expected score. Branch reconstruction supports the built-in tracker; arbitrary custom policies need their own reconstruction factory.

Reusable core APIs, independent of Wumpus: [`evaluateConstraint`](docs/constraints.md), `traceAddress`, `createPxC`, and `executeTick`. See [belief debugger semantics](docs/belief-debugger.md).

### Deterministic teaching experiments

The [bounded learner pilot](experiments/teaching/README.md) compiles five Wumpus concepts into exact probability lessons, tests transfer with Luna/Terra learners, and grades semantic assignments separately from arithmetic. Run `node experiments/teaching/report.js` to reproduce the saved grades without model calls.
