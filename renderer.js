// AI 마을 - 포켓몬 GBA 타운 스타일 렌더러 (디테일 강화)
const DATA = JSON.parse(document.getElementById('data').textContent);
const TILE = 44, COLS = DATA.map.w, ROWS = DATA.map.h, W = COLS * TILE, H = ROWS * TILE;
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
cv.width = W; cv.height = H;
const COLORS = { 미나:'#e6a23c', 준호:'#5b8def', 옥자:'#e0568a', 동수:'#5fb87a', 서연:'#9b6dde', 가람:'#48c4c4' };
const HAIR = { 미나:'#5a3a2a', 준호:'#2c2c34', 옥자:'#6b2a3a', 동수:'#3a2a1a', 서연:'#4a2a4a', 가람:'#2a3a3a' };
const OUT = '#22321f';
document.getElementById('seed').textContent = DATA.seed;
const R = Math.round, K = (x, y) => x + ',' + y;
const cxOf = t => t.x * TILE + TILE / 2, byOf = t => t.y * TILE + TILE * 0.95;

const STYLES = {
  빵집:{w:2.4,h:1.9,wall:'#f0e3c8',roof:'#c06a3e',type:'bakery'},
  우체국:{w:2.4,h:1.9,wall:'#e7eef6',roof:'#4f7bb0',type:'post'},
  병원:{w:2.7,h:2.0,wall:'#f3ece0',roof:'#d24b46',type:'center'},
  술집:{w:2.4,h:1.9,wall:'#e8d6b6',roof:'#7a4a2a',type:'bar'},
  농장:{w:2.3,h:1.8,wall:'#edd9bf',roof:'#a14a35',type:'farm'},
  시청:{w:3.2,h:2.3,wall:'#dfe0e6',roof:'#71718c',type:'gym'},
};

const treeSet=new Set(),waterSet=new Set(),pathSet=new Set(),tallSet=new Set(),buildSet=new Set();
for(let x=0;x<COLS;x++){treeSet.add(K(x,0));treeSet.add(K(x,ROWS-1));}
for(let y=0;y<ROWS;y++){treeSet.add(K(0,y));treeSet.add(K(COLS-1,y));}
[[7,0],[8,0],[1,1],[14,1],[1,10],[14,10],[8,11]].forEach(([x,y])=>treeSet.add(K(x,y)));
[[10,1],[11,1],[11,2],[4,8],[5,8],[4,9]].forEach(([x,y])=>waterSet.add(K(x,y)));
for(const n in STYLES){const l=DATA.locations[n];buildSet.add(K(l.x,l.y));buildSet.add(K(l.x,l.y-1));}
function addPath(x,y){const k=K(x,y);if(!treeSet.has(k)&&!waterSet.has(k))pathSet.add(k);}
const plaza=DATA.locations['광장'];
for(const n in STYLES){const l=DATA.locations[n];for(let x=Math.min(plaza.x,l.x);x<=Math.max(plaza.x,l.x);x++)addPath(x,plaza.y);for(let y=Math.min(plaza.y,l.y);y<=Math.max(plaza.y,l.y);y++)addPath(l.x,y);}
const plazaSet=new Set();
for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){plazaSet.add(K(plaza.x+dx,plaza.y+dy));pathSet.delete(K(plaza.x+dx,plaza.y+dy));}
function free(x,y){const k=K(x,y);return !treeSet.has(k)&&!waterSet.has(k)&&!pathSet.has(k)&&!buildSet.has(k)&&!plazaSet.has(k)&&x>0&&y>0&&x<COLS-1&&y<ROWS-1;}
const DECOR=[[5,3],[10,3],[3,4],[12,4],[6,7],[10,7],[3,7],[12,8],[6,3],[9,8]].filter(([x,y])=>free(x,y));
[[9,3],[6,6],[11,7]].forEach(([x,y])=>{if(free(x,y))tallSet.add(K(x,y));});
const FLOWERS=[]; for(let i=0;i<46;i++){const x=1+(i*5+ (i*i)%7)%(COLS-2), y=1+(i*3+ (i*i)%5)%(ROWS-2); if(free(x,y)) FLOWERS.push([x*TILE+8+((i*7)%26), y*TILE+8+((i*11)%26), i%3]);}
const LAMPS=[[6,4],[10,6]].filter(([x,y])=>true);

