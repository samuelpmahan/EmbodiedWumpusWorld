import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, demoWorld } from '../src/session.js';
import { materialize } from '../src/tui/materialize.js';
import { breezeExperiment } from '../src/priors.js';

test('human and policy actions produce identical world transitions', () => {
  const make = () => ({ observe() {}, recordAction() {}, inspect: () => ({}), chooseAction: () => 'turnLeft' });
  const human = createSession({world: demoWorld(), policy: make()});
  const auto = createSession({world: demoWorld(), policy: make()});
  assert.deepEqual(human.act('turnLeft').world, auto.auto().world);
  assert.equal(human.records.filter(r => r.id === 'perceive').length, 2);
});

test('policy gets no hidden world and replay projection never executes it', () => {
  let calls = 0;
  const policy = {observe(p) { calls++; assert.equal('pits' in p, false); assert.equal('wumpus' in p,false); },
    recordAction() {}, chooseAction: () => 'forward', inspect: () => ({})};
  const s = createSession({world: demoWorld(), policy});
  const frame = s.frames[0]; const before = structuredClone(frame);
  materialize(frame); materialize(frame,{reveal:true,inspect:true});
  assert.equal(calls,1); assert.deepEqual(frame,before);
  s.act('turnLeft'); assert.deepEqual(frame,before);
  assert.deepEqual(JSON.parse(JSON.stringify(s.export())).frames[0], before);
});

test('prior comparison is calculated, normalized, and recorded', () => {
  const a=breezeExperiment(.2),b=breezeExperiment(.5);
  assert.ok(Math.abs(a.probabilityA-5/9)<1e-12);
  assert.ok(Math.abs(b.probabilityA-2/3)<1e-12);
  assert.equal(a.posterior[0].weight,0);
  assert.equal(a.records.length,2);
  assert.throws(()=>breezeExperiment(0),/mass|total/i);
});
