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

// ---------------- shared anatomy (chunky reference form) ----------------
function drawWing(g,S,hand,tips,B){
  // webbed wing: shade membrane, brighter core, scalloped edge, ink finger spines
  const triset=[[hand,tips[0],tips[1]],[hand,tips[1],tips[2]],[hand,tips[2],B],[S,hand,B]];
  triset.forEach(([a,b,c])=>fillTri(g,a,b,c,'M'));
  const pull=(p,f)=>[hand[0]+(p[0]-hand[0])*f, hand[1]+(p[1]-hand[1])*f];
  triset.forEach(([a,b,c])=>fillTri(g,pull(a,0.68),pull(b,0.68),pull(c,0.68),'L',cc=>cc==='M'));
  for(let i=0;i<tips.length-1;i++){
    const mx=(tips[i][0]+tips[i+1][0])/2, my=(tips[i][1]+tips[i+1][1])/2;
    const dx=mx-hand[0], dy=my-hand[1], dl=Math.hypot(dx,dy);
    fillEllipse(g,mx+dx/dl*2.8,my+dy/dl*2.8,3.6,3.6,'.',c=>c==='L'||c==='M');
  }
  strokeBez(g,S,[(S[0]+hand[0])/2,(S[1]+hand[1])/2-2],hand,1.8,1.2,'P');
  tips.forEach(tip=>{
    line(g,hand,tip,0.8,'K',c=>c==='L'||c==='M'||c==='.');
    set(g,tip[0],tip[1],'H');
  });
}

function bigHead(g,cx,cy,mzx,mzy){
  fillEllipse(g,cx,cy,9,8,'P');            // cranium — big, cute
  fillEllipse(g,mzx,mzy,6,4.5,'P');        // prominent rounded muzzle
  fillEllipse(g,mzx+2,mzy-1,4,2,'R',c=>c==='P'); // muzzle-top highlight
}

function horns(g,hx,hy){
  [[hx-3,hy],[hx,hy-1],[hx+3,hy]].forEach(([x,y])=>{
    set(g,x,y-2,'H'); set(g,x,y-1,'H'); set(g,x,y,'G');
  });
}

// ---------------- poses ----------------
function makeAwake(eyes){
  const g=newGrid();
  // long slim tail, S-curving up the right side with a small barb
  strokeBez(g,[42,52],[60,60],[57,40],2.8,1.2,'P');
  fillTri(g,[58,34],[54,41],[61,41],'P');
  // slim body: upright chest tapering into the haunch (baby-dragon build)
  fillEllipse(g,40,48,8,7.5,'P');           // haunch
  fillEllipse(g,34,44,7,6.5,'P');           // midriff bridge
  fillEllipse(g,28,38,6.5,8,'P');           // chest
  // slender front legs (near leg plum, far leg in shade)
  line(g,[30,45],[31,56],1.4,'Q');
  fillEllipse(g,31,57,3,2,'Q');
  line(g,[26,43],[24,56],1.7,'P');
  fillEllipse(g,24,57,3.2,2.2,'P');
  set(g,21,58,'K'); set(g,22,58,'K');       // front claws
  fillEllipse(g,44,57,4,2.4,'P');           // hind foot
  set(g,40,58,'K'); set(g,41,58,'K');
  // narrow gold belly strip down the chest
  strokeBez(g,[24,32],[21,40],[26,49],2,2.6,'G',c=>c==='P');
  // large webbed wing swept up and back
  drawWing(g,[33,32],[44,14],[[58,8],[62,20],[58,32]],[44,38]);
  // graceful neck and a refined head: small cranium, tapered snout
  strokeBez(g,[27,34],[24,24],[27,15],3.6,2.6,'P');
  fillEllipse(g,29,11,5,4.2,'P');           // cranium
  strokeBez(g,[26,11],[20,11.5],[15,13.5],2.4,1.1,'P'); // snout, sloping bridge
  fillEllipse(g,27,7,3,1.4,'R',c=>c==='P'); // brow highlight
  fillEllipse(g,20,10.5,3,1,'R',c=>c==='P');// snout-bridge highlight
  shadeEllipse(g,40,48,8,7.5);
  shadeEllipse(g,34,44,7,6.5);
  outlineSilhouette(g);
  seam(g,'L','P'); seam(g,'M','P');
  // gold scale banding on the belly strip
  for(let y=0;y<N;y++) for(let x=0;x<N;x++)
    if(g[y][x]==='G' && y%3===0) g[y][x]='H';
  horns(g,29,6);
  if(eyes==='shut'){
    set(g,25,11,'K'); set(g,26,10,'K'); set(g,27,10,'K'); set(g,28,11,'K');
  } else {
    set(g,26,10,'W'); set(g,27,10,'W');
    set(g,26,11,'K'); set(g,27,11,'W');
    set(g,25,9,'K'); set(g,26,9,'K');       // brow line over the eye
  }
  set(g,15,13,'K');                          // nostril at the snout tip
  set(g,16,15,'K'); set(g,18,15,'K');        // mouth line
  if(eyes==='fire'){                         // parted jaw
    set(g,13,15,'K'); set(g,14,15,'K'); set(g,15,15,'K'); set(g,14,16,'K');
  }
  return g;
}

function makeSleep(){
  const g=newGrid();
  // tail wraps around the front, barb resting near the head
  strokeBez(g,[52,54],[42,63],[22,59],4.5,2,'P');
  fillTri(g,[19,53],[15,59],[23,59],'P');
  // curled mound body + neck bridge
  fillEllipse(g,38,47,15,11,'P');
  fillEllipse(g,26,46,6,6,'P');
  // small gold chest peeking under the chin
  fillEllipse(g,27,52,5,4,'G',c=>c==='P');
  drawWing(g,[36,38],[43,27],[[51,21],[54,29],[50,36]],[42,42]);
  bigHead(g,17,45,8,49);                    // head resting low
  shadeEllipse(g,38,47,15,11);
  outlineSilhouette(g);
  seam(g,'L','P'); seam(g,'M','P');
  horns(g,17,37);
  // closed contented eye
  set(g,13,44,'K'); set(g,14,45,'K'); set(g,15,45,'K'); set(g,16,44,'K');
  set(g,4,48,'K');                          // nostril
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
