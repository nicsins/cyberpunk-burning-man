// Seeded headless physics tests (same harness as the look-dev suite: seeded Math.random + virtual clock).
// Usage: node physics.test.mjs <gameDir> [shotsDir]
import {serve,launch} from './harness.mjs';
const [,,gameDir='..',shots]=process.argv;
const srv=await serve(gameDir); const {browser,page}=await launch(640,360);
const errs=[],reqs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
page.on('request',r=>reqs.push(r.url()));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[]; const ok=(name,pass,info)=>{results.push({name,pass:!!pass,info});console.log((pass?'PASS ':'FAIL ')+name+(info?'  '+JSON.stringify(info):''))};
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'load',timeout:120000});
await page.waitForFunction(()=>document.getElementById('loading').style.display==='none',{timeout:180000,polling:250});
ok('lazy: no Rapier/wasm requested on the title screen',!reqs.some(u=>/rapier/.test(u)),{requests:reqs.filter(u=>/rapier/.test(u)).length});
await page.click('#card-dragon'); await page.click('#start-btn'); await sleep(1500);
await page.waitForFunction(()=>window.__cbmPhys&&__cbmPhys.ready,{timeout:60000,polling:200});
ok('Rapier loaded after start',true,{wasm:reqs.some(u=>/rapier_wasm3d_bg\.wasm/.test(u))});

// --- pure-sim tests in page (fresh worlds with the game's real collider set) ---
const R=await page.evaluate(async()=>{
  const {PHYS,specs}=__cbmPhys; const RA=await PHYS.loadRapier(); const out={};
  const fresh=(x,y,z)=>{const P=PHYS.makePlayer({x,y,z});PHYS.attachPhysics(RA,P,specs);return P};
  const inp=o=>({f:0,b:0,l:0,r:0,jump:false,up:false,down:false,yaw:0,...o});
  // 1 determinism: same scripted inputs twice -> bit-identical trajectory
  const script=P=>{const i=inp({});const tr=[];for(let k=0;k<900;k++){i.f=k%300<200;i.r=k%170<40;i.yaw=Math.sin(k*0.01)*2;if(k%97===0)i.jump=true;PHYS.stepPlayer(P,i);tr.push(P.pos.x,P.pos.y,P.pos.z)}return tr};
  const a=script(fresh(3,0,30)),b=script(fresh(3,0,30));
  out.det={identical:a.every((v,i)=>v===b[i]),n:a.length/3,end:a.slice(-3)};
  // 2 no pass-through: walk at each collider type from 8 m on +x, facing -x (yaw=pi/2), for 5 s
  out.walls={};
  const pick=t=>specs.find(s=>s.tag===t);
  for(const tag of ['man-plinth','temple-base','temple-pillar','station-pad','npc','crate']){
    const s=pick(tag); if(!s){out.walls[tag]='missing';continue}
    const ext=s.type==='box'?Math.max(s.hx,s.hz)*1.42:s.r, inner=s.type==='box'?Math.min(s.hx,s.hz):s.r;
    const top=s.type==='box'?s.y+s.hy:s.y+s.h/2;
    const P=fresh(s.x+ext+6,0,s.z); const i=inp({f:true,yaw:Math.PI/2}); let minD=1e9,maxY=0,onTop=false;
    for(let k=0;k<300;k++){PHYS.stepPlayer(P,i);const d=Math.hypot(P.pos.x-s.x,P.pos.z-s.z);if(d<minD){minD=d;onTop=P.pos.y>=top-0.06}maxY=Math.max(maxY,P.pos.y)}
    // capsule axis must never get closer than obstacle's inscribed radius + capsule radius (0.35) - 2 cm skin, unless standing on top (autostep <=0.45 m)
    out.walls[tag]={minAxisDist:+minD.toFixed(3),limit:+(inner+0.33).toFixed(3),top:+top.toFixed(2),maxFeetY:+maxY.toFixed(2),onTopAtClosest:onTop,blocked:minD>=inner+0.33||onTop};
  }
  // 3 landing from flight: no teleport, soft touchdown, no hop
  {const P=fresh(60,18,60);P.flying=true;const i=inp({});for(let k=0;k<30;k++)PHYS.stepPlayer(P,i);P.landing=true;let k=0,maxStepDown=0;
   while(P.flying&&k<1200){const y0=P.pos.y;PHYS.stepPlayer(P,i);maxStepDown=Math.max(maxStepDown,y0-P.pos.y);k++}
   let hop=0;for(let j=0;j<120;j++){PHYS.stepPlayer(P,i);hop=Math.max(hop,P.pos.y)}
   out.land={landed:!P.flying,seconds:+(k/60).toFixed(2),feetY:+P.pos.y.toFixed(3),maxDropPerStep:+maxStepDown.toFixed(3),hopAfter:+hop.toFixed(3),grounded:P.grounded}}
  // 3b descend key works in flight
  {const P=fresh(70,10,70);P.flying=true;const i=inp({down:true});for(let k=0;k<120;k++)PHYS.stepPlayer(P,i);out.descend={from:10,to:+P.pos.y.toFixed(2)}}
  // 4 FPS independence via the accumulator: 2 s of walking + a jump at frame rates 144/60/30/10/3
  out.fps={};
  for(const fps of [144,60,30,10,3]){const P=fresh(-80,0,80),st={acc:0},i=inp({f:true,yaw:0.3});let apex=0,t=0;
    i.jump=true; while(t<2-1e-9){PHYS.advance(st,P,i,1/fps);t+=1/fps}apex=P.apex;
    out.fps[fps]={steps:P.steps,x:+P.pos.x.toFixed(4),z:+P.pos.z.toFixed(4),apex:+apex.toFixed(4)}}
  // 5 huge dt clamp
  {const P=fresh(-90,0,90),st={acc:0};const r=PHYS.advance(st,P,inp({}),5);out.clamp={steps:r.steps}}
  return out;
});
ok('deterministic stepping (900 scripted steps, two runs bit-identical)',R.det.identical,R.det);
for(const [k,v] of Object.entries(R.walls))ok(`collider blocks player: ${k}`,v&&v.blocked,v);
ok('landing: glides down, soft touchdown, no hop',R.land.landed&&Math.abs(R.land.feetY)<0.05&&R.land.hopAfter<0.05&&R.land.maxDropPerStep<0.25,R.land);
ok('flight: descend key lowers altitude',R.descend.to<6,R.descend);
const F=Object.values(R.fps),ref=R.fps[60];
ok('FPS independence: same distance & jump apex at 144/60/30/10/3 fps',F.every(f=>Math.abs(f.steps-ref.steps)<=1&&Math.abs(f.x-ref.x)<0.08&&Math.abs(f.z-ref.z)<0.08&&Math.abs(f.apex-ref.apex)<0.01),R.fps);
ok('huge dt clamped (5 s hitch -> 30 steps max)',R.clamp.steps<=30,R.clamp);

