/*
  SlidFix calculator prototype
  IMPORTANT:
  The current fastener spacing and placement algorithm is a UX/demo model.
  It must not be treated as final installation engineering guidance until SlidFix engineering rules are validated.
*/
const ENGINEERING = {
  packSize: 10,
  screwsPerUnit: 2,
  standardVerticalPitchMm: 500,
  denseVerticalPitchMm: 350,
  edgeClearanceMm: 180,
  openingClearanceMm: 110,
};

const state = {
  preset: 'window-center',
  pattern: 'standard',
  density: 'standard',
  wallWidth: 6.0,
  wallHeight: 2.8,
  boardWidth: 125,
  battenSpacing: 600,
  openingWidth: 1.8,
  openingHeight: 1.2,
};

const $ = (id) => document.getElementById(id);
const svg = $('wallSvg');
const NS = 'http://www.w3.org/2000/svg';
// Keep machine-readable state keys stable; localize only presentation strings.
const PATTERN_LABELS = {standard:'стандартная', staggered:'шахматная'};
const DENSITY_LABELS = {standard:'стандартная', dense:'усиленная'};
const numberFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits:6, useGrouping:false});
const dimensionFormat = new Intl.NumberFormat('ru-RU', {minimumFractionDigits:1, maximumFractionDigits:1, useGrouping:false});
const formatNumber = value => numberFormat.format(Number(value));
const formatDimension = value => dimensionFormat.format(value);
const DEMO_WARNING = 'Предварительный расчёт. Текущие параметры шага и расстановки используются для демонстрации работы калькулятора и будут уточнены после утверждения инженерного регламента SlidFix.';

// These bounds only keep the preset geometry inside the wall; they are not installation rules.
function syncOpeningInputs(editingId=null){
  const W=state.wallWidth,H=state.wallHeight;
  const door=state.preset.startsWith('door');
  const two=state.preset==='two-windows';
  const maxWidth=Math.min(8,W*(door?.28:two?.22:.75));
  const maxHeight=Math.min(5,H*(door?.88:two?.42:.55));
  ['openingWidth','openingHeight'].forEach((id,index)=>{
    const input=$(id), max=index===0?maxWidth:maxHeight;
    input.min=String(Math.min(.3,max));
    input.max=String(max);
    input.step='any';
    input.disabled=state.preset==='blank';
    state[id]=Number(clamp(state[id],Number(input.min),max).toFixed(6));
    if(id!==editingId) input.value=state[id];
  });
  $('openingFields').hidden=state.preset==='blank';
}


