/*
  SlidFix calculator prototype
  IMPORTANT:
  These values are UX/demo assumptions only.
  They are not validated SlidFix engineering installation rules.
  The current fastener spacing and placement algorithm is a UX/demo model.
  It must not be treated as final installation engineering guidance until SlidFix engineering rules are validated.
*/
const ENGINEERING = {
  packSize: 10,
  screwsPerUnit: 2,
  defaultLagSpacingMm: 600,
  minLagSpacingMm: 400,
  maxLagSpacingMm: 600,
  lagWidthMm: 50,
  defaultBoardThicknessMm: 20,
  edgeClearanceMm: 180,
  openingClearanceMm: 110, // Temporary UX/demo clearance, not a validated installation rule.
  openingSideInsetMm: 180,
  openingTopInsetMm: 180,
  minOpeningWidthMm: 200,
  minOpeningHeightMm: 300,
  minMullionWidthMm: 100,
  defaultWindowSillHeightMm: 800,
  defaultMullionWidthMm: 1200,
  defaultDoorHeightMm: 2100,
};

const state = {
  preset: 'window-center',
  pattern: 'standard',
  boardOrientation: 'horizontal',
  wallWidth: 6.0,
  wallHeight: 2.8,
  boardWidthMm: 125,
  lagSpacingMm: ENGINEERING.defaultLagSpacingMm,
  // Board thickness is currently stored as a project parameter but does not change quantity until validated SlidFix engineering rules are supplied.
  boardThicknessMm: ENGINEERING.defaultBoardThicknessMm,
  openingWidth: 1.8,
  openingHeight: 1.2,
  sillHeightMm: ENGINEERING.defaultWindowSillHeightMm,
  mullionWidthMm: ENGINEERING.defaultMullionWidthMm,
};

const $ = (id) => document.getElementById(id);
const svg = $('wallSvg');
const NS = 'http://www.w3.org/2000/svg';
// Keep machine-readable state keys stable; localize only presentation strings.
const PATTERN_LABELS = {standard:'стандартная', staggered:'шахматная'};
const ORIENTATION_LABELS = {vertical:'вертикальная', horizontal:'горизонтальная'};
const numberFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits:6, useGrouping:false});
const dimensionFormat = new Intl.NumberFormat('ru-RU', {minimumFractionDigits:1, maximumFractionDigits:1, useGrouping:false});
const formatNumber = value => numberFormat.format(Number(value));
const formatDimension = value => dimensionFormat.format(value);
const DEMO_WARNING = 'Предварительный расчёт. Текущие параметры шага и расстановки используются для демонстрации работы калькулятора и будут уточнены после утверждения инженерного регламента SlidFix.';

const FIELD_LABELS = {
  wallWidth:'ширина стены', wallHeight:'высота стены', boardWidthMm:'ширина доски',
  lagSpacingMm:'шаг лаг',
  openingWidth:'ширина проёма', openingHeight:'высота проёма',
  sillHeightMm:'высота подоконной зоны', mullionWidthMm:'ширина простенка',
};
const numericIds=Object.keys(FIELD_LABELS);
const round=value=>Math.round(value*1e6)/1e6;
const EPSILON=1e-7;

// UI geometry constraints are distinct from unvalidated engineering assumptions.
function inputBounds(){
  const availableWidth=state.wallWidth*1000-2*ENGINEERING.openingSideInsetMm;
  const availableHeight=state.wallHeight*1000-ENGINEERING.openingTopInsetMm;
  const two=state.preset==='two-windows';
  return {
    wallWidth:[1,30], wallHeight:[1,10], boardWidthMm:[50,500],
    lagSpacingMm:[ENGINEERING.minLagSpacingMm,ENGINEERING.maxLagSpacingMm],
    openingWidth:[ENGINEERING.minOpeningWidthMm/1000,(two?(availableWidth-ENGINEERING.minMullionWidthMm)/2:availableWidth)/1000],
    openingHeight:[ENGINEERING.minOpeningHeightMm/1000,availableHeight/1000],
    sillHeightMm:[0,availableHeight-ENGINEERING.minOpeningHeightMm],
    mullionWidthMm:[ENGINEERING.minMullionWidthMm,availableWidth-2*ENGINEERING.minOpeningWidthMm],
  };
}

