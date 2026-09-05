import test from 'node:test';
import assert from 'node:assert/strict';
import { conditionWeights, marginalProbability } from '../src/core/probability.js';

test('conditionWeights normalizes likelihood-adjusted priors and preserves metadata', () => {
  const source = [
    { id: 'a', label: 'alpha', weight: 2 },
    { id: 'b', label: 'beta' },
  ];
  const result = conditionWeights(source, (item) => item.id === 'a' ? 3 : 1);
  assert.deepEqual(result, [
    { id: 'a', label: 'alpha', weight: 6 / 7 },
    { id: 'b', label: 'beta', weight: 1 / 7 },
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result[0]), true);
  assert.deepEqual(source, [{ id: 'a', label: 'alpha', weight: 2 }, { id: 'b', label: 'beta' }]);
});

test('marginalProbability uses default and explicit priors', () => {
  assert.equal(marginalProbability([{ yes: true }, { yes: false }], (item) => item.yes), 0.5);
  assert.equal(marginalProbability([
    { yes: true, weight: 3 }, { yes: false, weight: 1 },
  ], (item) => item.yes), 0.75);
});

test('probability helpers reject invalid and zero-mass inputs explicitly', () => {
  assert.throws(() => conditionWeights([], () => 1), /positive finite total/);
  assert.throws(() => conditionWeights([{ id: 'a' }], () => 0), /positive finite total/);
  assert.throws(() => conditionWeights([{ weight: -1 }], () => 1), /non-negative/);
  assert.throws(() => marginalProbability([{ weight: 0 }], () => true), /positive finite total/);
  assert.throws(() => marginalProbability([{ id: 'a' }], true), /predicate must be a function/);
});
