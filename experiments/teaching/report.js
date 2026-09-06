import {readFileSync} from 'node:fs';
import {teachingSet,transferSet,gradeAnswers,gradeCertificate} from '../../src/teaching.js';
const data=JSON.parse(readFileSync(new URL('./responses.json',import.meta.url),'utf8'));
const baseline=teachingSet(),transfer=transferSet();
console.log(JSON.stringify({pilot:{baseline:gradeAnswers(baseline,data.pilot.baseline),transfer:gradeAnswers(transfer,data.pilot.transfer)},cohort:data.cohort.map(run=>({id:run.id,model:run.model,effort:run.effort,baseline:gradeAnswers(baseline,run.baseline),transfer:gradeAnswers(transfer,run.transfer),certificate:gradeCertificate(transfer[4],run.certificate)}))},null,2));
