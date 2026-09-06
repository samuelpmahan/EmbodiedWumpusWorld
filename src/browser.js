import { createSession, demoWorld } from './session.js';
import { materialize } from './tui/materialize.js';
import { breezeExperiment, materializePriors } from './priors.js';

const $ = id => document.getElementById(id);
let session, index = 0, running = false, timer;
function stop() { running = false; clearTimeout(timer); $('run').textContent = 'Run policy [Space]'; }
function report(error) { stop(); $('message').textContent = error.message; }
function prior() {
  const value = Number($('prior').value);
  if (!Number.isFinite(value) || value <= 0 || value >= 1) throw Error('Choose a pit prior greater than 0 and less than 1.');
  return value;
}
function compare() { $('priors').textContent = materializePriors(breezeExperiment(prior())); }
function draw() {
  const frame = session.frames[index];
  const options = {reveal:$('reveal').checked, mode:running ? 'watch' : 'play'};
  $('screen').textContent = materialize(frame,options);
  const detailed = materialize(frame,{...options,inspect:true});
  $('trace').textContent = detailed.slice(detailed.indexOf('PIT BELIEFS'));
  const live = index === session.frames.length-1;
  $('position').textContent = `${index+1} / ${session.frames.length}`;
  $('back').disabled = index === 0; $('next').disabled = live;
  for (const button of document.querySelectorAll('[data-action]')) button.disabled = !live || frame.world.terminal;
  $('step').disabled = !live || frame.world.terminal;
  $('run').disabled = !live || frame.world.terminal;
}
function restart() {
  try {
    const probability = prior(), seed = Number($('seed').value);
    if (!Number.isInteger(seed)) throw Error('Seed must be an integer.');
    const next = createSession({seed, prior:probability, world:$('world').value === 'demo' ? demoWorld() : undefined});
    stop(); session = next; index=0; $('message').textContent=''; compare(); draw();
  } catch(e) { report(e); }
}
function act(action) {
  if (!session || index !== session.frames.length-1 || session.snapshot().world.terminal) return;
  try { stop(); session.act(action); index=session.frames.length-1; draw(); } catch(e) {report(e);}
}
function step() {
  if (index !== session.frames.length-1) return;
  session.auto(); index=session.frames.length-1;
  if (session.frames[index].world.terminal) stop();
  draw();
}
function tick() {
  if (!running) return;
  try {step(); if(running) timer=setTimeout(tick,1650-Number($('speed').value));} catch(e){report(e);}
}
$('restart').onclick=restart;
$('prior').oninput=()=>{try{compare();$('message').textContent='';}catch(e){report(e);}};
$('reveal').onchange=()=>draw();
$('actions').onclick=e=>{const action=e.target.closest('button')?.dataset.action;if(action)act(action);};
$('step').onclick=()=>{try{stop();step();}catch(e){report(e);}};
$('run').onclick=()=>{if(running){stop();draw();}else{running=true;$('run').textContent='Pause [Space]';tick();}};
$('back').onclick=()=>{stop();index=Math.max(0,index-1);draw();};
$('next').onclick=()=>{stop();index=Math.min(session.frames.length-1,index+1);draw();};
$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(session.export())],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wumpus-replay.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  const key=e.key.toLowerCase(), map={f:'forward',l:'turnLeft',r:'turnRight',g:'grab',s:'shoot',c:'climb'};
  if(map[key]){e.preventDefault();act(map[key]);}
  else {const id={n:'step',' ':'run','[':'back',']':'next'}[key];if(id){e.preventDefault();$(id).click();}}
});
restart();
