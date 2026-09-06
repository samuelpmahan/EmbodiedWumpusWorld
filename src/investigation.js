import { createPxC, executeTick } from './core/index.js';
import { evaluateConstraint } from './core/constraint.js';
import { analyzeBelief } from './wumpus/analysis.js';
import { advise } from './wumpus/advisor.js';

/** A separate, reproducible calculation over an agent's recorded knowledge. */
export function investigate(frame, {pitPrior=frame.policy.belief.pitPrior,riskTolerance=.25}={}) {
  const pxc=createPxC(),records=[];
  // The world's hidden truth never enters this board.
  const policy=structuredClone(frame.policy);
  delete policy.belief.candidates;
  const assumptions={pitPrior,riskTolerance};
  records.push(executeTick(pxc,{id:'investigation.materialize',consumes:[],produces:['px.agent.knowledge','px.assumptions'],run:b=>{
    b.set('px.agent.knowledge',policy);b.set('px.assumptions',assumptions);
  }}));
  pxc.register('fn.belief.condition',({knowledge,assumptions})=>{
    const result=analyzeBelief({policy:knowledge},{pitPrior:assumptions.pitPrior});
    delete result.pitCandidates; // Keep the inspection receipt compact; analysis exposes the exact count and marginals.
    return result;
  });
  pxc.register('fn.policy.advise',({knowledge,analysis,assumptions})=>advise({policy:knowledge},analysis,{riskTolerance:assumptions.riskTolerance}));
  pxc.register('fn.constraint.riskBudget',({materials})=>{
    const {candidate,assumptions}=materials;
    if(!candidate)return {status:'unknown',reason:'No travel candidate is selected.'};
    return {status:candidate.risk<=assumptions.riskTolerance?'satisfied':'violated',reason:`Danger upper bound ${(candidate.risk*100).toFixed(1)}% ${candidate.risk<=assumptions.riskTolerance?'≤':'>'} budget ${(assumptions.riskTolerance*100).toFixed(1)}%.`,measurements:[{name:'danger upper bound',value:candidate.risk,unit:'probability'}]};
  });
  records.push(executeTick(pxc,{id:'investigation.condition',consumes:['px.agent.knowledge','px.assumptions'],produces:['px.analysis'],run:b=>b.set('px.analysis',b.call('fn.belief.condition',{knowledge:b.get('px.agent.knowledge'),assumptions:b.get('px.assumptions')}))}));
  records.push(executeTick(pxc,{id:'investigation.choose',consumes:['px.agent.knowledge','px.assumptions','px.analysis'],produces:['px.advice'],run:b=>b.set('px.advice',b.call('fn.policy.advise',{knowledge:b.get('px.agent.knowledge'),assumptions:b.get('px.assumptions'),analysis:b.get('px.analysis')}))}));
  const constraint={kind:'constraint',id:'travel.riskBudget',label:'Travel fits the chosen risk budget',materials:{candidate:'px.candidate',assumptions:'px.assumptions'},predicate:'fn.constraint.riskBudget',basis:{observations:['px.agent.knowledge'],assumptions:['px.assumptions']}};
  return {pxc,records,analysis:pxc.get('px.analysis'),advice:pxc.get('px.advice'),
    inspectCandidate(cell){
      const candidate=pxc.get('px.advice').candidates.find(c=>c.cell.join(',')===cell.join(','))??null;
      records.push(executeTick(pxc,{id:'investigation.select',consumes:[],produces:['px.candidate'],run:b=>b.set('px.candidate',candidate)}));
      records.push(executeTick(pxc,{id:'investigation.constrain',consumes:['px.candidate','px.assumptions','px.agent.knowledge'],produces:['px.constraint.travel'],run:b=>b.set('px.constraint.travel',evaluateConstraint(b,constraint))}));
      return pxc.get('px.constraint.travel');
    }};
}
