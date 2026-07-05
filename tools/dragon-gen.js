// Generates 64x64 pixel maps for The Data Warden dragon.
// Legend: . blank  K outline(#241A38)  P plum  L lavender  G gold  H gold-light  W cream
const N = 64;

function newGrid(){ return Array.from({length:N},()=>Array(N).fill('.')); }
function set(g,x,y,c){ x=Math.round(x); y=Math.round(y); if(x>=0&&x<N&&y>=0&&y<N) g[y][x]=c; }
function get(g,x,y){ if(x<0||x>=N||y<0||y>=N) return '.'; return g[y][x]; }
function fillEllipse(g,cx,cy,rx,ry,c,maskFn){
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)
    for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
      const dx=(x-cx)/rx, dy=(y-cy)/ry;
      if(dx*dx+dy*dy<=1 && (!maskFn || maskFn(get(g,x,y)))) set(g,x,y,c);
    }
}
function bez(p0,p1,p2,t){
  const q=1-t;
  return [q*q*p0[0]+2*q*t*p1[0]+t*t*p2[0], q*q*p0[1]+2*q*t*p1[1]+t*t*p2[1]];
}
function strokeBez(g,p0,p1,p2,r0,r1,c){
  for(let t=0;t<=1;t+=0.02){
    const [x,y]=bez(p0,p1,p2,t);
    fillEllipse(g,x,y,r0+(r1-r0)*t,r0+(r1-r0)*t,c);
  }
}
function strokeBezMasked(g,p0,p1,p2,r0,r1,c){ // paints only over plum
  for(let t=0;t<=1;t+=0.02){
    const [x,y]=bez(p0,p1,p2,t);
    fillEllipse(g,x,y,r0+(r1-r0)*t,r0+(r1-r0)*t,c,cc=>cc==='P');
  }
}
function outlineSilhouette(g){
  const K=[];
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    const c=g[y][x];
    if(c==='.'||c==='K') continue;
    if(get(g,x-1,y)==='.'||get(g,x+1,y)==='.'||get(g,x,y-1)==='.'||get(g,x,y+1)==='.') K.push([x,y]);
  }
  K.forEach(([x,y])=>g[y][x]='K');
}
function seam(g,from,into){ // cells of `from` touching `into` become K
  const K=[];
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    if(g[y][x]!==from) continue;
    if([get(g,x-1,y),get(g,x+1,y),get(g,x,y-1),get(g,x,y+1)].includes(into)) K.push([x,y]);
  }
  K.forEach(([x,y])=>g[y][x]='K');
}

function drawBase(g){
  // tail: wraps from right flank around the front-bottom, tip curling up at left
  strokeBez(g,[54,48],[40,63],[15,57],5,2.2,'P');
  fillEllipse(g,13,56,2.2,2.2,'P');   // tip curls forward, low
  fillEllipse(g,11,54,1.5,1.5,'P');
  // body: curled mound
  fillEllipse(g,36,44,19,13,'P');
  // gold belly on the front (left) flank, scale bands added later
  fillEllipse(g,25,46,8,10,'G',c=>c==='P');
  // folded wing resting on the back
  fillEllipse(g,40,35,12,7.5,'L',c=>c==='P'||c==='.');
}
function addScales(g){
  for(let y=0;y<N;y++) for(let x=0;x<N;x++)
    if(g[y][x]==='G' && y%3===0) g[y][x]='H';
}
function wingRibs(g){
  // thin rib grooves fanning from the wing shoulder, only carved into lavender
  [[ [33,40],[40,30],[49,30] ],[ [33,40],[43,33],[52,35] ],[ [33,40],[42,37],[50,41] ]].forEach(([p0,p1,p2])=>{
    for(let t=0;t<=1;t+=0.04){
      const [x,y]=bez(p0,p1,p2,t);
      if(get(g,Math.round(x),Math.round(y))==='L') set(g,x,y,'K');
    }
  });
}
function horns(g,hx,hy){
  // crown-like: three gold points across the head top (drawn after outlining
  // so the 1px features keep their gold instead of being eaten by the pass)
  [[hx-3,hy],[hx,hy-1],[hx+3,hy]].forEach(([x,y])=>{
    set(g,x,y-2,'H'); set(g,x,y-1,'H'); set(g,x,y,'G');
  });
}

function makeSleep(){
  const g=newGrid();
  drawBase(g);
  // long neck curving up-left, head bowed in sleep
  strokeBez(g,[27,37],[12,24],[17,14],4.5,3.8,'P');
  fillEllipse(g,18,15,7,5.5,'P');       // head
  fillEllipse(g,11,18,3.5,2.3,'P');     // snout, dipped low
  // gold under-neck plates (masked so they stay inside the body)
  strokeBezMasked(g,[23,39],[10,25],[13,18],1.7,1.3,'G');
  addScales(g);
  outlineSilhouette(g);
  seam(g,'L','P'); wingRibs(g);
  horns(g,18,11);
  // closed eye: gentle lash arc
  set(g,13,15,'K'); set(g,14,16,'K'); set(g,15,17,'K'); set(g,16,17,'K'); set(g,17,16,'K');
  set(g,10,18,'K'); // nostril
  return g;
}

function makeAwake(eyes){ // eyes: 'open' | 'shut' | 'fire'
  const g=newGrid();
  drawBase(g);
  // neck raised high — swan curve
  strokeBez(g,[27,37],[12,20],[19,9],4.5,3.8,'P');
  fillEllipse(g,19,8,6.5,5,'P');        // head
  fillEllipse(g,12,10,3.5,2.3,'P');     // snout
  strokeBezMasked(g,[23,39],[10,22],[14,12],1.7,1.3,'G'); // gold throat
  addScales(g);
  outlineSilhouette(g);
  seam(g,'L','P'); wingRibs(g);
  horns(g,19,4);
  if(eyes==='open'||eyes==='fire'){
    set(g,15,7,'W'); set(g,16,7,'W');
    set(g,15,8,'K'); set(g,16,8,'W');   // pupil forward-low
  } else { // shut (sheepish): happy arcs
    set(g,14,8,'K'); set(g,15,7,'K'); set(g,16,7,'K'); set(g,17,8,'K');
  }
  set(g,12,10,'K'); // nostril
  if(eyes==='fire'){ // open mouth
    set(g,11,11,'K'); set(g,12,11,'K'); set(g,13,11,'K');
    set(g,11,12,'K'); set(g,12,12,'K');
  }
  return g;
}

const maps = {
  sleep: makeSleep(),
  alert: makeAwake('open'),
  sheepish: makeAwake('shut'),
  fire: makeAwake('fire'),
};

const mode = process.argv[2] || 'show';
if(mode==='show'){
  const which = process.argv[3] || 'sleep';
  console.log(maps[which].map(r=>r.join('')).join('\n'));
} else if(mode==='emit'){
  // splice into index.html between markers
  const fs=require('fs');
  const file=require('path').join(__dirname,'..','index.html');
  let html=fs.readFileSync(file,'utf8');
  const body = 'const MAPS = {\n' + Object.entries(maps).map(([k,g])=>
    `  ${k}: [\n` + g.map(r=>`    "${r.join('')}",`).join('\n') + '\n  ],'
  ).join('\n') + '\n};';
  html = html.replace(/\/\/ __DRAGON_MAPS_START__[\s\S]*?\/\/ __DRAGON_MAPS_END__/,
    '// __DRAGON_MAPS_START__ (generated by dragon-gen.js)\n' + body + '\n// __DRAGON_MAPS_END__');
  fs.writeFileSync(file,html);
  console.log('emitted maps into index.html');
}