function normalizeState(editedId=null){
  const adjusted=new Set();
  function limit(id,min,max){
    const next=round(clamp(state[id],min,max));
    if(Math.abs(next-state[id])>EPSILON) adjusted.add(id);
    state[id]=next;
  }
  ['wallWidth','wallHeight','boardWidthMm','lagSpacingMm'].forEach(id=>limit(id,...inputBounds()[id]));
  if(state.preset!=='blank'){
    const bounds=inputBounds();
    const openingFields=['openingWidth','openingHeight'];
    if(!state.preset.startsWith('door')) openingFields.push('sillHeightMm');
    if(state.preset==='two-windows') openingFields.push('mullionWidthMm');
    openingFields.forEach(id=>limit(id,...bounds[id]));
    if(state.preset==='two-windows'){
      const available=state.wallWidth*1000-2*ENGINEERING.openingSideInsetMm;
      // Preserve the field being edited where possible; adapt the linked dimension.
      if(editedId==='mullionWidthMm') limit('openingWidth',bounds.openingWidth[0],(available-state.mullionWidthMm)/2000);
      else limit('mullionWidthMm',ENGINEERING.minMullionWidthMm,available-state.openingWidth*2000);
    }
    if(!state.preset.startsWith('door')){
      const available=state.wallHeight*1000-ENGINEERING.openingTopInsetMm;
      if(editedId==='openingHeight') limit('sillHeightMm',0,available-state.openingHeight*1000);
      else limit('openingHeight',bounds.openingHeight[0],(available-state.sillHeightMm)/1000);
    }
  }
  return [...adjusted];
}

