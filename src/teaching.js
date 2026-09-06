import {createPxC,executeTick,conditionWeights,marginalProbability} from './core/index.js';

/** Compile a finite lesson using the same probability atoms as the LAB. */
export function compileLesson({id,cells,prior,observations,query}) {
  if(!Array.isArray(cells)||!cells.length||cells.length>12||new Set(cells).size!==cells.length)throw Error('Use 1–12 distinct cells.');
  if(!Number.isFinite(prior)||prior<=0||prior>=1)throw Error('Prior must be inside (0,1).');
  if(!Array.isArray(query)||!query.length||!query.every(c=>cells.includes(c)))throw Error('Query must name known cells.');
  if(!Array.isArray(observations)||!observations.every(o=>Array.isArray(o.cells)&&o.cells.length&&o.cells.every(c=>cells.includes(c))&&typeof o.breeze==='boolean'))throw Error('Observations must name known cells and a boolean breeze.');
  const board=createPxC(),records=[];
  board.register('fn.teaching.enumerate',({cells,prior})=>Array.from({length:2**cells.length},(_,mask)=>{const pits=cells.filter((_,i)=>mask&(1<<i));return {pits,weight:prior**pits.length*(1-prior)**(cells.length-pits.length)};}));
  board.register('fn.teaching.condition',({hypotheses,observations})=>conditionWeights(hypotheses,h=>observations.every(o=>o.cells.some(c=>h.pits.includes(c))===o.breeze)?1:0));
  board.register('fn.teaching.query',({posterior,query})=>marginalProbability(posterior,h=>query.every(c=>h.pits.includes(c))));
  records.push(executeTick(board,{id:'lesson.materialize',produces:['px.lesson'],run:b=>b.set('px.lesson',{id,cells,prior,observations,query})}));
  records.push(executeTick(board,{id:'lesson.enumerate',consumes:['px.lesson'],produces:['px.hypotheses'],run:b=>b.set('px.hypotheses',b.call('fn.teaching.enumerate',b.get('px.lesson')))}));
  records.push(executeTick(board,{id:'lesson.condition',consumes:['px.hypotheses','px.lesson'],produces:['px.posterior'],run:b=>b.set('px.posterior',b.call('fn.teaching.condition',{hypotheses:b.get('px.hypotheses'),observations:b.get('px.lesson').observations}))}));
  records.push(executeTick(board,{id:'lesson.query',consumes:['px.posterior','px.lesson'],produces:['px.answer'],run:b=>b.set('px.answer',b.call('fn.teaching.query',{posterior:b.get('px.posterior'),query:b.get('px.lesson').query}))}));
  return {spec:board.get('px.lesson'),hypotheses:board.get('px.hypotheses'),posterior:board.get('px.posterior'),answer:board.get('px.answer'),records};
}
export function teachingSet(prior=.2,prefix='q') {
  const breeze=cells=>({cells,breeze:true});
  return [
    {cells:['A','B'],observations:[breeze(['A','B'])],query:['A']},
    {cells:['A','B'],observations:[breeze(['A','B'])],query:['A','B']},
    {cells:['A','B'],observations:[breeze(['A','B']),breeze(['A','B'])],query:['A']},
    {cells:['A','B','C'],observations:[breeze(['A','B','C']),{cells:['B','C'],breeze:false}],query:['A']},
    {cells:['A','B','C'],observations:[breeze(['A','B']),breeze(['B','C'])],query:['B']}
  ].map((s,i)=>compileLesson({...s,id:`${prefix}${i+1}`,prior}));
}
export function renderLesson(lesson) {
  const s=lesson.spec;
  return [`${s.id}: prior=${s.prior}; query P(${s.query.join(' AND ')})`,
    ...s.observations.map(o=>`${o.breeze?'Breeze':'No breeze'} over ${o.cells.join(',')}`),
    'Possibility | prior weight | posterior weight',
    ...lesson.hypotheses.map((h,i)=>`${h.pits.join('+')||'no pits'} | ${h.weight.toFixed(6)} | ${lesson.posterior[i].weight.toFixed(6)}`),
    `Answer: ${lesson.answer.toFixed(9)}`].join('\n');
}
export function gradeAnswers(lessons,submission,{tolerance=1e-5}={}) {
  const answers=submission?.answers;
  if(!Array.isArray(answers))throw Error('Submission requires answers array.');
  if(new Set(answers.map(a=>a.id)).size!==answers.length)throw Error('Duplicate answer IDs.');
  if(answers.some(a=>!lessons.some(l=>l.spec.id===a.id)))throw Error('Unknown answer ID.');
  const results=lessons.map(l=>{const a=answers.find(a=>a.id===l.spec.id);return {id:l.spec.id,expected:l.answer,submitted:a?.value??null,correct:typeof a?.value==='number'&&Number.isFinite(a.value)&&Math.abs(a.value-l.answer)<=tolerance,reason:a?.reason??''};});
  return {correct:results.filter(r=>r.correct).length,total:results.length,results};
}

export function transferSet(prior=.3) {
  const lessons=teachingSet(prior);
  lessons[4]=compileLesson({id:'q5',cells:['A','B','C','D'],prior,observations:[['A','B'],['B','C'],['C','D']].map(cells=>({cells,breeze:true})),query:['B']});
  return lessons;
}
/** Separate semantic compatibility from arithmetic. Never certify an incomplete world set. */
export function gradeCertificate(lesson,certificate) {
  const worlds=certificate?.retainedWorlds;
  if(!Array.isArray(worlds)||worlds.some(w=>!Array.isArray(w)||new Set(w).size!==w.length||w.some(c=>!lesson.spec.cells.includes(c))))throw Error('Certificate must list assignments of known cells.');
  const canonical=w=>[...w].sort().join(','),actual=worlds.map(canonical);
  const expected=lesson.posterior.filter(h=>h.weight>0).map(h=>canonical(h.pits));
  const missing=expected.filter(k=>!actual.includes(k)),extra=actual.filter(k=>!expected.includes(k)),duplicates=actual.length-new Set(actual).size;
  const compatibleSetCorrect=!missing.length&&!extra.length&&!duplicates;
  const evidenceMass=lesson.hypotheses.filter(h=>expected.includes(canonical(h.pits))).reduce((n,h)=>n+h.weight,0);
  const violations=worlds.flatMap(pits=>lesson.spec.observations.flatMap((o,index)=>o.cells.some(c=>pits.includes(c))===o.breeze?[]:[{pits,observation:index,cells:o.cells,expectedBreeze:o.breeze,actualBreeze:o.cells.some(c=>pits.includes(c))}]));
  const ledger=compatibleSetCorrect?lesson.hypotheses.filter(h=>expected.includes(canonical(h.pits))).map(h=>({pits:h.pits,priorWeight:h.weight,matchesQuery:lesson.spec.query.every(c=>h.pits.includes(c))})):[];
  return {compatibleSetCorrect,missing,extra,duplicates,violations,ledger,evidenceMass,submittedEvidenceMass:certificate.evidenceMass??null,evidenceMassCorrect:typeof certificate.evidenceMass==='number'&&Math.abs(certificate.evidenceMass-evidenceMass)<1e-5,compiledAnswer:compatibleSetCorrect?lesson.answer:null};
}