const sprites=DATA.frames[0].agents.map(a=>({name:a.name,px:cxOf(a),py:byOf(a)-6,tx:cxOf(a),ty:byOf(a)-6,say:'',t:0,dir:1}));
let fi=0,playing=true,raining=false;

function applyFrame(i){
  const f=DATA.frames[i];
  f.agents.forEach(a=>{const s=sprites.find(s=>s.name===a.name);if(!s)return;const nx=cxOf(a);s.dir=nx<s.px?-1:1;s.tx=nx;s.ty=byOf(a)-6;s.say=a.say||'';s.t=performance.now();});
  raining=!!(f.event&&f.event.includes('비'));
  const b=document.getElementById('banner');
  if(f.event){b.style.display='block';b.textContent='📢 '+f.event;}else b.style.display='none';
  document.getElementById('tickLabel').textContent=i===0?'아침이 밝았다':'TICK '+i+' · 리셋까지 '+(DATA.frames.length-1-i)+'틱';
  document.getElementById('feed').innerHTML=f.agents.filter(a=>a.say||a.action).map(a=>'<div><span class="who" style="color:'+(COLORS[a.name]||'#fff')+'">'+a.name+'</span> '+a.action+(a.say?' — "'+a.say+'"':'')+(a.target&&a.target!=='null'?' <span style="color:#8b93a3">(→'+a.target+')</span>':'')+'</div>').join('')||'<div style="color:#8b93a3">조용한 아침...</div>';
  if(i===DATA.frames.length-1)showChron();
}
function showChron(){if(!DATA.chronicle)return;const el=document.getElementById('chron');el.style.display='block';el.innerHTML=DATA.chronicle.replace(/## (.*)/g,'<h2>$1</h2>').replace(/\*\*(.*?)\*\*/g,'<b>$1</b>');}
function setBtn(){document.getElementById('play').textContent=playing?'⏸ 일시정지':'▶ 재생';}
function circle(x,y,r){ctx.beginPath();ctx.arc(R(x),R(y),r,0,7);ctx.fill();}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function ground(){
  ctx.fillStyle='#6cb050'; ctx.fillRect(0,0,W,H);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ctx.fillStyle=(x+y)%2?'#67aa4b':'#6fb453';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);}
  for(let i=0;i<420;i++){const x=(i*131+i*i*7)%W,y=(i*71+i*i*3)%H;ctx.fillStyle=i%2?'#5fa244':'#74ba58';ctx.fillRect(x,y,2,2);if(i%5===0){ctx.fillStyle='#5a9a40';ctx.fillRect(x+1,y+1,1,3);}}
}
function flowers(){for(const [x,y,c] of FLOWERS){const col=['#ef6f8f','#f4d24a','#c98ce6'][c];ctx.fillStyle='#4f8a3c';ctx.fillRect(x,y+2,1,3);ctx.fillStyle=col;ctx.fillRect(x-1,y,1,1);ctx.fillRect(x+1,y,1,1);ctx.fillRect(x,y-1,1,1);ctx.fillRect(x,y+1,1,1);ctx.fillStyle='#fff3b0';ctx.fillRect(x,y,1,1);}}
function water(now){for(const k of waterSet){const [x,y]=k.split(',').map(Number),X=x*TILE,Y=y*TILE;ctx.fillStyle='#3f92c8';ctx.fillRect(X,Y,TILE,TILE);ctx.fillStyle='#54a6da';ctx.fillRect(X,Y,TILE,TILE-6);ctx.fillStyle='#7cc4ea';for(let i=0;i<3;i++){const ph=Math.sin(now/600+i+x)*4;ctx.fillRect(X+6+i*12+ph,Y+12+i*9,9,2);}ctx.fillStyle='#bfe6f4';if(!waterSet.has(K(x,y-1)))ctx.fillRect(X,Y,TILE,3);if(!waterSet.has(K(x,y+1)))ctx.fillRect(X,Y+TILE-3,TILE,3);if(!waterSet.has(K(x-1,y)))ctx.fillRect(X,Y,3,TILE);if(!waterSet.has(K(x+1,y)))ctx.fillRect(X+TILE-3,Y,3,TILE);}
  // lily pad on one tile
  const lp=[...waterSet][0].split(',').map(Number);ctx.fillStyle='#3c8b4a';circle(lp[0]*TILE+24,lp[1]*TILE+24,5);ctx.fillStyle='#ef9fc0';circle(lp[0]*TILE+24,lp[1]*TILE+22,2);}