function syncInputs(editingId=null){
  const bounds=inputBounds(),blank=state.preset==='blank',door=state.preset.startsWith('door');
  numericIds.forEach(id=>{
    const input=$(id);
    input.min=round(bounds[id][0]);input.max=round(bounds[id][1]);
    if(id!==editingId) input.value=state[id];
    input.disabled=(['openingWidth','openingHeight'].includes(id)&&blank) || (id==='sillHeightMm'&&(blank||door)) || (id==='mullionWidthMm'&&state.preset!=='two-windows');
  });
  $('openingFields').hidden=blank;
  $('sillField').hidden=door;
  $('mullionField').hidden=state.preset!=='two-windows';
  document.querySelectorAll('[data-input]').forEach(button=>{
    const selected=state[button.dataset.input]===Number(button.dataset.value);
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
}

function refresh(editedId=null){
  const adjusted=normalizeState(editedId);
  syncInputs(adjusted.includes(editedId)?null:editedId);
  $('geometryMessage').textContent=adjusted.length?`Чтобы параметры помещались в стене, скорректированы: ${adjusted.map(id=>FIELD_LABELS[id]).join(', ')}.`:'';
  drawWall();
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
  const W=state.wallWidth,ow=state.openingWidth,oh=state.openingHeight;
  const sill=state.sillHeightMm/1000;
  if(state.preset==='blank') return [];
  if(state.preset==='window-center') return [{x:(W-ow)/2,y:sill,w:ow,h:oh,kind:'window'}];
  if(state.preset==='door-left') return [{x:ENGINEERING.openingSideInsetMm/1000,y:0,w:ow,h:oh,kind:'door'}];
  if(state.preset==='door-center') return [{x:(W-ow)/2,y:0,w:ow,h:oh,kind:'door'}];
  if(state.preset==='two-windows'){
    const gap=state.mullionWidthMm/1000,left=(W-2*ow-gap)/2;
    return [{x:left,y:sill,w:ow,h:oh,kind:'window'},{x:left+ow+gap,y:sill,w:ow,h:oh,kind:'window'}];
  }
  return [];
}

function buildBoards(){
  const extentMm=(state.boardOrientation==='vertical'?state.wallWidth:state.wallHeight)*1000;
  const boardCount=Math.ceil((extentMm-EPSILON)/state.boardWidthMm);
  const boards=Array.from({length:boardCount},(_,index)=>({
    index,start:round(index*state.boardWidthMm/1000),end:round(Math.min((index+1)*state.boardWidthMm,extentMm)/1000),
  }));
  // Only INTERNAL board boundaries are joints; a trimmed final board has no extra outer joint.
  const jointPositions=boards.slice(1).map(board=>board.start);
  return {boards,boardCount,jointCount:jointPositions.length,jointPositions};
}

function buildLagPositions(lagOrientation){
  const extentMm=(lagOrientation==='horizontal'?state.wallHeight:state.wallWidth)*1000;
  const edge=ENGINEERING.edgeClearanceMm,end=extentMm-edge,positions=[];
  const count=Math.floor((end-edge+EPSILON)/state.lagSpacingMm);
  for(let i=0;i<=count;i++) positions.push(round((edge+i*state.lagSpacingMm)/1000));
  // Keep the selected axis spacing everywhere; never append a closer far-edge lag.
  return positions;
}

function pointIntersectsOpening(point,opening){
  const clear=ENGINEERING.openingClearanceMm/1000;
  return point.x>=opening.x-clear-EPSILON && point.x<=opening.x+opening.w+clear+EPSILON &&
    point.y>=opening.y-clear-EPSILON && point.y<=opening.y+opening.h+clear+EPSILON;
}

function calculateLayout(){
  // Physical model: boards → joints → perpendicular lags → joint × lag intersections.
  // Fasteners mount ON lags. No span midpoints or independent fastening rows exist.
  const boardLayout=buildBoards();
  const lagOrientation=state.boardOrientation==='vertical'?'horizontal':'vertical';
  const lagPositions=buildLagPositions(lagOrientation),openings=getOpenings();
  const potentialPoints=[],points=[];
  boardLayout.jointPositions.forEach((joint,jointIndex)=>{
    const available=[];
    lagPositions.forEach((lag,lagIndex)=>{
      // The exact lag-axis coordinate is used directly: a point cannot lie between lags.
      const point=lagOrientation==='horizontal'?{x:joint,y:lag,jointIndex,lagIndex}:{x:lag,y:joint,jointIndex,lagIndex};
      if(!openings.some(opening=>pointIntersectsOpening(point,opening))) available.push(point);
    });
    potentialPoints.push(...available);
    if(state.pattern==='standard'){points.push(...available);return;}
    const alternating=available.filter(point=>(jointIndex+point.lagIndex)%2===0);
    if(alternating.length) points.push(...alternating);
    // A partially blocked joint must not lose every fastener merely because of parity.
    // Keep one real available intersection; never create a point off the lag.
    else if(available.length) points.push({...available[0],coverageFallback:true});
  });
  return {...boardLayout,lagOrientation,lagPositions,openings,potentialPoints,points,
    mountPointCount:potentialPoints.length,coverageFallbackCount:points.filter(p=>p.coverageFallback).length};
}

function drawWall(){
  svg.innerHTML='';
  el('title').textContent='Схема расположения креплений SlidFix';
  el('desc').textContent=`Крепления SlidFix устанавливаются на лаги в точках пересечения со стыками соседних досок. Крепления не размещаются между лагами. ${DEMO_WARNING}`;
  const layout=calculateLayout();
  const {points,openings,boards,jointPositions,lagOrientation,lagPositions}=layout;
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
  // Clip cladding, joints and lag bands at actual openings; no complete line is discarded.
  const mask=el('mask',{id:'wallSurface',maskUnits:'userSpaceOnUse',x:x0,y:y0,width:w,height:h},defs);
  el('rect',{x:x0,y:y0,width:w,height:h,fill:'white'},mask);
  openings.forEach(o=>el('rect',{x:wall(o.x),y:wy(o.y+o.h),width:o.w*sx,height:o.h*sy,fill:'black'},mask));
  // Inline highlight styles travel with SVG, but contain no product illustrations.
  el('style',{},defs).textContent='.joint-line[data-highlight="true"]{stroke:#ffe0a6;stroke-width:3}.lag-axis[data-highlight="true"]{stroke:#fff;stroke-width:3}.lag-band[data-highlight="true"]{fill-opacity:.4}';
  const vertical=state.boardOrientation==='vertical';
  const cladding=el('g',{'data-layer':'cladding',mask:'url(#wallSurface)'});
  boards.forEach(board=>{
    const attrs=vertical?{x:wall(board.start),y:y0,width:(board.end-board.start)*sx,height:h}:{x:x0,y:wy(board.end),width:w,height:(board.end-board.start)*sy};
    el('rect',{...attrs,fill:board.index%2?'#d2a06b':'#704b2c','fill-opacity':.1,'data-board-index':board.index},cladding);
  });
  const joints=el('g',{'data-layer':'joints',mask:'url(#wallSurface)'});
  jointPositions.forEach((position,jointIndex)=>{
    const attrs=vertical?{x1:wall(position),y1:y0,x2:wall(position),y2:y0+h}:{x1:x0,y1:wy(position),x2:x0+w,y2:wy(position)};
    el('line',{...attrs,class:'joint-line',stroke:'#533821','stroke-width':1.2,'data-joint-index':jointIndex},joints);
  });
  const lagLayer=el('g',{'data-layer':'lags',mask:'url(#wallSurface)'});
  const lagWidth=ENGINEERING.lagWidthMm/1000;
  lagPositions.forEach((position,lagIndex)=>{
    const horizontal=lagOrientation==='horizontal';
    const band=horizontal?{x:x0,y:wy(position+lagWidth/2),width:w,height:lagWidth*sy}:{x:wall(position-lagWidth/2),y:y0,width:lagWidth*sx,height:h};
    const axis=horizontal?{x1:x0,y1:wy(position),x2:x0+w,y2:wy(position)}:{x1:wall(position),y1:y0,x2:wall(position),y2:y0+h};
    el('rect',{...band,class:'lag-band',fill:'#d5e2e8','fill-opacity':.22,stroke:'#c4d4dd','stroke-opacity':.3,'stroke-width':.6,'data-lag-index':lagIndex},lagLayer);
    el('line',{...axis,class:'lag-axis',stroke:'#e0e8ee','stroke-width':1.5,'stroke-dasharray':'9 5','data-lag-index':lagIndex},lagLayer);
  });

  // openings
  const openingLayer=el('g',{'data-layer':'openings'});
  openings.forEach(o=>{
    const ox=wall(o.x), oy=wy(o.y+o.h), ow=o.w*sx, oh=o.h*sy;
    el('rect',{x:ox,y:oy,width:ow,height:oh,fill:o.kind==='door'?'#10171c':'#1c2730',stroke:'#090d10','stroke-width':9,rx:2},openingLayer);
    if(o.kind==='window'){
      el('line',{x1:ox+ow/2,y1:oy+4,x2:ox+ow/2,y2:oy+oh-4,stroke:'#0b1115','stroke-width':5});
      el('path',{d:`M${ox+8} ${oy+oh*.7} Q ${ox+ow*.3} ${oy+oh*.45} ${ox+ow*.55} ${oy+oh*.66} T ${ox+ow-8} ${oy+oh*.54}`,fill:'none',stroke:'#496779','stroke-opacity':.5,'stroke-width':2});
    } else {
      el('circle',{cx:ox+ow*.82,cy:oy+oh*.5,r:5,fill:'#bfc8cf'});
    }
  });

  // placement points — symbols only, never the product geometry.
  const pointLayer=el('g',{'data-layer':'points'});
  points.forEach(p=>{
    const X=wall(p.x),Y=wy(p.y);
    const marker=el('g',{class:'fastener-marker','data-joint-index':p.jointIndex,'data-lag-index':p.lagIndex},pointLayer);
    el('title',{},marker).textContent=`Крепление между досками №${p.jointIndex+1} и №${p.jointIndex+2}. Лага №${p.lagIndex+1}. Крепление устанавливается на лагу.`;
    el('circle',{cx:X,cy:Y,r:4.8,fill:'#f4f6f7',stroke:'#ff302a','stroke-width':2},marker);
    el('circle',{cx:X,cy:Y,r:1.5,fill:'#ff302a'},marker);
  });
  $('markerHint').textContent='Наведите на точку, чтобы увидеть её стык и лагу. На схеме с фокусом используйте стрелки.';
  activeMarkerIndex=-1;

  // dimensions
  const dimY=y0-24; el('line',{x1:x0,y1:dimY,x2:x0+w,y2:dimY,stroke:'#d6dde2','stroke-width':1.4});
  el('path',{d:`M${x0} ${dimY} l10 -5 l0 10 z M${x0+w} ${dimY} l-10 -5 l0 10 z`,fill:'#d6dde2'});
  text(x0+w/2,dimY-8,`${formatDimension(state.wallWidth)} м`,{anchor:'middle',size:15});
  const dimX=x0-28; el('line',{x1:dimX,y1:y0,x2:dimX,y2:y0+h,stroke:'#d6dde2','stroke-width':1.4});
  el('path',{d:`M${dimX} ${y0} l-5 10 l10 0 z M${dimX} ${y0+h} l-5 -10 l10 0 z`,fill:'#d6dde2'});
  const ht=text(dimX-10,y0+h/2,`${formatDimension(state.wallHeight)} м`,{anchor:'middle',size:14}); ht.setAttribute('transform',`rotate(-90 ${dimX-10} ${y0+h/2})`);

  // bottom legend
  text(pad.l,VH-19,`SlidFix: ${points.length} шт. · ${PATTERN_LABELS[state.pattern]} · ПРЕДВАРИТЕЛЬНАЯ СХЕМА`,{size:12,weight:500});
  updateResults(layout);
}

function updateResults(layout){
  const {openings}=layout,unitCount=layout.points.length;
  const gross=state.wallWidth*state.wallHeight;
  const openingArea=openings.reduce((s,o)=>s+o.w*o.h,0);
  const net=Math.max(0,gross-openingArea);
  const packs=Math.ceil(unitCount/ENGINEERING.packSize);
  const screws=unitCount*ENGINEERING.screwsPerUnit;
  $('lagCount').textContent=layout.lagPositions.length;
  $('jointCount').textContent=layout.jointCount;
  $('mountPointCount').textContent=layout.mountPointCount;
  $('boardCount').textContent=layout.boardCount;
  $('lagOrientationLabel').textContent=layout.lagOrientation==='horizontal'?'Лаги горизонтальные — поперёк вертикальных досок.':'Лаги вертикальные — поперёк горизонтальных досок.';
  $('lagWidthLabel').textContent=`Ширина лаги: ${formatNumber(ENGINEERING.lagWidthMm)} мм — демонстрационная.`;
  $('coverageNotice').hidden=layout.coverageFallbackCount===0;
  $('coverageNotice').textContent=`Для стыков, у которых проёмы закрыли все чередующиеся позиции, сохранена одна доступная точка на лаге. Таких стыков: ${layout.coverageFallbackCount}.`;
  $('grossArea').textContent=`${formatDimension(gross)} м²`; $('grossDims').textContent=`${formatDimension(state.wallWidth)} × ${formatDimension(state.wallHeight)} м`;
  $('netArea').textContent=`${formatDimension(net)} м²`; $('boardCourseNote').textContent=`${state.boardOrientation==='vertical'?'по ширине':'по высоте'} стены · ${formatNumber(state.boardWidthMm)} мм`;
  $('unitCount').textContent=unitCount; $('packCount').textContent=packs; $('screwCount').textContent=screws;
  $('cartBtn').textContent=`${packs} уп. · КОРЗИНА НЕ ПОДКЛЮЧЕНА`;
  $('miniPattern').textContent=`${PATTERN_LABELS[state.pattern].toUpperCase()} · ${layout.lagOrientation==='horizontal'?'горизонтальные':'вертикальные'} лаги · ${formatNumber(state.lagSpacingMm)} мм`;
}

let activeMarkerIndex=-1;
function highlightMarker(marker){
  svg.querySelectorAll('[data-highlight]').forEach(node=>node.removeAttribute('data-highlight'));
  if(!marker) return;
  const joint=marker.dataset.jointIndex,lag=marker.dataset.lagIndex;
  svg.querySelector(`.joint-line[data-joint-index="${joint}"]`)?.setAttribute('data-highlight','true');
  svg.querySelectorAll(`.lag-axis[data-lag-index="${lag}"],.lag-band[data-lag-index="${lag}"]`).forEach(node=>node.setAttribute('data-highlight','true'));
  $('markerHint').textContent=marker.querySelector('title').textContent;
}
svg.addEventListener('pointerover',event=>{
  const marker=event.target.closest('.fastener-marker');
  if(marker) highlightMarker(marker);
});
svg.addEventListener('pointerleave',()=>{
  highlightMarker(null);$('markerHint').textContent='Крепления SlidFix устанавливаются на лаги в точках пересечения со стыками соседних досок.';
});
svg.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(event.key)) return;
  event.preventDefault();
  if(event.key==='Escape'){highlightMarker(null);activeMarkerIndex=-1;return;}
  const markers=svg.querySelectorAll('.fastener-marker');
  if(!markers.length) return;
  const direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
  activeMarkerIndex=activeMarkerIndex<0?(direction<0?markers.length-1:0):(activeMarkerIndex+direction+markers.length)%markers.length;
  highlightMarker(markers[activeMarkerIndex]);
});

