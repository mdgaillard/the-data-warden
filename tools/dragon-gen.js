// Generates 64x64 pixel maps for The Data Warden wyvern.
// Legend: . blank  K outline  P plum  Q plum shade  R plum highlight
//         L lavender membrane  M membrane shade  G gold  H gold light  W cream
// Run `node tools/dragon-gen.js show <pose>` to preview in the terminal,
// `node tools/dragon-gen.js emit` to bake the maps into index.html.
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
function bezD(p0,p1,p2,t){
  return [2*(1-t)*(p1[0]-p0[0])+2*t*(p2[0]-p1[0]), 2*(1-t)*(p1[1]-p0[1])+2*t*(p2[1]-p1[1])];
}
function strokeBez(g,p0,p1,p2,r0,r1,c,maskFn){
  for(let t=0;t<=1;t+=0.02){
    const [x,y]=bez(p0,p1,p2,t);
    fillEllipse(g,x,y,r0+(r1-r0)*t,r0+(r1-r0)*t,c,maskFn);
  }
}
function line(g,a,b,r,c,maskFn){
  const steps = Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*2+1;
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    fillEllipse(g,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,r,r,c,maskFn);
  }
}
function fillTri(g,a,b,c,ch,maskFn){
  const xs=[a[0],b[0],c[0]], ys=[a[1],b[1],c[1]];
  const sgn=(p,q,r)=>(p[0]-r[0])*(q[1]-r[1])-(q[0]-r[0])*(p[1]-r[1]);
  for(let y=Math.floor(Math.min(...ys));y<=Math.ceil(Math.max(...ys));y++)
    for(let x=Math.floor(Math.min(...xs));x<=Math.ceil(Math.max(...xs));x++){
      const pt=[x,y];
      const d1=sgn(pt,a,b), d2=sgn(pt,b,c), d3=sgn(pt,c,a);
      const neg=(d1<0)||(d2<0)||(d3<0), pos=(d1>0)||(d2>0)||(d3>0);
      if(!(neg&&pos) && (!maskFn || maskFn(get(g,x,y)))) set(g,x,y,ch);
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
function seam(g,from,into){
  const K=[];
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){
    if(g[y][x]!==from) continue;
    if([get(g,x-1,y),get(g,x+1,y),get(g,x,y-1),get(g,x,y+1)].includes(into)) K.push([x,y]);
  }
  K.forEach(([x,y])=>g[y][x]='K');
}
function shadeEllipse(g,cx,cy,rx,ry){
  // lower-right rim of an ellipse turns to shade for a rounded, muscular read
  for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)
    for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
      if(get(g,x,y)!=='P') continue;
      const dx=(x-cx)/rx, dy=(y-cy)/ry, r2=dx*dx+dy*dy;
      if(r2>=0.48 && r2<=1 && dx+dy>0.42) set(g,x,y,'Q');
    }
}
function spikesAlong(g,p0,p1,p2,ts,sign,r0,r1){
  // back-ridge spikes standing off the outer edge of a bezier limb
  ts.forEach(t=>{
    const [x,y]=bez(p0,p1,p2,t), [dx,dy]=bezD(p0,p1,p2,t);
    const len=Math.hypot(dx,dy)||1;
    const nx=sign*(-dy/len), ny=sign*(dx/len);
    const tx=dx/len, ty=dy/len;
    const r=(r0+(r1-r0)*t)-0.5; // hug the stroke surface
    for(let k=0;k<4;k++){ // 2-wide tapering spike, 4 long
      const px=x+nx*(r+k), py=y+ny*(r+k);
      set(g,px,py,'P');
      if(k<2){ set(g,px+tx,py+ty,'P'); set(g,px-tx,py-ty,'P'); }
    }
  });
}

// ---------------- shared anatomy (draped-wing reference form) ----------------
function drapedWing(g,cx,cy,rx,ry,arm){
  // wing folded over the back like a cloak: shaded membrane, brighter core,
  // scalloped hem, panel ribs, plum arm ridge along the top
  fillEllipse(g,cx,cy,rx,ry,'M');
  fillEllipse(g,cx-1,cy-2,rx*0.85,ry*0.75,'L',c=>c==='M');
  [-0.6,0,0.6].forEach(f=>{
    fillEllipse(g,cx+f*rx, cy+ry-0.5, 3.4,3.4,'.',c=>c==='L'||c==='M');
  });
  // panel ribs fanning from the wing shoulder (top-front) to the hem
  const apex=[cx-rx*0.55, cy-ry*0.45];
  [[cx-rx*0.55,cy+ry-2],[cx+rx*0.1,cy+ry-1],[cx+rx*0.65,cy+ry*0.45]].forEach(p=>{
    line(g,apex,p,0.6,'K',c=>c==='L'||c==='M');
  });
  strokeBez(g,arm[0],arm[1],arm[2],1.8,1.2,'P');
  set(g,arm[2][0],arm[2][1]-2,'H'); // thumb claw at the wing wrist
}

