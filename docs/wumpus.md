# Embodied Wumpus domain

`src/wumpus/index.js` exposes an immutable, serializable Wumpus world and an inspectable agent policy.

```js
import { createWorld, perceive, stepWorld, createPolicy } from './src/wumpus/index.js';

let world = createWorld({ seed: 7, size: 4 });
const policy = createPolicy();
policy.observe(perceive(world));
const action = policy.chooseAction();
policy.recordAction(action);
world = stepWorld(world, action);
console.log(policy.inspect());
```

World coordinates are one-based: `(1,1)` is the southwest start and east is the initial heading. `stepWorld` returns a fresh snapshot. Actions are `forward`, `turnLeft`, `turnRight`, `grab`, `shoot`, and `climb`; lower-case aliases such as `left` are accepted. A shot costs 10 total points, ordinary actions cost 1, dying costs 1000, and climbing from start with gold adds 1000.

`perceive(world)` exposes `{ stench, breeze, glitter, bump, scream }` (plus terminal status). Stench includes the Wumpus's cell and its cardinal neighbors, including after death. Breeze comes from adjacent pits.

`createPolicy({ pitPrior: .2 })` never receives the hidden world. Call `observe` for the initial percept, `recordAction(action)` after every action, then `observe` after its resulting step. `chooseAction()` only proposes an action; it does not change tracked pose. `inspect()` returns the current pose, percept history, candidate cells, finite pit hypotheses, posterior mass, and the observations that conditioned those beliefs. Hypotheses are capped to the 15 non-start cells of a 4×4 world (32,768 states).

World files use the WSU simulator format:

```text
size 4
wumpus 4 4
gold 3 3
pit 3 1
```

Use `parseWorld(text)` or `loadWorld(path)` to obtain the initial world snapshot.

## Upstream simulator oracle check

On 2026-09-05, the upstream WSU simulator was downloaded from the source named in this project, compiled with its `make` target, and run against its supplied `testworld.txt`. The scripted actions `forward, left, forward, forward, grab, left, shoot, forward, left, forward, forward, climb` produced score series `0, -1, -2, -3, -4, -5, -6, -16, -17, -18, -19, -20, 979`; the five percept flags matched after every action, including the shot scream. The same fixture and action script were then run through this implementation with the identical score series and percept sequence.
