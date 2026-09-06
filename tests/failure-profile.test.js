import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profileCases,compileProfileCase,profileTask,parseProfileResponse} from '../src/failure-profile.js';

test('integer oracle matches analytic chain probabilities and renamed problem',()=>{
 const [a,b,x]=profileCases.map(compileProfileCase);
 assert.equal(a.numeratorUnits,1530);assert.equal(a.denominatorUnits,2160);
 assert.equal(a.answer,17/24);assert.equal(a.answer,b.answer);
 assert.equal(x.answer,.5);assert.equal(x.worlds.length,2);
});
test('distinguishes propagated bad weights from omitted worlds',()=>{
 const read=name=>parseProfileResponse(readFileSync(new URL(`../experiments/failure-profile/raw/${name}.txt`,import.meta.url),'utf8'));
 const low=profileTask(profileCases[0],read('luna-low').tasks.find(t=>t.id==='familiar'));
 assert.equal(low.earliestFailure,'world-weight');assert.equal(low.flags.worldSet,true);
 assert.equal(low.weightErrors[0].expected,.0081);assert.equal(low.flags.denominatorMatchesOwnLedger,true);assert.equal(low.flags.divisionMatchesOwnTotals,true);
 const med=profileTask(profileCases[0],read('terra-medium').tasks.find(t=>t.id==='familiar'));
 assert.deepEqual(med.missing,[['A','C','D']]);assert.deepEqual(med.extra,[]);
 assert.equal(med.flags.weights,true);assert.equal(med.earliestFailure,'world-set');
});
test('format repair remains diagnostic and never erases protocol failure',()=>{
 const raw=readFileSync(new URL('../experiments/failure-profile/raw/terra-low.txt',import.meta.url),'utf8');
 const parsed=parseProfileResponse(raw);assert.equal(parsed.formatValid,false);assert.equal(parsed.recoveredForDiagnosisOnly,true);assert.equal(parsed.tasks.length,3);
 for(const task of parsed.tasks)assert.equal(profileTask(profileCases.find(c=>c.id===task.id),task).earliestFailure,'none');
});
test('isolates aggregation and division errors with a correct ledger',()=>{
 const spec=profileCases[0],truth=compileProfileCase(spec),task={id:spec.id,confidence:1,worlds:truth.worlds,numerator:truth.numerator,denominator:truth.denominator,answer:truth.answer};
 assert.equal(profileTask(spec,{...task,denominator:.24,answer:.6375}).earliestFailure,'aggregation');
 assert.equal(profileTask(spec,{...task,answer:.8}).earliestFailure,'division');
});
