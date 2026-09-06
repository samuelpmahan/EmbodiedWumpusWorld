import test from 'node:test';
import assert from 'node:assert/strict';
import { createBelief } from '../src/wumpus/belief.js';
import { createPolicy } from '../src/wumpus/policy.js';

test('two-neighbour breeze posterior is exact for pitPrior .2', () => {
  const b = createBelief({ width: 4, height: 2, pitPrior: 0.2 });
  b.observe({ breeze: true }, [2, 1]);
  assert.ok(Math.abs(b.probability([3, 1]) - 5 / 9) < 1e-12);
  assert.ok(Math.abs(b.probability([2, 2]) - 5 / 9) < 1e-12);
});

test('two-neighbour posterior uses arbitrary prior and no breeze excludes pits', () => {
  const b = createBelief({ width: 4, height: 2, pitPrior: 0.5 });
  b.observe({ breeze: true }, [2, 1]);
  assert.ok(Math.abs(b.probability([3, 1]) - 2 / 3) < 1e-12);
  const n = createBelief({ width: 4, height: 2, pitPrior: 0.2 });
  n.observe({ breeze: false }, [2, 1]);
  assert.equal(n.probability([3, 1]), 0);
  assert.equal(n.probability([2, 2]), 0);
});

test('contradictory evidence is rejected', () => {
  const b = createBelief({ width: 2, height: 2 });
  b.observe({ breeze: false }, [2, 1]);
  assert.throws(() => b.observe({ breeze: true }, [2, 1]), /positive finite total|conditionWeights/);
});

test('degree-three and degree-four evidence conditions all neighbours', () => {
  const three = createBelief({ width: 4, height: 2 });
  three.observe({ breeze: false }, [2, 1]);
  assert.equal(three.probability([1, 1]), 0);
  assert.equal(three.probability([3, 1]), 0);
  const four = createBelief({ width: 3, height: 3 });
  four.observe({ breeze: false }, [2, 2]);
  for (const p of [[1, 2], [3, 2], [2, 1], [2, 3]]) assert.equal(four.probability(p), 0);
});

test('policy tracks turns, bumps, and rejects unearned grab', () => {
  const p = createPolicy({ size: 2 });
  p.recordAction('turnRight'); p.observe({});
  assert.equal(p.inspect().heading, 1);
  p.recordAction('forward'); p.observe({ bump: true });
  assert.deepEqual(p.inspect().location, [1, 1]);
  p.recordAction('grab'); p.observe({});
  assert.equal(p.inspect().hasGold, false);
});

test('policy routes home after successful grab', () => {
  const p = createPolicy({ size: 3 });
  p.recordAction('forward'); p.observe({ glitter: true });
  p.recordAction('grab'); p.observe({});
  assert.notEqual(p.chooseAction(), 'climb');
  p.recordAction('left'); p.observe({});
  assert.notEqual(p.chooseAction(), 'climb');
});
