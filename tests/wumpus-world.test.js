import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, demoWorld, parseWorld, perceive, stepWorld } from '../src/wumpus/world.js';

function custom(overrides = {}) {
  return {
    ...demoWorld(),
    pits: [],
    wumpus: { x: 4, y: 4, alive: true },
    gold: { x: 4, y: 4, grabbed: false },
    ...overrides,
  };
}

test('WSU start and all six actions have expected percepts and costs', () => {
  const start = demoWorld();
  assert.deepEqual(start.agent, { x: 1, y: 1, heading: 'east', dir: 'E', alive: true, hasArrow: true, hasGold: false, inCave: true });
  assert.deepEqual(perceive(start), { stench: false, breeze: false, glitter: false, bump: false, scream: false, dead: false, won: false, status: 'playing' });
  assert.equal(stepWorld(start, 'forward').score, -1);
  assert.equal(stepWorld(start, 'left').score, -1);
  assert.equal(stepWorld(start, 'right').score, -1);
  assert.equal(stepWorld(start, 'shoot').score, -10);
  const grab = stepWorld(custom({ gold: { x: 1, y: 1, grabbed: false } }), 'grab');
  assert.equal(grab.score, -1);
  assert.equal(grab.agent.hasGold, true);
  const exit = stepWorld(grab, 'climb');
  assert.equal(exit.score, 998);
  assert.equal(exit.outcome, 'won');
});

test('arrow travels in heading direction, kills Wumpus, and scream lasts one turn', () => {
  const world = custom({ wumpus: { x: 3, y: 1, alive: true } });
  const shot = stepWorld(world, 'shoot');
  assert.equal(shot.wumpus.alive, false);
  assert.equal(shot.agent.hasArrow, false);
  assert.equal(perceive(shot).scream, true);
  const moved = stepWorld(shot, 'forward');
  assert.equal(perceive(moved).scream, false);
  assert.equal(perceive(stepWorld(moved, 'right')).scream, false);
});

test('stench remains at adjacent cell after Wumpus death', () => {
  const world = custom({ wumpus: { x: 2, y: 1, alive: true } });
  const dead = stepWorld(stepWorld(world, 'shoot'), 'forward');
  assert.equal(dead.wumpus.alive, false);
  assert.equal(perceive(dead).stench, true);
});

test('bumping leaves the agent in place and reports bump', () => {
  const world = custom({ agent: { ...demoWorld().agent, heading: 'west' } });
  const next = stepWorld(world, 'forward');
  assert.equal(next.agent.x, world.agent.x);
  assert.equal(next.agent.y, world.agent.y);
  assert.equal(next.agent.heading, 'west');
  assert.equal(perceive(next).bump, true);
});

test('pit and live Wumpus both end the game', () => {
  const pit = stepWorld(custom({ pits: [{ x: 2, y: 1 }] }), 'forward');
  assert.equal(pit.outcome, 'dead');
  assert.equal(pit.agent.alive, false);
  const eaten = stepWorld(custom({ wumpus: { x: 2, y: 1, alive: true } }), 'forward');
  assert.equal(eaten.outcome, 'dead');
  assert.equal(eaten.agent.alive, false);
});

test('seeded generation is deterministic and parser accepts WSU text', () => {
  assert.deepEqual(createWorld({ seed: 42 }), createWorld({ seed: 42 }));
  const world = parseWorld('size 4\nwumpus 4 4\ngold 2 2\npit 3 1\npit 1 3');
  assert.equal(world.size, 4);
  assert.deepEqual(world.wumpus, { x: 4, y: 4, alive: true });
  assert.deepEqual(world.pits, [{ x: 3, y: 1 }, { x: 1, y: 3 }]);
});

test('parser rejects non-text and malformed WSU input', () => {
  assert.throws(() => parseWorld(null), TypeError);
  assert.throws(() => parseWorld({}), TypeError);
  assert.throws(() => parseWorld('nonsense'), /invalid world record/);
  assert.throws(() => parseWorld('size 4\nwumpus 4 4'), /requires/);
  assert.throws(() => parseWorld('size 4\nwumpus 5 4\ngold 3 3'), /in bounds/);
  assert.throws(() => parseWorld('size 4\nwumpus 1 1\ngold 3 3'), /cannot be at start/);
  assert.throws(() => parseWorld('size 4\nwumpus 4 4\ngold 3 3\nunknown 2 2'), /unknown world record/);
});