function dither(X,Y,col){ctx.fillStyle=col;for(let a=0;a<TILE;a+=4)for(let b=0;b<TILE;b+=4)if(((a+b)/4)%2===0)ctx.fillRect(X+a,Y+b,2,2);}
function paths(){for(const k of pathSet){const [x,y]=k.split(',').map(Number),X=x*TILE,Y=y*TILE;ctx.fillStyle='#dcc48d';ctx.fillRect(X,Y,TILE,TILE);ctx.fillStyle='#d2b87e';for(let i=0;i<5;i++)ctx.fillRect(X+5+((i*13)%34),Y+6+((i*17)%32),3,2);ctx.fillStyle='#caa86c';ctx.fillRect(X+9,Y+20,2,2);ctx.fillRect(X+26,Y+30,3,2);
  if(!pathSet.has(K(x,y-1))&&!plazaSet.has(K(x,y-1)))dither(X,Y,'#bfa86a');
  if(!pathSet.has(K(x,y+1))&&!plazaSet.has(K(x,y+1)))dither(X,Y+TILE-8,'#bfa86a');
  if(!pathSet.has(K(x-1,y))&&!plazaSet.has(K(x-1,y)))dither(X,Y,'#bfa86a');
  if(!pathSet.has(K(x+1,y))&&!plazaSet.has(K(x+1,y)))dither(X+TILE-8,Y,'#bfa86a');}}
function drawPlaza(){for(const k of plazaSet){const [x,y]=k.split(',').map(Number),X=x*TILE,Y=y*TILE;ctx.fillStyle=(x+y)%2?'#cfc7b1':'#c5bca4';ctx.fillRect(X,Y,TILE,TILE);ctx.strokeStyle='rgba(0,0,0,.1)';ctx.strokeRect(X+.5,Y+.5,TILE,TILE);}
  const cx=cxOf(plaza),cy=plaza.y*TILE+TILE/2;ctx.fillStyle='rgba(0,0,0,.16)';ctx.beginPath();ctx.ellipse(cx,cy+12,19,6,0,0,7);ctx.fill();
  ctx.fillStyle=OUT;circle(cx,cy,18);ctx.fillStyle='#9aa3ad';circle(cx,cy,16);ctx.fillStyle='#7fb3d8';circle(cx,cy,11);ctx.fillStyle='#bfe0f2';circle(cx-3,cy-3,4);ctx.fillStyle='#8a929c';ctx.fillRect(R(cx-3),R(cy-11),6,11);ctx.fillStyle='#cfd4da';ctx.fillRect(R(cx-1),R(cy-11),2,11);}
function tallGrass(){for(const k of tallSet){const [x,y]=k.split(',').map(Number),X=x*TILE,Y=y*TILE;ctx.fillStyle='#4d9540';ctx.fillRect(X,Y,TILE,TILE);ctx.fillStyle='#3f7d35';ctx.fillRect(X,Y+TILE-4,TILE,4);ctx.fillStyle='#5aa84b';for(let c=0;c<6;c++)for(let r=0;r<2;r++){const bx=X+4+c*7,by=Y+14+r*15;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+3,by-9);ctx.lineTo(bx+6,by);ctx.fill();}}}
function forestTile(x,y,now){const X=x*TILE,Y=y*TILE;ctx.fillStyle=OUT;ctx.fillRect(X-2,Y-2,TILE+4,TILE+4);
  ctx.fillStyle='#2f7335';circle(X+12,Y+13,12);circle(X+32,Y+11,12);circle(X+21,Y+30,13);circle(X+37,Y+31,11);circle(X+8,Y+33,10);
  ctx.fillStyle='#3a8a40';circle(X+13,Y+11,8);circle(X+30,Y+22,8);circle(X+20,Y+30,7);
  ctx.fillStyle='#54a84e';circle(X+11,Y+8,4);circle(X+27,Y+18,3);circle(X+34,Y+28,3);
  ctx.fillStyle='#236128';ctx.fillRect(X+4,Y+TILE-6,TILE-8,3);}
