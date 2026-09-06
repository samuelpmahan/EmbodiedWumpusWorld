import test from 'node:test';
import assert from 'node:assert/strict';
import { createPolicy } from '../src/wumpus/policy.js';
import { analyzeBelief } from '../src/wumpus/analysis.js';

function frame(policy, world = { pits: [{ x: 4, y: 4 }], wumpus: { x: 4, y: 4 } }) { return { policy: policy.inspect(), world }; }

test('analysis only uses policy information and recomputes alternate pit priors', () => {
  const policy = createPolicy({ width: 3, height: 2, pitPrior: 0.2 });
  policy.observe({ breeze: true, stench: false });
  const a = analyzeBelief(frame(policy));
  const b = analyzeBelief(frame(policy, { pits: [], wumpus: { x: 2, y: 2 } }), { pitPrior: 0.5 });
  assert.equal(a.pitPrior, 0.2);
  assert.equal(b.pitPrior, 0.5);
  assert.notEqual(a.pitProbabilities['2,1'], b.pitProbabilities['2,1']);
  assert.deepEqual(a.pitProbabilities, analyzeBelief({ policy: policy.inspect(), world: { pits: [{ x: 99, y: 99 }] } }).pitProbabilities);
  assert.equal(typeof a.remaining, 'number');
});

test('Wumpus stench, survival, and scream preserve location evidence but zero live danger', () => {
  const policy = createPolicy({ width: 3, height: 2 });
  policy.observe({ breeze: false, stench: true });
  let report = analyzeBelief(frame(policy));
  assert.deepEqual(report.wumpusCandidates.sort(), [[2, 1], [1, 2]].sort());
  policy.recordAction('shoot'); policy.observe({ breeze: false, stench: true, scream: true });
  report = analyzeBelief(frame(policy));
  assert.equal(report.wumpusAlive, false);
  assert.ok(Object.values(report.wumpusProbabilities).every((value) => value === 0));
  assert.ok(Object.values(report.wumpusLocationProbabilities).some((value) => value > 0));
});

test('contradictory recorded percepts report a clear error', () => {
  const policy = { location: [1, 1], heading: 0, belief: { width: 2, height: 2, start: [1, 1], pitPrior: .2 }, provenance: [
    { type: 'observe', location: [1, 1], percept: { breeze: false, stench: false } },
    { type: 'observe', location: [1, 1], percept: { breeze: true, stench: false } },
  ] };
  assert.throws(() => analyzeBelief({ policy }), /Contradictory recorded policy observations/);
});
