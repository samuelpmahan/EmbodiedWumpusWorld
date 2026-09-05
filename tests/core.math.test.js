import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPoints,
  intersection,
  manhattanDistance,
  neighbors,
  point,
  rectangleIntersection,
} from '../src/core/math.js';

test('point and point arithmetic are immutable', () => {
  const a = point(2, 3);
  const b = point(-1, 4);
  assert.deepEqual(addPoints(a, b), { x: 1, y: 7 });
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(addPoints(a, b)), true);
  assert.equal(manhattanDistance(a, b), 4);
});

test('neighbors are cardinal and ordered north east south west', () => {
  assert.deepEqual(neighbors(point(2, 2)), [
    { x: 2, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 2 },
  ]);
  assert.deepEqual(neighbors(point(0, 0), { width: 2, height: 2 }), [
    { x: 1, y: 0 }, { x: 0, y: 1 },
  ]);
});

test('intersection preserves first iterable order and removes duplicates', () => {
  assert.deepEqual(intersection(['b', 'a', 'b', 'c'], new Set(['c', 'b'])), ['b', 'c']);
  assert.deepEqual(intersection(new Set([1, 2]), [3]), []);
});

test('rectangle intersection uses half-open integer bounds', () => {
  assert.deepEqual(rectangleIntersection({ x: 1, y: 1, width: 4, height: 3 }, { x: 3, y: 0, width: 3, height: 3 }), {
    x: 3, y: 1, width: 2, height: 2,
  });
  assert.equal(rectangleIntersection({ x: 0, y: 0, width: 1, height: 1 }, { x: 1, y: 0, width: 2, height: 2 }), null);
});

