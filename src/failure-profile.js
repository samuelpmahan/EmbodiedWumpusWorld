import {createPxC,executeTick} from './core/index.js';
export const profileCases=[
 {id:'familiar',cells:['A','B','C','D'],sets:[['A','B'],['B','C'],['C','D']],exact:false,query:'B'},
 {id:'neutral',cells:['K','M','R','Z'],sets:[['M','R'],['R','Z'],['K','M']],exact:false,query:'M'},
 {id:'changed_rule',cells:['A','B','C','D'],sets:[['A','B'],['B','C'],['C','D']],exact:true,query:'B'}
];
const key=xs=>JSON.stringify([...xs].sort());
const near=(x,y)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x-y)<=1e-6;
/** Exact integer prior units for this preregistered p=3/10, four-cell probe. */
export function compileProfileCase(spec){
 if(!spec||!Array.isArray(spec.cells)||spec.cells.length!==4||new Set(spec.cells).size!==4||spec.cells.some(c=>typeof c!=='string')||!spec.cells.includes(spec.query)||typeof spec.exact!=='boolean'||!Array.isArray(spec.sets)||!spec.sets.length||spec.sets.some(s=>!Array.isArray(s)||!s.length||new Set(s).size!==s.length||s.some(c=>!spec.cells.includes(c))))throw Error('Profile requires four distinct named cells and known sensor/query cells.');
 const pxc=createPxC(),records=[];
 pxc.register('fn.profile.enumerate',s=>Array.from({length:16},(_,mask)=>{const truth=s.cells.filter((_,i)=>mask&(1<<i));return {true:truth,units:3**truth.length*7**(4-truth.length)};}));
 pxc.register('fn.profile.constrain',({spec,worlds})=>worlds.filter(w=>spec.sets.every(set=>{const n=set.filter(c=>w.true.includes(c)).length;return spec.exact?n===1:n>=1;})));
 pxc.register('fn.profile.resolve',({spec,worlds})=>{const denominatorUnits=worlds.reduce((n,w)=>n+w.units,0),numeratorUnits=worlds.filter(w=>w.true.includes(spec.query)).reduce((n,w)=>n+w.units,0);return {worlds:worlds.map(w=>({...w,weight:w.units/10000})),numeratorUnits,denominatorUnits,numerator:numeratorUnits/10000,denominator:denominatorUnits/10000,answer:numeratorUnits/denominatorUnits};});
 records.push(executeTick(pxc,{id:'profile.materialize',produces:['px.probe.spec'],run:b=>b.set('px.probe.spec',spec)}));
 records.push(executeTick(pxc,{id:'profile.enumerate',consumes:['px.probe.spec'],produces:['px.probe.worlds'],run:b=>b.set('px.probe.worlds',b.call('fn.profile.enumerate',b.get('px.probe.spec')))}));
 records.push(executeTick(pxc,{id:'profile.constrain',consumes:['px.probe.spec','px.probe.worlds'],produces:['px.probe.compatible'],run:b=>b.set('px.probe.compatible',b.call('fn.profile.constrain',{spec:b.get('px.probe.spec'),worlds:b.get('px.probe.worlds')}))}));
 records.push(executeTick(pxc,{id:'profile.resolve',consumes:['px.probe.spec','px.probe.compatible'],produces:['px.probe.answer'],run:b=>b.set('px.probe.answer',b.call('fn.profile.resolve',{spec:b.get('px.probe.spec'),worlds:b.get('px.probe.compatible')}))}));
 return {...pxc.get('px.probe.answer'),records};
}
export function profileTask(spec,task){
 const expected=compileProfileCase(spec),worlds=task?.worlds;
 if(!task||task.id!==spec.id||['numerator','denominator','answer','confidence'].some(k=>typeof task[k]!=='number'||!Number.isFinite(task[k]))||task.confidence<0||task.confidence>1)return {id:spec.id,schemaValid:false};
 if(!Array.isArray(worlds)||worlds.some(w=>!Array.isArray(w.true)||w.true.some(c=>!spec.cells.includes(c))||new Set(w.true).size!==w.true.length||typeof w.weight!=='number'||!Number.isFinite(w.weight)))return {id:spec.id,schemaValid:false};
 const keys=worlds.map(w=>key(w.true)),expectedKeys=expected.worlds.map(w=>key(w.true));
 const missing=expected.worlds.filter(w=>!keys.includes(key(w.true))).map(w=>w.true),extra=worlds.filter(w=>!expectedKeys.includes(key(w.true))).map(w=>w.true),duplicates=keys.length-new Set(keys).size;
 const weightErrors=worlds.flatMap(w=>{const weight=3**w.true.length*7**(4-w.true.length)/10000;return near(w.weight,weight)?[]:[{world:w.true,reported:w.weight,expected:weight}];});
 const ownDenominator=worlds.reduce((n,w)=>n+w.weight,0),ownNumerator=worlds.filter(w=>w.true.includes(spec.query)).reduce((n,w)=>n+w.weight,0);
 const completeness=!missing.length&&!extra.length&&!duplicates;
 const flags={worldSet:completeness,weights:!weightErrors.length,numerator:near(task.numerator,expected.numerator),denominator:near(task.denominator,expected.denominator),answer:near(task.answer,expected.answer),numeratorMatchesOwnLedger:near(task.numerator,ownNumerator),denominatorMatchesOwnLedger:near(task.denominator,ownDenominator),divisionMatchesOwnTotals:typeof task.denominator==='number'&&task.denominator>0&&near(task.answer,task.numerator/task.denominator)};
 const earliestFailure=!completeness?'world-set':weightErrors.length?'world-weight':!flags.numeratorMatchesOwnLedger||!flags.denominatorMatchesOwnLedger?'aggregation':!flags.divisionMatchesOwnTotals?'division':!flags.answer?'answer':'none';
 return {id:spec.id,schemaValid:true,earliestFailure,flags,missing,extra,duplicates,weightErrors,reportedConfidence:task.confidence,expected:{numerator:expected.numerator,denominator:expected.denominator,answer:expected.answer},reported:{numerator:task.numerator,denominator:task.denominator,answer:task.answer},ownLedger:{numerator:ownNumerator,denominator:ownDenominator}};
}
/** Format failure remains a failure even when complete task objects can be salvaged. */
export function parseProfileResponse(raw){
 try{const value=JSON.parse(raw);if(!Array.isArray(value.tasks)||value.tasks.length!==3||new Set(value.tasks.map(t=>t.id)).size!==3||value.tasks.some(t=>!profileCases.some(c=>c.id===t.id)))throw Error('Expected one entry per task.');return {formatValid:true,tasks:value.tasks};}
 catch(error){
  const tasks=[];
  for(const match of raw.matchAll(/\{"id":"(familiar|neutral|changed_rule)"/g)){
   let depth=0,inString=false,escape=false;
   for(let i=match.index;i<raw.length;i++){
    const c=raw[i];if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;continue;}if(c==='"'){inString=true;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0){try{tasks.push(JSON.parse(raw.slice(match.index,i+1)));}catch{}break;}
   }
  }
  return {formatValid:false,error:error.message,recoveredForDiagnosisOnly:true,tasks};
 }
}