function decorTree(x,y){const cx=x*TILE+TILE/2,cy=y*TILE+TILE/2;ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(cx,cy+15,12,4,0,0,7);ctx.fill();
  ctx.fillStyle=OUT;ctx.fillRect(R(cx-4),R(cy-1),8,17);ctx.fillStyle='#6b4626';ctx.fillRect(R(cx-3),R(cy),6,15);ctx.fillStyle='#7d5530';ctx.fillRect(R(cx-3),R(cy),2,15);
  ctx.fillStyle=OUT;circle(cx,cy-8,15);ctx.fillStyle='#2f7335';circle(cx,cy-8,13);ctx.fillStyle='#3a8a40';circle(cx-7,cy-5,8);circle(cx+8,cy-4,7);ctx.fillStyle='#54a84e';circle(cx-4,cy-12,5);circle(cx+6,cy-9,3);}
function bushSm(cx,cy){ctx.fillStyle=OUT;circle(cx,cy,9);ctx.fillStyle='#3a8a40';circle(cx,cy,8);circle(cx-5,cy+2,5);circle(cx+5,cy+2,5);ctx.fillStyle='#54a84e';circle(cx-2,cy-2,3);}
function fence(x0,y,len){const Y=y*TILE+TILE*0.62;for(let i=0;i<=len;i++){const X=x0*TILE+i*16;ctx.fillStyle=OUT;ctx.fillRect(X,Y-7,3,13);ctx.fillStyle='#efe6d2';ctx.fillRect(X,Y-7,2,12);}ctx.fillStyle='#efe6d2';ctx.fillRect(x0*TILE,Y-3,len*16,2);ctx.fillStyle=OUT;ctx.fillRect(x0*TILE,Y-4,len*16,1);}
function lamp(x,y){const cx=x*TILE+TILE/2,by=y*TILE+TILE*0.6;ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(cx,by+2,6,2,0,0,7);ctx.fill();ctx.fillStyle=OUT;ctx.fillRect(R(cx-2),R(by-22),4,24);ctx.fillStyle='#3a3f48';ctx.fillRect(R(cx-1),R(by-22),2,24);ctx.fillStyle=OUT;rr(R(cx-5),R(by-30),10,10,2);ctx.fill();ctx.fillStyle='#ffe08a';rr(R(cx-4),R(by-29),8,8,2);ctx.fill();ctx.fillStyle='#fff6cf';ctx.fillRect(R(cx-2),R(by-27),3,3);}

