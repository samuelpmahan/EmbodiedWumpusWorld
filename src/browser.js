import { createSession, demoWorld } from './session.js';
import { breezeExperiment, materializePriors } from './priors.js';
import { explainCell, senseGuide } from './learning.js';
import { createWorkbench } from './browser-workbench.js';

const $ = id => document.getElementById(id);
const names = {cave:'Cave & controls',senses:'Senses & changes',reason:'Square evidence',remember:'Remember Wumpus',prior:'Prior experiment',trace:'PxC & Tick trace',decision:'Why that move?',counterfactual:'Alternate prior & branches',materials:'PxC material lineage'};
const presets = {remember:['cave','remember','senses'],play:['cave','reason','senses'],inspect:['cave','materials','trace'],debug:['cave','decision','counterfactual']};
let views = [...presets.remember], session, index=0, running=false, timer, selected=[1,1], workbench, branches=[];
const panels = Object.fromEntries([...document.querySelectorAll('[data-panel]')].map(p=>[p.dataset.panel,p]));
const slots = [...document.querySelectorAll('.slot')];
function arrange(save=true) {
  Object.values(panels).forEach(p=>$('panels').append(p));
  slots.forEach((slot,i)=>{slot.querySelector('.mount').append(panels[views[i]]);slot.querySelector('select').value=views[i];});
  if(save)try{localStorage.setItem('wumpus-views-v1',JSON.stringify(views));}catch{}
}
slots.forEach((slot,i)=>{
  const picker=slot.querySelector('select');
  Object.entries(names).forEach(([value,label])=>picker.add(new Option(label,value)));
  picker.onchange=()=>{const other=views.indexOf(picker.value);if(other!==-1)views[other]=views[i];views[i]=picker.value;$('layout').value='custom';arrange();};
});
try{const saved=JSON.parse(localStorage.getItem('wumpus-views-v1'));if(Array.isArray(saved)&&saved.length===3&&new Set(saved).size===3&&saved.every(v=>Object.hasOwn(names,v))){views=saved;$('layout').value='custom';}}catch{}
arrange(false);
$('layout').onchange=()=>{if(presets[$('layout').value]){views=[...presets[$('layout').value]];arrange();}};
function mobileSlot(n){slots.forEach((s,i)=>s.classList.toggle('mobile-hidden',i!==n));document.querySelectorAll('#mobile-tabs button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===n)));}
$('mobile-tabs').onclick=e=>{const b=e.target.closest('button');if(b)mobileSlot(Number(b.dataset.slot));};mobileSlot(0);
$('settings-toggle').onclick=()=>{$('settings').hidden=!$('settings').hidden;$('settings-toggle').setAttribute('aria-expanded',String(!$('settings').hidden));};
function stop(){running=false;clearTimeout(timer);$('run').textContent='Run policy';}
function report(e){stop();$('message').textContent=e.message;}
function compare(){const p=Number($('experiment-prior').value)/100,result=breezeExperiment(p);$('prior-label').textContent=`${Math.round(p*100)}%`;$('posterior').textContent=`${(result.probabilityA*100).toFixed(1)}% pit in A`;$('prior-explanation').textContent=`Before the breeze: ${Math.round(p*100)}%. After it: ${(result.probabilityA*100).toFixed(1)}%. The clue rules out “neither.” The remaining possibilities keep their relative weights.`;$('priors').textContent=materializePriors(result);}
function evidence(frame){const info=explainCell(frame,selected);$('cell-title').textContent=`What do I know at (${selected})?`;$('risk').textContent=info.probability===null?'Unknown':`${(info.probability*100).toFixed(1)}% pit`;$('cell-summary').textContent=info.summary;$('evidence').replaceChildren(...info.evidence.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));}
function draw(){
  const frame=session.frames[index], w=frame.world, a=w.agent, b=frame.policy.belief;
  const live=index===session.frames.length-1;
  workbench?.prepare(frame);
  $('stats').replaceChildren(...[`Turn ${w.turn}`,`Score ${w.score}`,a.heading,`Arrow ${a.hasArrow?'1':'0'}`,a.hasGold?'Gold collected':'No gold'].map(t=>{const el=document.createElement('span');el.textContent=t;return el;}));
  const board=$('board');board.style.gridTemplateColumns=`repeat(${w.size},1fr)`;board.replaceChildren();
  const visited=new Set(frame.policy.visited.map(p=>p.join(',')));
  for(let y=w.size;y>=1;y--)for(let x=1;x<=w.size;x++){
    const key=`${x},${y}`,here=a.x===x&&a.y===y,seen=visited.has(key),button=document.createElement('button');
    let symbol=seen?'·':'?';
    if($('reveal').checked){symbol='·';if(w.pits.some(p=>p.x===x&&p.y===y))symbol='P';if(w.wumpus.x===x&&w.wumpus.y===y)symbol=w.wumpus.alive?'W':'w';if(w.gold.x===x&&w.gold.y===y&&!w.gold.grabbed)symbol='G';}
    if(here)symbol=a.alive?({east:'→',west:'←',north:'↑',south:'↓'}[a.heading]):'×';
    button.className=`cell${seen?' visited':''}${here?' here':''}${selected.join(',')===key?' selected':''}`;
    button.setAttribute('aria-label',`Square ${key}, ${here?'you are here':seen?'visited':'unexplored'}${$('reveal').checked?`, revealed ${symbol}`:''}`);button.setAttribute('aria-pressed',String(selected.join(',')===key));
    const heat=workbench?.map([x,y]);
    if(heat&&!$('reveal').checked){button.classList.add('risk-map');button.style.setProperty('--risk',heat.risk);if(!here)symbol=heat.text;button.setAttribute('aria-label',`${button.getAttribute('aria-label')}, ${heat.label}`);}
    button.append(document.createTextNode(symbol));const coord=document.createElement('small');coord.textContent=key;button.append(coord);
    button.onclick=()=>{selected=[x,y];if(!views.includes('reason')){views[1]='reason';$('layout').value='custom';arrange();}draw();if(matchMedia('(max-width:700px)').matches)mobileSlot(views.indexOf('reason'));};board.append(button);
  }
  $('legend').textContent=$('reveal').checked?'OBSERVER REVEAL · P pit · W live Wumpus · w dead Wumpus · G gold':({explored:'? unexplored · · visited · arrow = you',pit:'Pit probability given recorded observations · arrow = you',wumpus:'Wumpus LOCATION probability · a scream removes danger, not location',delta:'Alternate minus actual pit probability, in percentage points'}[$('map-mode').value]);
  $('senses').replaceChildren(...(w.terminal ? ['The run has ended. No new observation is being added to the belief model.'] : senseGuide(frame.percept)).map(t=>{const p=document.createElement('p');p.className='sense';p.textContent=t;return p;}));
  const previous=session.frames[index-1],count=b.candidates.length,old=previous?.policy.belief.candidates.length;
  $('change').textContent=w.terminal?`Run ended: ${w.outcome}. Final score ${w.score}. Beliefs below remain the last live estimate. Use the arrows to revisit your decisions.`:previous?`${w.lastAction}: ${old-count} pit layouts ruled out; ${count.toLocaleString()} remain consistent with your observations.${frame.percept.bump?' You hit a wall and stayed in place.':''}`:`Your first observation has already updated the starting ${(b.pitPrior*100).toFixed(0)}% pit prior. ${count.toLocaleString()} pit layouts remain possible. Try Forward, then compare the clues.`;
  if(frame.decision)$('change').textContent+=` Recorded decision: ${frame.decision.advice.reason}`;
  evidence(frame);
  workbench?.draw(frame);
  $('trace').textContent=frame.records.map(r=>`${r.id}\nRead: ${(r.actualConsumes??r.consumes).join(', ')}\nWrote: ${(r.actualProduces??r.produces).join(', ')}\nCalculations: ${(r.calculations??[]).map(c=>c.address).join(', ')||'policy closure (not a registered calculation)'}\n`).join('\n');
  $('position').textContent=`Frame ${index+1} / ${session.frames.length}`;$('timeline-state').textContent=live?(w.terminal?'Finished':running?'Policy running':'Live · your move'):'Replay · next → to return';
  $('back').disabled=index===0;$('next').disabled=live;
  document.querySelectorAll('[data-action],#step,#run').forEach(button=>button.disabled=!live||w.terminal);
}
function restart(){try{const prior=Number($('prior').value),seed=Number($('seed').value);if(!Number.isFinite(prior)||prior<=0||prior>=1)throw Error('Pit prior must be between 0 and 1, excluding endpoints.');if(!Number.isInteger(seed))throw Error('Seed must be an integer.');const next=createSession({seed,prior,world:$('world').value==='demo'?demoWorld():undefined});stop();session=next;branches=[{session,name:'Original'}];$('branch').replaceChildren(new Option('Original','0'));index=0;selected=[1,1];$('message').textContent='';draw();}catch(e){report(e);}}
function act(action,options){if(index!==session.frames.length-1||session.frames[index].world.terminal)return;try{stop();session.act(action,options);index=session.frames.length-1;draw();}catch(e){report(e);}}
function step(){if(index!==session.frames.length-1||session.frames[index].world.terminal)return;if($('driver').value==='advisor'){const recommendation=workbench.advice(session.frames[index]);if(!recommendation.action){stop();$('message').textContent=recommendation.reason;return;}session.act(recommendation.action,{decision:workbench.decision(session.frames[index])});}else session.auto();index=session.frames.length-1;if(session.frames[index].world.terminal)stop();draw();}
function tick(){if(!running)return;try{step();if(running)timer=setTimeout(tick,1650-Number($('speed').value));}catch(e){report(e);}}
$('restart').onclick=restart;$('experiment-prior').oninput=compare;$('reveal').onchange=draw;
$('actions').onclick=e=>{const action=e.target.closest('button')?.dataset.action;if(action)act(action);};
$('step').onclick=()=>{try{stop();step();}catch(e){report(e);}};
$('run').onclick=()=>{if(running){stop();draw();}else{running=true;$('run').textContent='Pause policy';tick();}};
$('back').onclick=()=>{stop();index=Math.max(0,index-1);draw();};$('next').onclick=()=>{stop();index=Math.min(session.frames.length-1,index+1);draw();};
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(session.export())],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='wumpus-replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase(),map={f:'forward',l:'turnLeft',r:'turnRight',g:'grab',s:'shoot',c:'climb'};if(map[key]){e.preventDefault();act(map[key]);}else{const id={n:'step',' ':'run','[':'back',']':'next'}[key];if(id){e.preventDefault();$(id).click();}}});
workbench=createWorkbench({getFrame:()=>session.frames[index],getSelected:()=>selected,isLive:()=>index===session.frames.length-1,act,onRedraw:()=>{try{stop();draw();}catch(e){report(e);}},selectCell:cell=>{selected=[...cell];draw();},fork:prior=>{try{stop();const next=session.fork(index,{prior}),name=`Branch ${branches.length} · frame ${index} · prior ${Math.round(prior*100)}%`;branches.push({session:next,name});$('branch').add(new Option(name,String(branches.length-1)));$('branch').value=String(branches.length-1);session=next;index=session.frames.length-1;$('branch-note').textContent='Same cave and action history. You can now choose a different future.';draw();}catch(e){report(e);}}});
$('branch').onchange=()=>{stop();session=branches[Number($('branch').value)].session;index=session.frames.length-1;draw();};
compare();restart();
