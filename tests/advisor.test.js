import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvisor, advise } from '../src/wumpus/advisor.js';
import { createPolicy } from '../src/wumpus/policy.js';

test('advisor explains glitter and never reads hidden world state', () => {
  const policy = createPolicy({ size: 2 });
  policy.observe({ glitter: true });
  const result = advise(policy);
  assert.equal(result.action, 'grab');
  assert.equal(result.target, null);
  assert.match(result.reason, /glitter/i);
  assert.equal('pits' in result, false);
});

test('advisor reports lowest recorded pit risk for a snapshot', () => {
  const result = advise({ location: [1, 1], heading: 0, visited: [[1, 1]], belief: {
    width: 2, height: 2, start: [1, 1], pitProbabilities: { '2,1': 0.7, '1,2': 0.1 },
  } });
  assert.equal(result.action, 'turnLeft');
  assert.deepEqual(result.target, [1, 2]);
  assert.equal(result.risk, 0.1);
  assert.equal(result.candidates.length, 2);
});

test('advisor facade observes percepts and returns serializable evidence', () => {
  const advisor = createAdvisor({ state: { location: [1, 1], heading: 0, visited: [[1, 1]], belief: { width: 2, height: 2, start: [1, 1], pitProbabilities: { '2,1': 0.2, '1,2': 0.3 } } } });
  advisor.observe({ glitter: true });
  const result = advisor.advise();
  assert.equal(result.action, 'grab');
  assert.deepEqual(advisor.inspect().lastPercept, { glitter: true });
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('advisor retreats over visited cells when no frontier meets the risk limit', () => {
  const report = { pitProbabilities: { '2,1': 0, '3,1': 1, '1,2': 1, '2,2': 1, '3,2': 1 }, wumpusProbabilities: {}, wumpusAlive: true };
  const result = advise({ policy: { location: [2, 1], heading: 0, visited: [[1, 1], [2, 1]], belief: { width: 3, height: 2, start: [1, 1] } } }, report, { riskTolerance: 0 });
  assert.equal(result.action, 'turnLeft');
  assert.deepEqual(result.target, [1, 1]);
  assert.match(result.reason, /retreat/i);
});
