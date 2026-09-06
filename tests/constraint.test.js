import test from 'node:test';
import assert from 'node:assert/strict';
import { createPxC } from '../src/core/pxc.js';
import { executeTick } from '../src/core/execute.js';
import { evaluateConstraint } from '../src/core/constraint.js';

const leaf = (id, predicate = 'fn.ok', materials = { value: 'material.value' }, basis = { observations: [], assumptions: [] }) => ({
  kind: 'constraint', id, label: id, materials, predicate, basis,
});

test('calls predicates with structured materials, observations, and assumptions', () => {
  const pxc = createPxC();
  pxc.set('material.value', 3); pxc.set('observation.latest', { breeze: false }); pxc.set('assumption.limit', .25);
  pxc.register('fn.ok', ({ materials, observations, assumptions }) => {
    assert.deepEqual(materials, { value: 3 });
    assert.deepEqual(observations, { 'observation.latest': { breeze: false } });
    assert.deepEqual(assumptions, { 'assumption.limit': .25 });
    return true;
  });
  assert.deepEqual(evaluateConstraint(pxc, leaf('c1', 'fn.ok', undefined, {
    observations: ['observation.latest'], assumptions: ['assumption.limit'],
  })), {
    status: 'satisfied', reason: 'predicate satisfied', constraint: 'c1',
    reads: ['material.value', 'observation.latest', 'assumption.limit', 'fn.ok'], missing: [],
  });
});

test('missing materials or basis values produce unknown without invoking predicate', () => {
  const pxc = createPxC(); let called = false;
  pxc.register('fn.ok', () => { called = true; return true; });
  const result = evaluateConstraint(pxc, leaf('c1', 'fn.ok', { value: 'material.value' }, {
    observations: ['observation.missing'], assumptions: ['assumption.missing'],
  }));
  assert.deepEqual(result, {
    status: 'unknown', reason: 'missing material or basis', constraint: 'c1', reads: [],
    missing: ['material.value', 'observation.missing', 'assumption.missing'],
  });
  assert.equal(called, false);
});

test('basis reads are visible in a caller-owned tick receipt', () => {
  const pxc = createPxC();
  pxc.set('material.value', 1); pxc.set('observation.latest', 'seen'); pxc.set('assumption.limit', .25);
  pxc.register('fn.ok', () => true);
  const receipt = executeTick(pxc, {
    id: 'evaluate', run: (tx) => tx.set('result', evaluateConstraint(tx, leaf('c1', 'fn.ok', undefined, {
      observations: ['observation.latest'], assumptions: ['assumption.limit'],
    }))),
  });
  assert.deepEqual(receipt.actualConsumes, ['material.value', 'observation.latest', 'assumption.limit']);
});

test('groups use three-valued all and any semantics', () => {
  const pxc = createPxC(); pxc.set('material.value', 3);
  pxc.register('fn.true', () => true); pxc.register('fn.false', () => false);
  const unknown = leaf('unknown', 'fn.true', { absent: 'material.absent' });
  assert.equal(evaluateConstraint(pxc, { kind: 'constraint-group', id: 'all', label: 'all', operator: 'all', members: [leaf('yes', 'fn.true'), unknown] }).status, 'unknown');
  assert.equal(evaluateConstraint(pxc, { kind: 'constraint-group', id: 'any', label: 'any', operator: 'any', members: [leaf('no', 'fn.false'), unknown] }).status, 'unknown');
  assert.equal(evaluateConstraint(pxc, { kind: 'constraint-group', id: 'all-v', label: 'all-v', operator: 'all', members: [leaf('no', 'fn.false'), unknown] }).status, 'violated');
  assert.equal(evaluateConstraint(pxc, { kind: 'constraint-group', id: 'any-s', label: 'any-s', operator: 'any', members: [leaf('yes', 'fn.true'), unknown] }).status, 'satisfied');
});

test('rejects malformed definitions, empty groups, and predicate results while propagating runtime errors', () => {
  const pxc = createPxC(); pxc.set('material.value', 1);
  assert.throws(() => evaluateConstraint(pxc, { kind: 'constraint-group', id: 'g', label: 'g', operator: 'all', members: [] }), RangeError);
  assert.throws(() => evaluateConstraint(pxc, { kind: 'constraint', id: 'bad', label: 'bad', materials: {}, predicate: 'wrong', basis: {} }), TypeError);
  pxc.register('fn.invalid', () => 1);
  assert.throws(() => evaluateConstraint(pxc, leaf('invalid', 'fn.invalid')), TypeError);
  pxc.register('fn.boom', () => { throw new Error('boom'); });
  assert.throws(() => evaluateConstraint(pxc, leaf('boom', 'fn.boom')), /boom/);
});

test('accepts structured predicate judgments with measurements and details', () => {
  const pxc = createPxC(); pxc.set('material.value', 3);
  pxc.register('fn.judgment', () => ({ status: 'unknown', reason: 'insufficient evidence', measurements: { score: .4 }, details: { source: 'test' } }));
  assert.deepEqual(evaluateConstraint(pxc, leaf('j', 'fn.judgment')), {
    status: 'unknown', reason: 'insufficient evidence', constraint: 'j', reads: ['material.value', 'fn.judgment'], missing: [],
    measurements: { score: .4 }, details: { source: 'test' },
  });
});