function house(name,now){
  const loc=DATA.locations[name],st=STYLES[name];const w=st.w*TILE,h=st.h*TILE;
  const cx=cxOf(loc),baseY=byOf(loc),L=R(cx-w/2),Rt=R(cx+w/2),wallH=R(h*0.5),roofH=R(h*0.55);
  const wallTop=R(baseY-wallH),roofTop=R(wallTop-roofH);
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(cx,baseY,w/2,7,0,0,7);ctx.fill();
  // chimney + smoke
  ctx.fillStyle=OUT;ctx.fillRect(Rt-18,roofTop+R(roofH*0.3),9,R(roofH*0.5)+8);ctx.fillStyle='#7a5a4a';ctx.fillRect(Rt-17,roofTop+R(roofH*0.3),7,R(roofH*0.5)+7);
  ctx.fillStyle='rgba(220,220,225,.5)';for(let k=0;k<3;k++){const sy=roofTop+R(roofH*0.3)-8-k*9-((now/120)%9);circle(Rt-13+Math.sin(now/300+k)*3,sy,3+k);}
  // walls (outlined)
  ctx.fillStyle=OUT;ctx.fillRect(L-1,wallTop-1,R(w)+2,wallH+2);
  ctx.fillStyle=st.wall;ctx.fillRect(L,wallTop,R(w),wallH);
  ctx.fillStyle='rgba(0,0,0,.06)';for(let py=wallTop+6;py<baseY;py+=6)ctx.fillRect(L,py,R(w),1);
  ctx.fillStyle='rgba(0,0,0,.08)';ctx.fillRect(Rt-6,wallTop,6,wallH);
  // roof (outlined gable + shingle rows)
  const ov=9;ctx.fillStyle=OUT;ctx.beginPath();ctx.moveTo(L-ov-1,wallTop+1);ctx.lineTo(R(cx),roofTop-1);ctx.lineTo(Rt+ov+1,wallTop+1);ctx.closePath();ctx.fill();
  ctx.fillStyle=st.roof;ctx.beginPath();ctx.moveTo(L-ov,wallTop);ctx.lineTo(R(cx),roofTop);ctx.lineTo(Rt+ov,wallTop);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1;for(let r=1;r<5;r++){const yy=wallTop-roofH*r/5,frac=1-r/5,hx=(w/2+ov)*frac;ctx.beginPath();ctx.moveTo(cx-hx,yy);ctx.lineTo(cx+hx,yy);ctx.stroke();for(let sx=-hx+6;sx<hx;sx+=10){ctx.beginPath();ctx.moveTo(cx+sx,yy);ctx.lineTo(cx+sx-3,yy-roofH/5);ctx.stroke();}}
  ctx.fillStyle='rgba(255,255,255,.14)';ctx.beginPath();ctx.moveTo(L-ov,wallTop);ctx.lineTo(R(cx),roofTop);ctx.lineTo(R(cx)-4,roofTop);ctx.lineTo(L-ov+5,wallTop);ctx.closePath();ctx.fill();
  // door
  const dw=R(w*0.22),dh=R(wallH*0.74);ctx.fillStyle=OUT;ctx.fillRect(R(cx-dw/2)-1,R(baseY-dh)-1,dw+2,dh+1);ctx.fillStyle='#7a4e28';ctx.fillRect(R(cx-dw/2),R(baseY-dh),dw,dh);ctx.fillStyle='#8a5a30';ctx.fillRect(R(cx-dw/2),R(baseY-dh),dw,3);ctx.fillStyle='#ffd24a';circle(R(cx+dw/2-3),R(baseY-dh*0.5),1.5);
  // windows w/ panes + flower box
  for(const wx of [L+9,Rt-21]){ctx.fillStyle=OUT;ctx.fillRect(wx-1,wallTop+7,14,14);ctx.fillStyle='#bfe2f2';ctx.fillRect(wx,wallTop+8,12,12);ctx.fillStyle='#dff2fb';ctx.fillRect(wx,wallTop+8,5,5);ctx.strokeStyle='#7d6a4a';ctx.beginPath();ctx.moveTo(wx+6,wallTop+8);ctx.lineTo(wx+6,wallTop+20);ctx.moveTo(wx,wallTop+14);ctx.lineTo(wx+12,wallTop+14);ctx.stroke();ctx.fillStyle='#6b4426';ctx.fillRect(wx-1,wallTop+20,14,3);ctx.fillStyle='#ef6f8f';ctx.fillRect(wx+1,wallTop+18,2,2);ctx.fillStyle='#f4d24a';ctx.fillRect(wx+6,wallTop+18,2,2);ctx.fillStyle='#c98ce6';ctx.fillRect(wx+10,wallTop+18,2,2);}
  // type extras
  if(st.type==='center'){ctx.fillStyle=OUT;rr(R(cx-13),wallTop-3,26,15,4);ctx.fill();ctx.fillStyle='#fff';rr(R(cx-12),wallTop-2,24,13,3);ctx.fill();ctx.fillStyle='#d24b46';ctx.fillRect(R(cx-2),wallTop+1,4,9);ctx.fillRect(R(cx-6),wallTop+4,12,3);}
  if(st.type==='gym'){ctx.fillStyle=OUT;ctx.fillRect(R(cx-(dw+12)/2)-1,R(baseY)-1,dw+13,10);ctx.fillStyle='#c7c8d0';for(let s=0;s<3;s++)ctx.fillRect(R(cx-(dw+10)/2),R(baseY+s*3),dw+10,3);ctx.fillStyle='#b54a4a';ctx.fillRect(L+R(w/2)-15,wallTop+3,30,7);ctx.fillStyle='#e8c46a';ctx.fillRect(L+R(w/2)-15,wallTop+3,30,2);}
  if(st.type==='bakery'){for(let k=0;k<5;k++){ctx.fillStyle=k%2?'#e58a8a':'#f5ede0';ctx.fillRect(L+10+k*((w-20)/5),wallTop+wallH-10,((w-20)/5),8);}ctx.fillStyle=OUT;ctx.fillRect(L+10,wallTop+wallH-2,R(w)-20,1);}
  if(st.type==='post'){ctx.fillStyle=OUT;ctx.fillRect(Rt-3,R(baseY-20)-1,9,21);ctx.fillStyle='#d23b3b';ctx.fillRect(Rt-2,R(baseY-19),7,19);ctx.fillStyle='#fff';ctx.fillRect(Rt-1,R(baseY-16),5,2);}
  if(st.type==='bar'){ctx.fillStyle=OUT;ctx.fillRect(R(cx-dw/2-9),R(baseY-dh-2),3,6);ctx.fillStyle='#ffb24a';circle(cx-dw/2-7,baseY-dh+6,4);ctx.fillStyle='#fff0c0';circle(cx-dw/2-8,baseY-dh+5,1.5);}
  if(st.type==='farm'){ctx.fillStyle='#6b4322';for(let r=0;r<3;r++){ctx.fillRect(Rt+4,R(baseY-20+r*8),30,5);ctx.fillStyle='#57a23c';for(let c=0;c<5;c++)ctx.fillRect(Rt+6+c*6,R(baseY-21+r*8),2,3);ctx.fillStyle='#6b4322';}}
  // signboard on a post
  ctx.fillStyle=OUT;ctx.fillRect(R(cx)-1,R(baseY+2),2,9);const lw=name.length*11+10;ctx.fillStyle=OUT;ctx.fillRect(R(cx-lw/2)-1,R(baseY+9),lw+2,15);ctx.fillStyle='#caa46a';ctx.fillRect(R(cx-lw/2),R(baseY+10),lw,13);ctx.fillStyle='#3a2a16';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(name,cx,R(baseY+20));
}
function person(s,now){const x=s.px,y=s.py,c=COLORS[s.name]||'#fff',hair=HAIR[s.name]||'#333',d=s.dir;
  ctx.fillStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.ellipse(x,y+13,8,3,0,0,7);ctx.fill();
  const moving=Math.abs(s.tx-s.px)+Math.abs(s.ty-s.py)>1,wob=moving?Math.sin(now/110)*1.6:0;
  ctx.fillStyle=OUT;ctx.fillRect(R(x-5),R(y+5),4,9);ctx.fillRect(R(x+1),R(y+5),4,9);
  ctx.fillStyle='#33405a';ctx.fillRect(R(x-4),R(y+5-Math.max(0,wob)),3,7);ctx.fillRect(R(x+1),R(y+5-Math.max(0,-wob)),3,7);
  ctx.fillStyle='#222';ctx.fillRect(R(x-4),R(y+12-Math.max(0,wob)),3,2);ctx.fillRect(R(x+1),R(y+12-Math.max(0,-wob)),3,2);
  ctx.fillStyle=OUT;ctx.fillRect(R(x-7),R(y-5),14,12);
  ctx.fillStyle=c;ctx.fillRect(R(x-6),R(y-4),12,10);ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(R(x-6),R(y-4),12,2);ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(R(x-6),R(y+4),12,2);
  ctx.fillStyle=OUT;ctx.fillRect(R(x-9),R(y-3),3,8);ctx.fillRect(R(x+6),R(y-3),3,8);ctx.fillStyle=c;ctx.fillRect(R(x-8),R(y-3),2,7);ctx.fillRect(R(x+6),R(y-3),2,7);ctx.fillStyle='#f2c9a0';ctx.fillRect(R(x-8),R(y+3),2,2);ctx.fillRect(R(x+6),R(y+3),2,2);
  ctx.fillStyle=OUT;ctx.fillRect(R(x-5),R(y-15),10,11);ctx.fillStyle='#f2c9a0';ctx.fillRect(R(x-4),R(y-14),8,9);ctx.fillStyle='#e8b890';ctx.fillRect(R(x-4),R(y-6),8,1);
  ctx.fillStyle=hair;ctx.fillRect(R(x-5),R(y-16),10,5);ctx.fillRect(R(x-5),R(y-14),2,5);ctx.fillRect(R(x+3),R(y-14),2,5);
  ctx.fillStyle='#2a2a2a';ctx.fillRect(R(x-2+(d>0?1:-1)),R(y-10),1,2);ctx.fillRect(R(x+1+(d>0?1:-1)),R(y-10),1,2);
  ctx.fillStyle='#e89a9a';ctx.fillRect(R(x-3),R(y-8),1,1);ctx.fillRect(R(x+2),R(y-8),1,1);
  ctx.fillStyle='rgba(15,19,25,.75)';const nw=s.name.length*9+6;rr(R(x-nw/2),R(y-29),nw,12,3);ctx.fill();ctx.fillStyle=c;ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(s.name,x,R(y-20));
}
function bubble(s,now){const age=now-s.t;if(!s.say||age>3600)return;const txt=s.say.length>24?s.say.slice(0,23)+'…':s.say;ctx.font='10px sans-serif';const w=ctx.measureText(txt).width+16;const bx=Math.max(4,Math.min(W-w-4,s.px-w/2)),by=s.py-47;ctx.fillStyle=OUT;rr(bx-1,by-1,w+2,20,7);ctx.fill();ctx.fillStyle='rgba(255,255,255,.98)';rr(bx,by,w,18,6);ctx.fill();ctx.fillStyle=OUT;ctx.beginPath();ctx.moveTo(s.px-5,by+17);ctx.lineTo(s.px+5,by+17);ctx.lineTo(s.px,by+25);ctx.fill();ctx.fillStyle='rgba(255,255,255,.98)';ctx.beginPath();ctx.moveTo(s.px-4,by+17);ctx.lineTo(s.px+4,by+17);ctx.lineTo(s.px,by+23);ctx.fill();ctx.fillStyle='#1a1f29';ctx.textAlign='center';ctx.fillText(txt,bx+w/2,by+12);}

