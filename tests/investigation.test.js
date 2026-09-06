import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,demoWorld} from '../src/session.js';
import {investigate} from '../src/investigation.js';
import {traceAddress} from '../src/core/provenance.js';

test('investigation recomputes actual priors over fixed observations, records named calculations, and reads no world',()=>{
  const session=createSession({world:demoWorld()});session.act('forward');
  const frame=session.snapshot();Object.defineProperty(frame,'world',{get(){throw Error('hidden truth read');}});
  const a=investigate(frame,{pitPrior:.2}),b=investigate(frame,{pitPrior:.5});
  assert.ok(Math.abs(a.analysis.pitProbabilities['3,1']-5/9)<1e-10);
  assert.ok(Math.abs(b.analysis.pitProbabilities['3,1']-2/3)<1e-10);
  assert.deepEqual(a.analysis.observations,b.analysis.observations);
  assert.equal(a.pxc.has('px.world'),false);
  assert.ok(a.records.some(r=>r.calculations.some(c=>c.address==='fn.belief.condition')));
  assert.ok(a.records.some(r=>r.calculations.some(c=>c.address==='fn.policy.advise')));
  const before=JSON.stringify(a.analysis);
  const constraint=a.inspectCandidate([3,1]);
  assert.equal(constraint.status,'violated');
  assert.ok(constraint.reads.includes('px.assumptions'));
  assert.ok(constraint.reads.includes('px.agent.knowledge'));
  const tree=traceAddress(a.records,'px.advice');
  assert.equal(tree.producer.id,'investigation.choose');
  assert.ok(tree.inputs.some(x=>x.address==='px.analysis'));
  assert.equal(JSON.stringify(a.analysis),before);
});

test('reasoning policy executes real percept-only decisions and stops safely in practice cave',()=>{
  const session=createSession({world:demoWorld()});
  for(let step=0;step<24&&!session.snapshot().world.terminal;step++){
    const frame=session.snapshot(),result=investigate(frame,{riskTolerance:0});
    const action=result.advice.action;
    assert.ok(action,'must offer a safe retreat or action');
    const receipt={advice:result.advice,assumptions:result.pxc.get('px.assumptions'),records:result.records};
    session.act(action,{decision:receipt});
    assert.equal(session.snapshot().decision.advice.action,action);
    assert.ok(session.export().records.some(r=>r.id==='decision.record'));
  }
  assert.notEqual(session.snapshot().world.outcome,'dead');
  assert.equal(session.snapshot().world.terminal,true,'must eventually retreat instead of looping');
});
