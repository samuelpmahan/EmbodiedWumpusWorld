# Belief debugger and advisor

`analyzeBelief(frame, { pitPrior })` reconstructs a report from the public
policy snapshot in a session frame.  It does not read `frame.world`, so the
same recorded policy observations produce the same report even when the
underlying world differs.

```js
const report = analyzeBelief(frame, { pitPrior: 0.2 });
```

The report contains finite Bayesian pit probabilities plus `remaining` pit
hypotheses, the recorded observations and their resulting constraints.  It
also reports a location distribution for one stationary Wumpus.  Wumpus
locations are uniformly weighted across cells compatible with all recorded
stench observations and survived locations.  A scream marks it dead; its
location evidence remains visible, while its live danger is zero.  Stench is
expected on the Wumpus cell and cardinal neighbours even after death.

Conflicting observations throw an error rather than returning an invented
posterior.  The `assumptions` field makes the finite-board, independent-pit,
and uniform-compatible-Wumpus assumptions explicit.

`advise(frame, report, { riskTolerance: 0.25 })` proposes one action without
executing it:

```js
const proposal = advise(frame, report);
// session.act(proposal.action) remains a human-controlled choice.
```

Each candidate reports separate pit and Wumpus risks.  Its `risk` is the
conservative union upper bound `min(1, pitRisk + wumpusRisk)`, not a claim
that the hazards are independent or that the value is an exact probability.
The advisor uses BFS across recorded visited cells to reach low-risk frontier
cells, grabs on glitter, and returns home after recorded gold acquisition.
