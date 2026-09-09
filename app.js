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
  standardVerticalPitchMm: 500,
  minVerticalFastenerPitchMm: 400,
  maxVerticalFastenerPitchMm: 600,
  edgeClearanceMm: 180,
  openingClearanceMm: 110, // Temporary UX/demo clearance, not a validated installation rule.
  openingSideInsetMm: 180,
  openingTopInsetMm: 180,
  minOpeningWidthMm: 200,
  minOpeningHeightMm: 300,
  minMullionWidthMm: 100,
  defaultWindowSillHeightMm: 850,
  defaultMullionWidthMm: 1200,
  defaultDoorHeightMm: 2100,
};

const state = {
  preset: 'window-center',
  pattern: 'standard',
  boardOrientation: 'vertical',
  wallWidth: 6.0,
  wallHeight: 2.8,
  boardWidth: 125,
  lagSpacingMm: ENGINEERING.defaultLagSpacingMm,
  verticalFastenerPitchMm: ENGINEERING.standardVerticalPitchMm,
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
  wallWidth:'ширина стены', wallHeight:'высота стены', boardWidth:'ширина доски',
  lagSpacingMm:'шаг лаг', verticalFastenerPitchMm:'шаг рядов креплений',
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
    wallWidth:[1,30], wallHeight:[1,10], boardWidth:[50,500],
    lagSpacingMm:[ENGINEERING.minLagSpacingMm,ENGINEERING.maxLagSpacingMm],
    verticalFastenerPitchMm:[ENGINEERING.minVerticalFastenerPitchMm,ENGINEERING.maxVerticalFastenerPitchMm],
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
  ['wallWidth','wallHeight','boardWidth','lagSpacingMm','verticalFastenerPitchMm'].forEach(id=>limit(id,...inputBounds()[id]));
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

function buildLagPositions(){
  const edge=ENGINEERING.edgeClearanceMm,end=state.wallWidth*1000-edge,positions=[];
  const count=Math.floor((end-edge+EPSILON)/state.lagSpacingMm);
  for(let i=0;i<=count;i++) positions.push(round((edge+i*state.lagSpacingMm)/1000));
  // Close the frame at the far edge; the final span may be shorter, never wider.
  if(end/1000-positions[positions.length-1]>EPSILON) positions.push(round(end/1000));
  return positions;
}

function spanIntersectsOpening(span,y,opening){
  const clear=ENGINEERING.openingClearanceMm/1000;
  // Test the whole span at this row, not only its midpoint; boundary contact is excluded too.
  return span.right>=opening.x-clear-EPSILON && span.left<=opening.x+opening.w+clear+EPSILON &&
    y>=opening.y-clear-EPSILON && y<=opening.y+opening.h+clear+EPSILON;
}

function calculateLayout(){
  const lagPositions=buildLagPositions(),openings=getOpenings();
  const spans=lagPositions.slice(0,-1).map((left,index)=>({index,left,right:lagPositions[index+1],center:round((left+lagPositions[index+1])/2)}));
  const rowPositions=[],points=[];
  const edge=ENGINEERING.edgeClearanceMm,end=state.wallHeight*1000-edge;
  const rowCount=Math.floor((end-edge+EPSILON)/state.verticalFastenerPitchMm)+1;
  for(let rowIndex=0;rowIndex<rowCount;rowIndex++){
    const y=round((edge+rowIndex*state.verticalFastenerPitchMm)/1000);
    rowPositions.push(y);
    spans.forEach(span=>{
      if(state.pattern==='staggered' && span.index%2!==rowIndex%2) return;
      if(!openings.some(opening=>spanIntersectsOpening(span,y,opening))) points.push({x:span.center,y,spanIndex:span.index,rowIndex});
    });
  }
  // Axes are interrupted at actual openings; this is not a lintel/framing takeoff.
  const lagSegments=[];
  lagPositions.forEach((x,lagIndex)=>{
    let segments=[{bottom:0,top:state.wallHeight}];
    openings.filter(o=>x>=o.x-EPSILON&&x<=o.x+o.w+EPSILON).forEach(o=>{
      segments=segments.flatMap(segment=>{
        if(o.y>=segment.top || o.y+o.h<=segment.bottom) return [segment];
        const parts=[];
        if(o.y>segment.bottom) parts.push({bottom:segment.bottom,top:o.y});
        if(o.y+o.h<segment.top) parts.push({bottom:o.y+o.h,top:segment.top});
        return parts;
      });
    });
    segments.forEach(segment=>lagSegments.push({x,lagIndex,...segment}));
  });
  return {lagPositions,spans,spanCount:spans.length,rowPositions,lagSegments,points,openings};
}

function drawWall(){
  svg.innerHTML='';
  el('title').textContent='Схема расположения креплений SlidFix';
  el('desc').textContent=DEMO_WARNING;
  const layout=calculateLayout();
  const {points,openings,lagSegments}=layout;
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
  // Board orientation changes cladding only; lag axes and span-based fasteners stay vertical.
  const boards=el('g',{'data-layer':'cladding'});
  const boardM=state.boardWidth/1000;
  const vertical=state.boardOrientation==='vertical';
  const boardExtent=vertical?state.wallWidth:state.wallHeight;
  for(let position=boardM;position<boardExtent;position+=boardM){
    const attrs=vertical?{x1:wall(position),y1:y0,x2:wall(position),y2:y0+h}:{x1:x0,y1:wy(position),x2:x0+w,y2:wy(position)};
    el('line',{...attrs,stroke:'#6d472b','stroke-opacity':.65,'stroke-width':1},boards);
  }
  // grain lines
  for(let i=0;i<18;i++){
    const gy=y0+((i+1)/(19))*h;
    el('path',{d:`M ${x0} ${gy} C ${x0+w*.24} ${gy-4} ${x0+w*.55} ${gy+5} ${x0+w} ${gy-2}`,fill:'none',stroke:'#d4a16b','stroke-opacity':.10,'stroke-width':2});
  }

  const lagLayer=el('g',{'data-layer':'lags'});
  lagSegments.forEach(segment=>el('line',{
    x1:wall(segment.x),y1:wy(segment.top),x2:wall(segment.x),y2:wy(segment.bottom),
    stroke:'#e0e8ee','stroke-width':2,'stroke-dasharray':'9 5','stroke-opacity':.7,'data-lag-index':segment.lagIndex,
  },lagLayer));

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
    el('circle',{cx:X,cy:Y,r:6.4,fill:'#f4f6f7',stroke:'#ff302a','stroke-width':3,'data-span-index':p.spanIndex,'data-row-index':p.rowIndex},pointLayer);
    el('circle',{cx:X,cy:Y,r:1.8,fill:'#ff302a'},pointLayer);
  });

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
  const vertical=state.boardOrientation==='vertical';
  const courses=Math.ceil(((vertical?state.wallWidth:state.wallHeight)*1000)/state.boardWidth);
  $('boardCountLabel').textContent=vertical?'Количество досок по ширине':'Количество рядов доски';
  $('lagCount').textContent=layout.lagPositions.length;
  $('spanCount').textContent=layout.spanCount;
  $('rowCount').textContent=layout.rowPositions.length;
  $('grossArea').textContent=`${formatDimension(gross)} м²`; $('grossDims').textContent=`${formatDimension(state.wallWidth)} × ${formatDimension(state.wallHeight)} м`;
  $('netArea').textContent=`${formatDimension(net)} м²`; $('boardCourses').textContent=courses; $('boardCourseNote').textContent=`доска ${formatNumber(state.boardWidth)} мм`;
  $('unitCount').textContent=unitCount; $('packCount').textContent=packs; $('screwCount').textContent=screws;
  $('cartBtn').textContent=`${packs} уп. · КОРЗИНА НЕ ПОДКЛЮЧЕНА`;
  $('miniPattern').textContent=`${PATTERN_LABELS[state.pattern].toUpperCase()} · лаги ${formatNumber(state.lagSpacingMm)} мм · ряды ${formatNumber(state.verticalFastenerPitchMm)} мм`;
}

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
  const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='slidfix-wall-layout.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
$('downloadJsonBtn').addEventListener('click',()=>{
  const layout=calculateLayout();
  const data={
    schemaVersion:2,brand:'SlidFix',warning:DEMO_WARNING,generatedAt:new Date().toISOString(),
    coordinateUnit:'m',state:{...state},engineeringDemoConstants:ENGINEERING,
    boardOrientation:state.boardOrientation,lagSpacingMm:state.lagSpacingMm,
    lagPositions:layout.lagPositions,lagCount:layout.lagPositions.length,
    spans:layout.spans,spanCount:layout.spanCount,rowPositions:layout.rowPositions,
    verticalFastenerPitchMm:state.verticalFastenerPitchMm,pattern:state.pattern,
    sillHeightMm:state.preset.startsWith('door')||state.preset==='blank'?null:state.sillHeightMm,
    mullionWidthMm:state.preset==='two-windows'?state.mullionWidthMm:null,
    openings:layout.openings,points:layout.points,unitCount:layout.points.length,
    packs:Math.ceil(layout.points.length/ENGINEERING.packSize),screws:layout.points.length*ENGINEERING.screwsPerUnit,
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='slidfix-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
refresh();
