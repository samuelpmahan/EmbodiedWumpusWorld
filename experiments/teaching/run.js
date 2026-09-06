import {readFileSync} from 'node:fs';
import {teachingSet,transferSet,renderLesson,gradeAnswers,gradeCertificate} from '../../src/teaching.js';
const [command='lesson',argument='baseline',phase='baseline']=process.argv.slice(2);
const set=name=>{if(name==='baseline')return teachingSet();if(name==='transfer')return transferSet();throw Error('Phase must be baseline or transfer.');};
if(command==='lesson')console.log(set(argument).map(renderLesson).join('\n\n'));
else if(command==='packet')console.log(JSON.stringify({instructions:'Independent pit priors. Perfect breeze means at least one pit in the named set. All observations refer to one static world. Return numeric probabilities by id; for q5 also list all compatible pit assignments and their total prior mass.',questions:set(argument).map(l=>l.spec)},null,2));
else if(command==='grade')console.log(JSON.stringify(gradeAnswers(set(phase),JSON.parse(readFileSync(argument,'utf8'))),null,2));
else if(command==='certificate')console.log(JSON.stringify(gradeCertificate(set(phase)[4],JSON.parse(readFileSync(argument,'utf8'))),null,2));
else throw Error('Commands: lesson [phase], packet [phase], grade file [phase], certificate file [phase]');