numericIds.forEach(id=>{
  const input=$(id);
  input.addEventListener('input',()=>{
    const value=input.valueAsNumber;
    if(!Number.isFinite(value) || value<Number(input.min) || value>Number(input.max)){
      input.setAttribute('aria-invalid','true');
      $('inputMessage').textContent=`Введите значение от ${formatNumber(input.min)} до ${formatNumber(input.max)}. Пока отображается последнее корректное значение; после выхода из поля значение будет ограничено.`;
      return;
    }
    input.removeAttribute('aria-invalid');$('inputMessage').textContent='';
    state[id]=value;refresh(id);
  });
  input.addEventListener('blur',()=>{
    const value=input.valueAsNumber;
    if(Number.isFinite(value) && Math.abs(state[id]-value)>EPSILON){state[id]=value;refresh(id);}
    syncInputs();input.removeAttribute('aria-invalid');$('inputMessage').textContent='';
  });
});

function selectOption(attribute,value){
  document.querySelectorAll(`[data-${attribute}]`).forEach(button=>{
    const selected=button.getAttribute(`data-${attribute}`)===value;
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
  });
}
const optionKeys={preset:'preset',pattern:'pattern','board-orientation':'boardOrientation'};
Object.entries(optionKeys).forEach(([attribute,key])=>{
  selectOption(attribute,state[key]);
  document.querySelectorAll(`[data-${attribute}]`).forEach(button=>button.addEventListener('click',()=>{
    const wasDoor=state.preset.startsWith('door');
    state[key]=button.getAttribute(`data-${attribute}`);
    if(key==='preset' && state.preset.startsWith('door') && !wasDoor) state.openingHeight=ENGINEERING.defaultDoorHeightMm/1000;
    selectOption(attribute,state[key]);refresh();
  }));
});
document.querySelectorAll('[data-input]').forEach(button=>button.addEventListener('click',()=>{
  state[button.dataset.input]=Number(button.dataset.value);refresh();
}));

