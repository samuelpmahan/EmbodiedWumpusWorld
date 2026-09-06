import test from 'node:test';
import assert from 'node:assert/strict';
import { explainCell, senseGuide } from '../src/learning.js';

function frame({ observations = [], pitProbabilities = {}, start = [1, 1], visited = [] } = {}) {
  return {
    // Deliberately incompatible hidden truth: learning explanations must ignore it.
    world: { pits: [{ x: 2, y: 1 }], wumpus: { x: 3, y: 3, alive: true } },
    policy: { visited, belief: { start, observations, pitProbabilities } },
  };
}

test('cell explanation is driven only by recorded belief, never hidden world hazards', () => {
  const fromBelief = frame({ pitProbabilities: { '2,1': 0.25 } });
  const contradictoryTruth = structuredClone(fromBelief);
  contradictoryTruth.world.pits = [];
  contradictoryTruth.world.wumpus = { x: 2, y: 1, alive: true };

  const a = explainCell(fromBelief, [2, 1]);
  const b = explainCell(contradictoryTruth, [2, 1]);
  assert.deepEqual(a, b);
  assert.equal(a.probability, 0.25);
  assert.doesNotMatch(`${a.summary}\n${a.evidence.join('\n')}`, /wumpus|world|hidden|truth/i);
});

test('a breeze explains adjacent pit risk without declaring the queried cell a pit', () => {
  const explanation = explainCell(frame({
    observations: [{ location: [1, 1], breeze: true }],
    pitProbabilities: { '2,1': 5 / 9 },
  }), [2, 1]);

  assert.equal(explanation.probability, 5 / 9);
  assert.match(explanation.evidence.join('\n'), /breeze/i);
  assert.match(explanation.evidence.join('\n'), /adjacent|neighbor/i);
  assert.doesNotMatch(`${explanation.summary}\n${explanation.evidence.join('\n')}`, /this cell (?:is|contains|has) (?:a )?pit/i);
});

test('no breeze records exclusion of adjacent pits', () => {
  const explanation = explainCell(frame({
    observations: [{ location: [1, 1], breeze: false }],
    pitProbabilities: { '2,1': 0 },
  }), [2, 1]);

  assert.equal(explanation.probability, 0);
  assert.match(`${explanation.summary}\n${explanation.evidence.join('\n')}`, /no breeze|without breeze/i);
  assert.match(`${explanation.summary}\n${explanation.evidence.join('\n')}`, /safe|no pit|zero/i);
});

test('start and visited cells are explained as safe from pit evidence', () => {
  const start = explainCell(frame({ start: [1, 1] }), [1, 1]);
  assert.equal(start.probability, 0);
  assert.match(`${start.summary}\n${start.evidence.join('\n')}`, /start.*safe|safe.*start/i);

  const visited = explainCell(frame({
    pitProbabilities: { '2,1': 0.8 },
    visited: [[1, 1], [2, 1]],
  }), [2, 1]);
  assert.equal(visited.probability, 0);
  assert.match(`${visited.summary}\n${visited.evidence.join('\n')}`, /visited.*safe|safe.*visited|survived/i);
});

test('percept guide distinguishes pit evidence from Wumpus and reward cues', () => {
  const guide = senseGuide({ breeze: true, stench: true, glitter: true, bump: true, scream: true });
  assert.ok(Array.isArray(guide));
  const text = guide.join('\n');
  assert.match(text, /breeze/i);
  assert.match(text, /pit/i);
  assert.match(text, /stench/i);
  assert.match(text, /glitter/i);
  assert.match(text, /bump/i);
  assert.match(text, /scream/i);
  assert.match(text, /stench[\s\S]{0,160}(?:does not|no).*pit|(?:does not|no).*pit[\s\S]{0,160}stench/i);
});
