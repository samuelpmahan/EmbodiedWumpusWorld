import { createPxC, executeTick } from './core/index.js';
import { createWorld, demoWorld, stepWorld, perceive, createPolicy } from './wumpus/index.js';

export function createSession({ seed = 1, world, prior = 0.2, policy } = {}) {
  const pxc = createPxC();
  const initialWorld = structuredClone(world ?? createWorld({ seed }));
  const driver = policy ?? createPolicy({ pitPrior: prior, size: initialWorld.size });
  const records = [];
  const frames = [];
  const actions = [];
  pxc.set('px.world', initialWorld);
  pxc.register('fn.world.transition', ({ world, action }) => stepWorld(world, action));
  pxc.register('fn.world.perceive', world => perceive(world));
  function sense() {
    records.push(executeTick(pxc, {
      id: 'perceive', consumes: ['px.world'], produces: ['px.agent.percepts'],
      run: b => b.set('px.agent.percepts', b.call('fn.world.perceive', b.get('px.world'))),
    }));
    records.push(executeTick(pxc, {
      id: 'beliefs', consumes: ['px.agent.percepts','px.world'], produces: ['px.agent.beliefs'],
      run: b => { const percept = b.get('px.agent.percepts');
        if (!b.get('px.world').terminal) driver.observe(structuredClone(percept));
        b.set('px.agent.beliefs', structuredClone(driver.inspect())); },
    }));
  }
  function snapshot() {
    return structuredClone({ world: pxc.get('px.world'), percept: pxc.get('px.agent.percepts'),
      policy: pxc.get('px.agent.beliefs'), decision: pxc.has('px.action.decision') ? pxc.get('px.action.decision') : null, recordEnd: records.length, records: records.slice(-3).map(({ inputs, outputs, result, calculations, ...record }) =>
        ({...record, calculations: calculations?.map(({address})=>({address}))})) });
  }
  function act(action, { decision = null } = {}) {
    if (pxc.get('px.world').terminal) return snapshot();
    pxc.set('px.action', action);
    pxc.set('px.action.decision',null);
    if (decision) records.push(executeTick(pxc,{id:'decision.record',consumes:[],produces:['px.action.decision'],run:b=>b.set('px.action.decision',decision)}));
    records.push(executeTick(pxc, {
      id: 'transition', consumes: ['px.world', 'px.action'], produces: ['px.world'],
      run: b => b.set('px.world', b.call('fn.world.transition', { world: b.get('px.world'), action: b.get('px.action') })),
    }));
    actions.push(action);
    driver.recordAction(action);
    sense();
    const frame = snapshot(); frames.push(frame); return frame;
  }
  sense(); frames.push(snapshot());
  return { pxc, records, frames, act, snapshot,
    fork(frameIndex, { prior: nextPrior = prior } = {}) {
      if (policy) throw new Error("Forking a custom policy requires its own reconstruction factory.");
      if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= frames.length) throw new RangeError("Choose an existing frame to fork.");
      const branch = createSession({world: initialWorld, prior: nextPrior});
      for (const action of actions.slice(0, frameIndex)) branch.act(action);
      return branch;
    },
    auto: () => pxc.get('px.world').terminal ? snapshot() : act(driver.chooseAction()),
    export: () => ({ schema: 'lab-replay@1', frames: structuredClone(frames), records: structuredClone(records) }),
  };
}
export { demoWorld };