function draw(now){
  ground(); water(now); paths(); drawPlaza(); tallGrass(); flowers();
  fence(2,3,3); fence(2,11,0); fence(11,9,4);
  for(const [x,y] of LAMPS) lamp(x,y);
  bushSm(plaza.x*TILE+6,plaza.y*TILE-2); bushSm(plaza.x*TILE+TILE+4,plaza.y*TILE+TILE+6);
  const items=[];
  for(const k of treeSet){const [x,y]=k.split(',').map(Number);items.push({y:y*TILE+TILE,kind:'forest',x,ty:y});}
  for(const [x,y] of DECOR)items.push({y:y*TILE+TILE/2+15,kind:'decor',x,ty:y});
  for(const n in STYLES)items.push({y:byOf(DATA.locations[n]),kind:'house',n});
  for(const s of sprites){s.px+=(s.tx-s.px)*0.12;s.py+=(s.ty-s.py)*0.12;items.push({y:s.py+13,kind:'person',s});}
  items.sort((a,b)=>a.y-b.y);
  for(const it of items){if(it.kind==='forest')forestTile(it.x,it.ty,now);else if(it.kind==='decor')decorTree(it.x,it.ty);else if(it.kind==='house')house(it.n,now);else person(it.s,now);}
  for(const s of sprites) bubble(s,now);
  if(raining){ctx.strokeStyle='rgba(160,190,235,.45)';ctx.lineWidth=1;for(let i=0;i<130;i++){const x=(i*53+now/7)%W,y=(i*97+now/2.5)%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+9);ctx.stroke();}ctx.fillStyle='rgba(20,30,55,.14)';ctx.fillRect(0,0,W,H);}
  // soft vignette
  ctx.fillStyle='rgba(20,30,15,.06)';ctx.fillRect(0,0,W,6);ctx.fillRect(0,H-6,W,6);
  requestAnimationFrame(draw);
}
document.getElementById('play').onclick=()=>{playing=!playing;setBtn();if(playing&&fi>=DATA.frames.length-1){fi=0;document.getElementById('chron').style.display='none';applyFrame(0);}};
document.getElementById('restart').onclick=()=>{fi=0;playing=true;setBtn();document.getElementById('chron').style.display='none';applyFrame(0);};
applyFrame(0);
setInterval(()=>{if(!playing)return;fi++;if(fi>=DATA.frames.length){playing=false;setBtn();return;}applyFrame(fi);},4000);
requestAnimationFrame(draw);
