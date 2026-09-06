import { investigate } from './investigation.js';
import { traceAddress } from './core/provenance.js';
const $=id=>document.getElementById(id),pct=p=>`${(p*100).toFixed(1)}%`;
const cache=new WeakMap();
function decisionRecord(inquiry){return {kind:'reasoning-explorer',advice:inquiry.advice,assumptions:inquiry.pxc.get('px.assumptions'),records:inquiry.records};}
function calculation(frame,prior,risk){
  let entries=cache.get(frame);if(!entries){entries=new Map();cache.set(frame,entries);}
  const key=`${prior}:${risk}`;
  if(!entries.has(key)){if(entries.size>=6)entries.delete(entries.keys().next().value);entries.set(key,investigate(frame,{pitPrior:prior,riskTolerance:risk}));}
  return entries.get(key);
}
function compact(value){return JSON.stringify(value,(key,v)=>Array.isArray(v)&&v.length>40?{count:v.length,first40:v.slice(0,40)}:v,2);}
export function createWorkbench({getFrame,getSelected,isLive,act,fork,onRedraw,selectCell}){
  let current,alternate;
  const risk=()=>Number($('risk-limit').value)/100;
  function prepare(frame){
    current=calculation(frame,frame.policy.belief.pitPrior,risk());
    alternate=calculation(frame,Number($('alternate-prior').value)/100,risk());
    return {current,alternate};
  }
  function showMaterial(){
    if(!current)return;
    const address=$('material').value;
    const tree=traceAddress(current.records,address);
    const node=(entry,depth=0)=>{
      const div=document.createElement('div');div.className='lineage-node';
      const label=document.createElement('button');label.textContent=entry.address;
      label.onclick=()=>{$('material-value').textContent=compact(entry.value);$('material-value').parentElement.open=true;};div.append(label);
      const note=document.createElement('small');note.textContent=entry.producer?`${entry.producer.id} · ${(entry.calculations??[]).join(', ')||'materialized input'}`:'Supplied material · no earlier writer';div.append(note);
      if(depth<8)(entry.inputs??[]).forEach(child=>div.append(node(child,depth+1)));
      return div;
    };
    $('lineage').replaceChildren(node(tree));$('material-value').textContent=compact(current.pxc.has(address)?current.pxc.get(address):null);
  }
  function draw(frame){
    prepare(frame);
    const {advice,analysis}=current,cell=getSelected(),key=cell.join(','),original=analysis.pitProbabilities[key]??0,changed=alternate.analysis.pitProbabilities[key]??0;
    $('risk-limit-label').textContent=pct(risk());$('alternate-label').textContent=pct(alternate.analysis.pitPrior);
    $('advice-action').textContent=frame.world.terminal?'Run finished':advice.action??'No action';$('advice-reason').textContent=advice.reason;
    $('execute-advice').disabled=!isLive()||frame.world.terminal||!advice.action;
    const table=document.createElement('table'),head=document.createElement('thead');head.innerHTML='<tr><th>Square</th><th>Pit</th><th>Wumpus danger</th><th>Bound</th><th>Budget</th></tr>';table.append(head);
    const body=document.createElement('tbody');
    for(const candidate of advice.candidates){const row=document.createElement('tr');if(candidate.cell.join(',')===key)row.className='chosen';const celltd=document.createElement('td'),button=document.createElement('button');button.textContent=`(${candidate.cell})`;button.onclick=()=>selectCell(candidate.cell);celltd.append(button);row.append(celltd);for(const text of [pct(candidate.pitRisk),pct(candidate.wumpusRisk),pct(candidate.risk),candidate.risk<=risk()?'pass':'fail']){const td=document.createElement('td');td.textContent=text;row.append(td);}row.title=candidate.reason??'';body.append(row);}table.append(body);$('candidates').replaceChildren(table);
    const selection=`${key}:${frame.recordEnd}:${analysis.pitPrior}:${risk()}`;
    if(current.selectionKey!==selection||!current.pxc.has('px.constraint.travel')){current.inspectCandidate(cell);current.selectionKey=selection;}
    const evaluation=current.pxc.get('px.constraint.travel');$('constraint-result').textContent=`${evaluation.status.toUpperCase()} · ${evaluation.reason}`;
    $('comparison-context').textContent=`Frame ${frame.world.turn} · ${analysis.observations.length} fixed observations · square (${cell}) · ${analysis.remaining.toLocaleString()} consistent pit layouts`;
    $('comparison-values').replaceChildren(...[['Actual prior',analysis.pitPrior,original],['Alternate prior',alternate.analysis.pitPrior,changed]].map(([label,p,value])=>{const div=document.createElement('div');div.textContent=`${label} ${pct(p)}`;const strong=document.createElement('strong');strong.textContent=pct(value);div.append(strong,document.createTextNode(`pit at (${cell})`));return div;}));
    $('comparison-decision').textContent=`Reasoning explorer: ${advice.action??'wait'} → ${alternate.advice.action??'wait'} with the alternate prior. ${alternate.advice.reason}`;
    $('fork').disabled=frame.world.terminal;
    showMaterial();
  }
  let debounce;
  $('alternate-prior').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(onRedraw,150);};
  $('risk-limit').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(onRedraw,150);};
  $('material').onchange=showMaterial;$('map-mode').onchange=onRedraw;
  $('execute-advice').onclick=()=>{if(isLive()){prepare(getFrame());if(current.advice.action)act(current.advice.action,{decision:decisionRecord(current)});}};
  $('fork').onclick=()=>fork(Number($('alternate-prior').value)/100);
  return {draw,prepare,decision(frame){return decisionRecord(calculation(frame,frame.policy.belief.pitPrior,risk()));},advice(frame){return calculation(frame,frame.policy.belief.pitPrior,risk()).advice;},map(cell){const k=cell.join(','),mode=$('map-mode').value;if(!current||mode==='explored')return null;let p=mode==='wumpus'?(current.analysis.wumpusLocationProbabilities[k]??0):(current.analysis.pitProbabilities[k]??0);if(mode==='delta'){p=(alternate.analysis.pitProbabilities[k]??0)-p;return {text:`${p>=0?'+':''}${(p*100).toFixed(0)}`,risk:Math.abs(p),label:`pit probability change ${(p*100).toFixed(1)} percentage points`};}return {text:`${(p*100).toFixed(0)}%`,risk:p,label:`${mode} probability ${pct(p)}`};}};
}