function goldBands(g){
  for(let y=0;y<N;y++) for(let x=0;x<N;x++)
    if(g[y][x]==='G' && y%3===0) g[y][x]='H';
}

function hornsSwept(g,hx,hy){
  // two small gold horns swept back from the crown
  strokeBez(g,[hx,hy],[hx+3,hy-2],[hx+5,hy-4],1.2,0.4,'H');
  strokeBez(g,[hx+1,hy+2],[hx+4,hy],[hx+6,hy-1],0.9,0.3,'G');
}

// ---------------- poses ----------------
function makeAwake(eyes){
  const g=newGrid();
  // thick tail curling around the front base
  strokeBez(g,[44,54],[28,63],[12,54],4,2.2,'P');
  fillEllipse(g,11,52,2.4,2.4,'P');
  // seated body
  fillEllipse(g,34,46,13,12,'P');
  fillEllipse(g,40,50,10,8,'P');
  // front paw peeking below the chest
  fillEllipse(g,24,56,4,2.5,'P');
  set(g,21,57,'K'); set(g,22,57,'K');
  // draped wing over the back, then the neck and head in front of it
  drapedWing(g,40,36,12,14,[[31,27],[40,21],[50,28]]);
  strokeBez(g,[28,40],[22,26],[26,13],5,3.4,'P');   // tall arched neck
  fillEllipse(g,27,10,6,4.6,'P');                   // cranium
  strokeBez(g,[23,10.5],[19,10.5],[15,12],3,1.9,'P'); // blunt, gently drooping snout
  strokeBez(g,[24,38],[18,26],[22,13],2.4,1.7,'G',c=>c==='P'); // gold throat
  shadeEllipse(g,34,46,13,12);
  outlineSilhouette(g);
  seam(g,'L','P'); seam(g,'M','P');
  goldBands(g);
  hornsSwept(g,29,7);
  if(eyes==='shut'){
    set(g,22,10,'K'); set(g,23,11,'K'); set(g,24,11,'K'); set(g,25,10,'K');
  } else {
    // big glossy eye with a sparkle
    set(g,23,9,'K');  set(g,24,9,'K');
    set(g,23,10,'K'); set(g,24,10,'K');
    set(g,23,11,'K'); set(g,24,11,'K');
    set(g,24,9,'W');
  }
  set(g,14,11,'K');                        // nostril
  set(g,15,14,'K'); set(g,17,14,'K');      // mouth line
  if(eyes==='fire'){                       // parted jaw
    set(g,13,14,'K'); set(g,14,14,'K'); set(g,15,14,'K'); set(g,14,15,'K');
  }
  return g;
}

function makeSleep(){
  const g=newGrid();
  // tail wraps around the front of the pile
  strokeBez(g,[52,54],[42,63],[22,59],4.5,2,'P');
  fillEllipse(g,20,57,2.4,2.4,'P');
  // curled mound + low arched neck, head sinking to the gold
  fillEllipse(g,38,48,15,10.5,'P');
  drapedWing(g,39,38,12,11,[[29,32],[38,26],[49,32]]);
  strokeBez(g,[28,42],[19,36],[15,42],4.5,3.6,'P');
  fillEllipse(g,15,43,6.5,5,'P');
  strokeBez(g,[11,44],[8,46],[6,49],2.8,1.6,'P');   // snout drooping toward the pile
  fillEllipse(g,19,51,6,5.5,'P');                   // chest under the chin
  fillEllipse(g,18,51,5.5,5,'G',c=>c==='P');        // gold chest bib
  shadeEllipse(g,38,48,15,10.5);
  outlineSilhouette(g);
  seam(g,'L','P'); seam(g,'M','P');
  goldBands(g);
  hornsSwept(g,16,39);
  // closed contented eye
  set(g,12,42,'K'); set(g,13,43,'K'); set(g,14,43,'K'); set(g,15,42,'K');
  set(g,5,48,'K');                                   // nostril
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
  const fs=require('fs');
  const file=require('path').join(__dirname,'..','index.html');
  let html=fs.readFileSync(file,'utf8');
  const body = 'const MAPS = {\n' + Object.entries(maps).map(([k,g])=>
    `  ${k}: [\n` + g.map(r=>`    "${r.join('')}",`).join('\n') + '\n  ],'
  ).join('\n') + '\n};';
  html = html.replace(/\/\/ __DRAGON_MAPS_START__[\s\S]*?\/\/ __DRAGON_MAPS_END__/,
    '// __DRAGON_MAPS_START__ (generated by tools/dragon-gen.js)\n' + body + '\n// __DRAGON_MAPS_END__');
  fs.writeFileSync(file,html);
  console.log('emitted maps into index.html');
}
