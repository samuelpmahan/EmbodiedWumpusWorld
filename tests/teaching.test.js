import test from 'node:test';
import assert from 'node:assert/strict';
import {teachingSet,gradeAnswers,compileLesson} from '../src/teaching.js';
import {resolveCertificate,transferSet} from '../src/teaching.js';

test('production solver ignores learner numbers and records verified arithmetic',()=>{
 const lesson=transferSet()[4],retainedWorlds=lesson.posterior.filter(h=>h.weight>0).map(h=>h.pits);
 const certificate={retainedWorlds,evidenceMass:.1278,answer:.8521126761};
 const result=resolveCertificate(lesson.spec,certificate);
 assert.equal(result.status,'resolved');assert.ok(Math.abs(result.answer-17/24)<1e-12);
 assert.equal(certificate.evidenceMass,.1278);
 assert.equal(result.records.at(-1).calculations[0].address,'fn.solution.query');
 assert.equal(resolveCertificate(lesson.spec,{retainedWorlds:retainedWorlds.slice(1),answer:17/24}).answer,null);
 assert.equal(resolveCertificate(lesson.spec,{retainedWorlds:[...retainedWorlds,retainedWorlds[0]]}).status,'needs-correction');
 assert.equal(resolveCertificate(lesson.spec,{retainedWorlds:[...retainedWorlds,['A','D']]}).status,'needs-correction');
});
test('lesson answers match independent closed-form probabilities',()=>{
 for(const p of [.2,.3,.4]){
 const [single,both,repeated,excluded,overlap]=teachingSet(p);
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
 near(single.answer,p/(1-(1-p)**2));near(both.answer,p*p/(1-(1-p)**2));
 near(repeated.answer,single.answer);near(excluded.answer,1);near(overlap.answer,p/(p+(1-p)*p*p));
 assert.notEqual(both.answer,single.answer**2);
 assert.equal(single.records.at(-1).calculations[0].address,'fn.teaching.query');
 }
});
test('grading rejects ambiguity and treats missing answers as wrong',()=>{
 const set=teachingSet();assert.equal(gradeAnswers(set,{answers:[]}).correct,0);
 assert.throws(()=>gradeAnswers(set,{answers:[{id:'q1'},{id:'q1'}]}),/Duplicate/);
 assert.throws(()=>compileLesson({id:'bad',cells:['A'],prior:.2,query:['A'],observations:[{cells:['A'],breeze:true},{cells:['A'],breeze:false}]}),/mass|total/);
});

test('certificate grading separates a correct interpretation from incorrect arithmetic',async()=>{
 const {transferSet,gradeCertificate}=await import('../src/teaching.js');
 const lesson=transferSet()[4],worlds=lesson.posterior.filter(h=>h.weight>0).map(h=>h.pits);
 const result=gradeCertificate(lesson,{retainedWorlds:worlds,evidenceMass:.1278});
 assert.equal(result.compatibleSetCorrect,true);assert.equal(result.evidenceMassCorrect,false);
 assert.ok(Math.abs(result.compiledAnswer-17/24)<1e-12);
 assert.equal(gradeCertificate(lesson,{retainedWorlds:worlds.slice(1),evidenceMass:.216}).compiledAnswer,null);
 const bad=gradeCertificate(lesson,{retainedWorlds:[...worlds,['A','D']],evidenceMass:.216});
 assert.deepEqual(bad.violations[0].cells,['B','C']);
 assert.equal(bad.violations[0].actualBreeze,false);
});