$('downloadSvgBtn').addEventListener('click',()=>{
  const clone=svg.cloneNode(true);clone.setAttribute('xmlns',NS);
  clone.removeAttribute('tabindex');clone.removeAttribute('aria-describedby');
  clone.querySelectorAll('[data-highlight]').forEach(node=>node.removeAttribute('data-highlight'));
  const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='slidfix-wall-layout.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
$('downloadJsonBtn').addEventListener('click',()=>{
  const layout=calculateLayout();
  const data={
    schemaVersion:3,brand:'SlidFix',warning:DEMO_WARNING,generatedAt:new Date().toISOString(),
    coordinateUnit:'m',state:{...state},engineeringDemoConstants:ENGINEERING,
    boardOrientation:state.boardOrientation,boardWidthMm:state.boardWidthMm,boardThicknessMm:state.boardThicknessMm,
    boardCount:layout.boardCount,jointCount:layout.jointCount,jointPositions:layout.jointPositions,
    jointAxis:state.boardOrientation==='vertical'?'x':'y',
    lagOrientation:layout.lagOrientation,lagSpacingMm:state.lagSpacingMm,lagWidthMm:ENGINEERING.lagWidthMm,
    lagPositions:layout.lagPositions,lagAxis:layout.lagOrientation==='vertical'?'x':'y',lagCount:layout.lagPositions.length,
    mountPointCount:layout.mountPointCount,coverageFallbackCount:layout.coverageFallbackCount,pattern:state.pattern,
    sillHeightMm:state.preset.startsWith('door')||state.preset==='blank'?null:state.sillHeightMm,
    mullionWidthMm:state.preset==='two-windows'?state.mullionWidthMm:null,
    openings:layout.openings,points:layout.points,unitCount:layout.points.length,
    packs:Math.ceil(layout.points.length/ENGINEERING.packSize),screws:layout.points.length*ENGINEERING.screwsPerUnit,
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='slidfix-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
refresh();