function el(tag, attrs = {}, parent = svg) {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k, v));
  if (parent) parent.appendChild(n);
  return n;
}
function text(x,y,str,attrs={}){
  const t=el('text',{x,y,fill:'#dfe5e9','font-size':attrs.size||14,'font-family':'Inter,system-ui,sans-serif','font-weight':attrs.weight||600,'text-anchor':attrs.anchor||'start'});
  t.textContent=str; return t;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

function getOpenings(){
  const W=state.wallWidth,H=state.wallHeight;
  const ow=state.openingWidth,oh=state.openingHeight;
  if(state.preset==='blank') return [];
  if(state.preset==='window-center') return [{x:(W-ow)/2,y:H*.26,w:ow,h:oh,kind:'window'}];
  if(state.preset==='door-left') return [{x:W*.08,y:0,w:ow,h:oh,kind:'door'}];
  if(state.preset==='door-center') return [{x:(W-ow)/2,y:0,w:ow,h:oh,kind:'door'}];
  if(state.preset==='two-windows'){
    return [
      {x:W*.14,y:H*.30,w:ow,h:oh,kind:'window'},
      {x:W*.64,y:H*.30,w:ow,h:oh,kind:'window'}
    ];
  }
  return [];
}

function pointInsideOpening(x,y,o,clearM){
  return x>o.x-clearM && x<o.x+o.w+clearM && y>o.y-clearM && y<o.y+o.h+clearM;
}

function calculateLayout(){
  const Wmm=state.wallWidth*1000,Hmm=state.wallHeight*1000;
  const edge=ENGINEERING.edgeClearanceMm;
  const pitchX=state.battenSpacing;
  const pitchY=state.density==='dense'?ENGINEERING.denseVerticalPitchMm:ENGINEERING.standardVerticalPitchMm;
  const openings=getOpenings();
  const clear=ENGINEERING.openingClearanceMm/1000;
  const pts=[];
  let row=0;
  for(let y=edge; y<=Hmm-edge; y+=pitchY,row++){
    const offset=(state.pattern==='staggered' && row%2===1)?pitchX/2:0;
    for(let x=edge+offset; x<=Wmm-edge; x+=pitchX){
      const xm=x/1000,ym=y/1000;
      if(!openings.some(o=>pointInsideOpening(xm,ym,o,clear))) pts.push({x:xm,y:ym});
    }
  }
  return {points:pts,pitchX,pitchY,openings};
}

function drawWall(){
  svg.innerHTML='';
  el('title').textContent='Схема расположения креплений SlidFix';
  el('desc').textContent=DEMO_WARNING;
  const {points,openings}=calculateLayout();
  const VW=1000,VH=540;
  const pad={l:72,r:34,t:60,b:54};
  const availableW=VW-pad.l-pad.r,availableH=VH-pad.t-pad.b;
  const scale=Math.min(availableW/state.wallWidth,availableH/state.wallHeight);
  const w=state.wallWidth*scale,h=state.wallHeight*scale;
  const x0=pad.l+(availableW-w)/2,y0=pad.t+(availableH-h)/2;
  const sx=scale,sy=scale;
  // Explicit background also travels with the standalone SVG export.
  el('rect',{width:VW,height:VH,fill:'#0b1115'});
  const wall=(x)=>x0+x*sx, wy=(y)=>y0+h-y*sy;

  // defs / wood texture
  const defs=el('defs');
  const grad=el('linearGradient',{id:'wood','x1':'0','y1':'0','x2':'1','y2':'0'},defs);
  el('stop',{offset:'0%','stop-color':'#8e5f38'},grad); el('stop',{offset:'45%','stop-color':'#bd8753'},grad); el('stop',{offset:'100%','stop-color':'#9c6a3e'},grad);
  const shadow=el('filter',{id:'shadow',x:'-20%',y:'-20%',width:'140%',height:'140%'},defs); el('feDropShadow',{dx:'0',dy:'8',stdDeviation:'10','flood-color':'#000','flood-opacity':'.4'},shadow);

  el('rect',{x:x0,y:y0,width:w,height:h,rx:4,fill:'url(#wood)',stroke:'#65717a','stroke-width':1,filter:'url(#shadow)'});
  // vertical cladding boards purely visual
  const boardM=state.boardWidth/1000;
  for(let bx=boardM;bx<state.wallWidth;bx+=boardM){
    const X=wall(bx); el('line',{x1:X,y1:y0,x2:X,y2:y0+h,stroke:'#6d472b','stroke-opacity':.52,'stroke-width':1});
  }
  // grain lines
  for(let i=0;i<18;i++){
    const gy=y0+((i+1)/(19))*h;
    el('path',{d:`M ${x0} ${gy} C ${x0+w*.24} ${gy-4} ${x0+w*.55} ${gy+5} ${x0+w} ${gy-2}`,fill:'none',stroke:'#d4a16b','stroke-opacity':.10,'stroke-width':2});
  }

  // openings
  openings.forEach(o=>{
    const ox=wall(o.x), oy=wy(o.y+o.h), ow=o.w*sx, oh=o.h*sy;
    el('rect',{x:ox,y:oy,width:ow,height:oh,fill:o.kind==='door'?'#10171c':'#1c2730',stroke:'#090d10','stroke-width':9,rx:2});
    if(o.kind==='window'){
      el('line',{x1:ox+ow/2,y1:oy+4,x2:ox+ow/2,y2:oy+oh-4,stroke:'#0b1115','stroke-width':5});
      el('path',{d:`M${ox+8} ${oy+oh*.7} Q ${ox+ow*.3} ${oy+oh*.45} ${ox+ow*.55} ${oy+oh*.66} T ${ox+ow-8} ${oy+oh*.54}`,fill:'none',stroke:'#496779','stroke-opacity':.5,'stroke-width':2});
    } else {
      el('circle',{cx:ox+ow*.82,cy:oy+oh*.5,r:5,fill:'#bfc8cf'});
    }
  });

  // placement points
  points.forEach(p=>{
    const X=wall(p.x),Y=wy(p.y);
    el('circle',{cx:X,cy:Y,r:6.4,fill:'#f4f6f7',stroke:'#ff302a','stroke-width':3});
    el('circle',{cx:X,cy:Y,r:1.8,fill:'#ff302a'});
  });

  // dimensions
  const dimY=y0-24; el('line',{x1:x0,y1:dimY,x2:x0+w,y2:dimY,stroke:'#d6dde2','stroke-width':1.4});
  el('path',{d:`M${x0} ${dimY} l10 -5 l0 10 z M${x0+w} ${dimY} l-10 -5 l0 10 z`,fill:'#d6dde2'});
  text(x0+w/2,dimY-8,`${formatDimension(state.wallWidth)} м`,{anchor:'middle',size:15});
  const dimX=x0-28; el('line',{x1:dimX,y1:y0,x2:dimX,y2:y0+h,stroke:'#d6dde2','stroke-width':1.4});
  el('path',{d:`M${dimX} ${y0} l-5 10 l10 0 z M${dimX} ${y0+h} l-5 -10 l10 0 z`,fill:'#d6dde2'});
  const ht=text(dimX-10,y0+h/2,`${formatDimension(state.wallHeight)} м`,{anchor:'middle',size:14}); ht.setAttribute('transform',`rotate(-90 ${dimX-10} ${y0+h/2})`);

  // bottom legend
  text(pad.l,VH-19,`SlidFix: ${points.length} шт. · ${PATTERN_LABELS[state.pattern]} · ${DENSITY_LABELS[state.density]} · ПРЕДВАРИТЕЛЬНАЯ СХЕМА`,{size:12,weight:500});
  updateResults(points.length, openings);
}

function updateResults(unitCount,openings){
  const gross=state.wallWidth*state.wallHeight;
  const openingArea=openings.reduce((s,o)=>s+o.w*o.h,0);
  const net=Math.max(0,gross-openingArea);
  const packs=Math.ceil(unitCount/ENGINEERING.packSize);
  const screws=unitCount*ENGINEERING.screwsPerUnit;
  const courses=Math.ceil((state.wallHeight*1000)/state.boardWidth);
  $('grossArea').textContent=`${formatDimension(gross)} м²`; $('grossDims').textContent=`${formatDimension(state.wallWidth)} × ${formatDimension(state.wallHeight)} м`;
  $('netArea').textContent=`${formatDimension(net)} м²`; $('boardCourses').textContent=courses; $('boardCourseNote').textContent=`доска ${formatNumber(state.boardWidth)} мм`;
  $('unitCount').textContent=unitCount; $('packCount').textContent=packs; $('screwCount').textContent=screws;
  $('cartBtn').textContent=`${packs} уп. · КОРЗИНА НЕ ПОДКЛЮЧЕНА`;
  $('miniPattern').textContent=`${PATTERN_LABELS[state.pattern].toUpperCase()} · ${DENSITY_LABELS[state.density].toUpperCase()} · сетка ${formatNumber(state.battenSpacing)} мм`;
}

const inputIds=['wallWidth','wallHeight','boardWidth','battenSpacing','openingWidth','openingHeight'];
inputIds.forEach(id=>{
  const input=$(id);
  input.addEventListener('input',()=>{
    const value=input.valueAsNumber;
    if(!Number.isFinite(value) || value<Number(input.min) || value>Number(input.max)){
      input.setAttribute('aria-invalid','true');
      $('inputMessage').textContent=`Введите значение от ${formatNumber(input.min)} до ${formatNumber(input.max)}. Пока отображается последнее корректное значение.`;
      return;
    }
    input.removeAttribute('aria-invalid');
    $('inputMessage').textContent='';
    state[id]=value;
    syncOpeningInputs(id);
    drawWall();
  });
  input.addEventListener('blur',()=>{
    if(Number.isFinite(input.valueAsNumber)) state[id]=clamp(input.valueAsNumber,Number(input.min),Number(input.max));
    input.value=state[id];
    input.removeAttribute('aria-invalid');
    $('inputMessage').textContent='';
    syncOpeningInputs();
    drawWall();
  });
});

function selectOption(attribute,value){
  document.querySelectorAll(`[data-${attribute}]`).forEach(button=>{
    const selected=button.dataset[attribute]===value;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
['preset','pattern','density'].forEach(attribute=>{
  selectOption(attribute,state[attribute]);
  document.querySelectorAll(`[data-${attribute}]`).forEach(button=>button.addEventListener('click',()=>{
    const wasDoor=state.preset.startsWith('door');
    state[attribute]=button.dataset[attribute];
    // Keep a door-like default when changing from a window to a door; all sizes remain editable.
    if(attribute==='preset' && state.preset.startsWith('door') && !wasDoor) state.openingHeight=2.1;
    selectOption(attribute,state[attribute]);
    syncOpeningInputs();
    drawWall();
  }));
});

$('downloadSvgBtn').addEventListener('click',()=>{
  const clone=svg.cloneNode(true);clone.setAttribute('xmlns',NS);
  const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='slidfix-wall-layout.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
$('downloadJsonBtn').addEventListener('click',()=>{
  const layout=calculateLayout();
  const data={brand:'SlidFix',warning:DEMO_WARNING,generatedAt:new Date().toISOString(),state,engineeringDemoConstants:ENGINEERING,openings:layout.openings,unitCount:layout.points.length,packs:Math.ceil(layout.points.length/ENGINEERING.packSize),screws:layout.points.length*ENGINEERING.screwsPerUnit,points:layout.points};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='slidfix-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
syncOpeningInputs();
drawWall();