// --- in-game with real keyboard input under the virtual clock ---
await page.mouse.click(320,180); await sleep(400);
await page.evaluate(()=>__vt.enable());
// the rAF that was queued before the virtual clock took over must fire first, or every step below is a no-op
await page.waitForFunction(()=>__vt.step(0)>0,{polling:50,timeout:30000});
const step=ms=>page.evaluate(ms=>__vt.step(ms),ms);
for(let i=0;i<10;i++)await step(1000/30);
// hero visibility after spawn: visible, texture decoded, inside the camera frustum, not near-plane clipped
const H=await page.evaluate(()=>{const h=__cbmPhys.hero,c=__dbg.camera;c.updateMatrixWorld();h.updateMatrixWorld();
  const V=h.position.constructor,wp=h.getWorldPosition(new V()),img=h.material.map&&h.material.map.image;
  const r=new V().setFromMatrixColumn(c.matrixWorld,0),u=new V().setFromMatrixColumn(c.matrixWorld,1);
  const sx=h.scale.x/2,sy=h.scale.y/2,pts=[[0,0],[-sx,-sy],[sx,-sy],[-sx,sy],[sx,sy]].map(([a,b])=>wp.clone().addScaledVector(r,a).addScaledVector(u,b).project(c));
  const inside=p=>Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&p.z>-1&&p.z<1;
  const camSpaceZ=-wp.clone().applyMatrix4(c.matrixWorldInverse).z;
  return {visible:h.visible,camMode:__cbmPhys.camMode,texReady:!!(img&&img.complete!==false&&img.width>0),centerNDC:[+pts[0].x.toFixed(3),+pts[0].y.toFixed(3)],
    cornersInside:pts.slice(1).filter(inside).length,centerInside:inside(pts[0]),depth:+camSpaceZ.toFixed(2),near:c.near}});
ok('hero sprite visible and inside the camera frustum after spawn (not near-clipped)',H.visible&&H.texReady&&H.centerInside&&H.cornersInside>=3&&H.depth>H.near+1,H);
await page.keyboard.press('KeyV'); await step(1000/30);
const fp=await page.evaluate(()=>({mode:__cbmPhys.camMode,visible:__cbmPhys.hero.visible}));
await page.keyboard.press('KeyV'); await step(1000/30);
ok('V toggles first person (hero hidden) and back',fp.mode==='first'&&!fp.visible&&await page.evaluate(()=>__cbmPhys.camMode==='third'&&__cbmPhys.hero.visible),fp);
await page.evaluate(()=>{const {P}=__cbmPhys;P.pos={x:20,y:0,z:0};P.prev={...P.pos};P.phys.body.setTranslation({x:20,y:0.85,z:0},true);
  __dbg.camera.position.set(20,1.7,0);__dbg.camera.lookAt(0,1.7,0)});
await page.keyboard.down('KeyW'); for(let i=0;i<150;i++)await step(1000/30); await page.keyboard.up('KeyW');
const g=await page.evaluate(()=>{const p=__cbmPhys.P.pos,c=__dbg.camera.position;return {x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),camR:+Math.hypot(c.x,c.z).toFixed(2),camY:+c.y.toFixed(2),locked:__dbg.isLocked}});
if(shots)await page.screenshot({path:shots+'/test-blocked-at-plinth.png'});
ok('in-game (real W key): walked from r=20 and stopped at The Man plinth edge (r=12)',Math.hypot(g.x,g.z)>11.5&&Math.hypot(g.x,g.z)<13,g);
ok('chase camera not inside the plinth',g.camR>12||g.camY>1.7,g);
const y0=await page.evaluate(()=>__cbmPhys.P.pos.y);
await page.keyboard.press('Space'); let apex=0; for(let i=0;i<60;i++){await step(1000/60);apex=Math.max(apex,await page.evaluate(()=>__cbmPhys.P.pos.y))}
ok('in-game jump apex ≈1.6 m (feet)',Math.abs(apex-y0-1.6)<0.1,{apex:+(apex-y0).toFixed(3)});
ok('no page/console errors',errs.length===0,errs.slice(0,5));
const fails=results.filter(r=>!r.pass).length; console.log(`\n${results.length-fails}/${results.length} passed`);
await browser.close(); srv.close(); process.exit(fails?1:0);
