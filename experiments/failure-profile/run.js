import {readFileSync} from 'node:fs';
import {profileCases,parseProfileResponse,profileTask} from '../../src/failure-profile.js';
const report=['luna-low','luna-medium','terra-low','terra-medium'].map(id=>{
 const parsed=parseProfileResponse(readFileSync(new URL('./raw/'+id+'.txt',import.meta.url),'utf8'));
 return {id,model:id.startsWith('luna')?'gpt-5.6-luna':'gpt-5.6-terra',effort:id.endsWith('medium')?'medium':'low',formatValid:parsed.formatValid,parseError:parsed.error??null,recoveredForDiagnosisOnly:parsed.recoveredForDiagnosisOnly??false,tasks:parsed.tasks.map(t=>profileTask(profileCases.find(c=>c.id===t.id),t))};
});
console.log(JSON.stringify(report,null,2));
