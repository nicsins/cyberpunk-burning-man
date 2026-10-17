
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as LOOK from './lookdev.js';
import * as PHYS from './physics.js';   // small; Rapier itself is lazy-loaded after the title screen

const CDN = 'https://cdn.jsdelivr.net/gh/nicsins/cyberpunk-burning-man@fae0c84/assets/';
// Local fallback when served from same origin
const LOCAL = 'assets/';
const useLocal = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

let scene,camera,renderer,controls,player,playerMesh,clock,loader;
let selectedChar=null,velocity=new THREE.Vector3(),direction=new THREE.Vector3();
let moveForward=false,moveBackward=false,moveLeft=false,moveRight=false,canJump=false,isLocked=false,dialogueOpen=false;
let npcs=[],installations=[],theMan,dustParticles,collectibles=[],generators=[],itemLights=[];
let tokens=0,inventory={},quests=[],panelOpen=false;
let textures={};
let gamePhase='collect'; // collect | drone | defend | burn | complete
let isFlying=false,flyHeight=0,pandaRiding=false;
let rogueDrones=[],enemyNpcs=[],fires=[],suppressDrones=[];
let manIntegrity=100,appsDeployed=0,zpegsPlaced=0,questsDone=0;
let frostCooldown=0,attackCooldown=0,droneWaveCleared=false;
let phaseUnlocked={drone:false,defend:false,burn:false};
let labels=[];
// physics: fixed-step player (physics.js) + lazily attached Rapier world
let P=null,physState={acc:0},physInput={f:0,b:0,l:0,r:0,jump:false,up:false,down:false,yaw:0},colliderSpecs=[],crateData=[],physLoading=null;
const _eul=new THREE.Euler(0,0,0,'YXZ'),_fwd=new THREE.Vector3();
// look-dev layer (lookdev.js)
let composer,skyGroup,dustGroup,manGlow,carGlow,itemRings,lightPool,lightCandidates=[],staticGlow;

const ITEM_DEFS={
  'neon-shard':{name:'Neon Shard',emoji:'💠',tex:'item_shard'},
  'fiber-coil':{name:'Fiber Coil',emoji:'🌀'},
  'dust-core':{name:'Dust Core',emoji:'🟤'},
  'quantum-spark':{name:'Quantum Spark',emoji:'✨',tex:'item_spark'},
  'circuit-board':{name:'Circuit Board',emoji:'📟'},
  'plasma-vial':{name:'Plasma Vial',emoji:'🧪'},
  'token-chip':{name:'Token Chip',emoji:'🪙'},
  'zpeg-kit':{name:'ZPEG Kit',emoji:'⚡'},
  'escrow-key':{name:'Escrow Key',emoji:'🔑'},
  'vonnect-log':{name:'Vonnect Log',emoji:'📋'},
  'auction-badge':{name:'Auction Badge',emoji:'🏛️'},
  'creator-seed':{name:'Creator Seed',emoji:'🧬',tex:'item_creator'},
  'weapon-shard':{name:'Plasma Rifle Shard',emoji:'🔫'},
  'frost-core':{name:'Frost Core',emoji:'❄️'},
  'suppress-kit':{name:'Suppress Kit',emoji:'🚁'}
};

const NPC_DATA=[
  {name:'Neon Shaman',sprite:'npc_shaman_hd',fallback:'npc_shaman',text:'The Man rises with circuits and soul. Bring me 3 Neon Shards and I teach the first Zero-Point rite.',quest:{id:'shards',need:{'neon-shard':3},reward:{tokens:25,items:{'quantum-spark':1}},done:false}},
  {name:'Dust Runner',sprite:'npc_pilot',text:'Art cars need fuel. Collect 2 Dust Cores and 1 Plasma Vial — I pay in tokens.',quest:{id:'fuel',need:{'dust-core':2,'plasma-vial':1},reward:{tokens:40},done:false}},
  {name:'Holo Scribe',sprite:'npc_scribe',text:'Leave no trace… except memories. I need a Vonnect Log and a Circuit Board for the Omega archive.',quest:{id:'archive',need:{'vonnect-log':1,'circuit-board':1},reward:{tokens:50,items:{'token-chip':2}},done:false}},
  {name:'Chrome Fox',sprite:'npc_fox_hd',fallback:'npc_fox',text:'Dragon or Panda — both sacred. Find me an Escrow Key and I open a FairForge deal.',quest:{id:'escrow',need:{'escrow-key':1},reward:{tokens:60},done:false}},
  {name:'Laser Monk',sprite:'npc_monk',text:'The Man is the collective dream. Bring a Creator Seed and I bless your self-evolving agents.',quest:{id:'seed',need:{'creator-seed':1},reward:{tokens:80,items:{'zpeg-kit':1}},done:false}},
  {name:'x402 Broker',sprite:'npc_engineer',text:'I run micro-pay nodes. Bring 2 Token Chips + 1 Circuit Board and I spin up a paid endpoint.',quest:{id:'x402',need:{'token-chip':2,'circuit-board':1},reward:{tokens:100},done:false}},
  {name:'Auctioneer Vex',sprite:'npc_auctioneer',text:'Everything has a price. Get an Auction Badge and you can list rare items for tokens.',quest:{id:'badge',need:{'auction-badge':1},reward:{tokens:30},done:false}},
  {name:'ZPEG Engineer',sprite:'npc_engineer',text:'Zero-point energy is real. Craft/find a ZPEG Kit, place a generator near The Man, watch tokens flow.',quest:{id:'zpeg',need:{'zpeg-kit':1,'quantum-spark':1},reward:{tokens:75},done:false}},
  {name:'Omega Watcher',sprite:'npc_scribe',text:'I monitor the Vonnect mesh. Deliver 3 Fiber Coils and I sync your daily actions to the ledger.',quest:{id:'fiber',need:{'fiber-coil':3},reward:{tokens:35,items:{'vonnect-log':1}},done:false}},
  {name:'Temple Keeper',sprite:'npc_shaman',text:'The Temple holds secrets. Bring a Plasma Vial and a Neon Shard for the sacred circuit.',quest:{id:'temple',need:{'plasma-vial':1,'neon-shard':1},reward:{tokens:45,items:{'frost-core':1}},done:false}},
  {name:'Art Car Pilot',sprite:'npc_pilot',text:'My mutant vehicle needs a Dust Core and Fiber Coil. Tokens await. After drones clear, I help defend The Man.',quest:{id:'car',need:{'dust-core':1,'fiber-coil':1},reward:{tokens:30,items:{'weapon-shard':1}},done:false}},
  {name:'Symbiote',sprite:'npc_fox',text:'Human + AI. Bring a Creator Seed and Escrow Key — we write a symbiotic contract together.',quest:{id:'symbio',need:{'creator-seed':1,'escrow-key':1},reward:{tokens:120,items:{'suppress-kit':1}},done:false}}
];

let auctionListings=[
  {item:'quantum-spark',price:40,seller:'System'},
  {item:'zpeg-kit',price:90,seller:'ZPEG Engineer'},
  {item:'creator-seed',price:70,seller:'Laser Monk'},
  {item:'suppress-kit',price:55,seller:'Symbiote'}
];

function assetUrl(name){
  const base = useLocal ? LOCAL : CDN;
  if(name.includes('.')) return base + name;
  // prefer known extensions
  if(name==='ground') return base + 'ground.jpg';
  if(name==='item_creator') return base + 'item_creator.png';
  return base + name + '.png';
}

function loadTexture(path){
  return new Promise((resolve)=>{
    loader.load(path,(tex)=>{
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.generateMipmaps=true;
      tex.minFilter=THREE.LinearMipmapLinearFilter;
      resolve(tex);
    },undefined,()=>{
      const c=document.createElement('canvas');c.width=c.height=64;
      const ctx=c.getContext('2d');ctx.fillStyle='#0ff';ctx.fillRect(0,0,64,64);
      resolve(new THREE.CanvasTexture(c));
    });
  });
}

async function init(){
  loader=new THREE.TextureLoader();
  scene=new THREE.Scene();
  scene.background=LOOK.HAZE.clone();
  scene.fog=new THREE.FogExp2(LOOK.HAZE,0.006);   // v2 §1.3: fog = sky hue #0c1329 (+ the sky's horizon haze)

  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,0.1,900);
  camera.position.set(0,1.7,28);

  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;                 // ACES is applied once, in OutputPass
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // Lighting (v2 §1.3): 1 moon (only shadow light) + hemisphere + env map. Neon = emissive + bloom.
  scene.environment=LOOK.makeEnv(renderer);
  const moon=new THREE.DirectionalLight(LOOK.PAL.coolHi,1.5);
  moon.position.set(-70,55,-35);moon.castShadow=true;
  moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:260});
  moon.shadow.bias=-0.0004;moon.shadow.normalBias=0.04;scene.add(moon);
  scene.add(new THREE.HemisphereLight(LOOK.PAL.fur,LOOK.PAL.playa,0.55));
  staticGlow=new LOOK.GlowLayer(96);scene.add(staticGlow.mesh);   // fake light pools on the playa (1 draw)

  // Palette-mapped neon (green / lime / hot pink removed per v2 §1.3)
  const neonCols=[0xff00ff,0x00ffff,0xff6600,0x00ff88,0xff0088,0x88ff00,0xffaa00].map(LOOK.pal);
  for(let i=0;i<16;i++){            // was 16 ambient PointLights → ground light pools
    const a=(i/16)*Math.PI*2,r=18+Math.random()*50;Math.random();
    staticGlow.add(Math.cos(a)*r,Math.sin(a)*r,7,neonCols[i%7],0.22);
  }

  // Ground
  const gTex=await loadTexture(assetUrl('ground.jpg'));
  const ground=LOOK.makeGround(gTex);scene.add(ground);      // + procedural crack normal/ORM, macro dust tint
  scene.add(LOOK.makeTireTracks());                          // art-car loops + bike tracks (1 draw)

  // Sky: palette gradient + horizon haze + aurora bands + twinkling stars (replaces Points stars + 5 aurora planes)
  skyGroup=LOOK.makeSky();scene.add(skyGroup);
  for(let i=0;i<4500*3;i++)Math.random();   // keep the seeded layout identical to the old build

  // Dust + low haze (GPU-animated; replaces the CPU-updated Points)
  dustGroup=LOOK.makeDust();scene.add(dustGroup);
  for(let i=0;i<2200*3;i++)Math.random();

  // THE MAN — HD holographic sprite + neon rings + platform
  theMan=new THREE.Group();
  // Plinth: Holo Steel (v2 §3) with grime/roughness variation + cyan emissive trims
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(10,12,1.6,48),LOOK.pbr(LOOK.PAL.holoDark,{rough:0.5,metal:0.85,env:0.9}));
  plinth.castShadow=plinth.receiveShadow=true;theMan.add(plinth);
  for(const [r,y] of [[10.02,0.78],[11.0,-0.02],[12.03,-0.76]]){
    const trim=new THREE.Mesh(new THREE.TorusGeometry(r,0.05,6,96),new THREE.MeshBasicMaterial({color:LOOK.neon(LOOK.PAL.cyan,3.2)}));
    trim.rotation.x=Math.PI/2;trim.position.y=y;trim.userData.static=true;theMan.add(trim);
  }
  // energy core: ice-blue holo (was magenta)
  const core=new THREE.Mesh(new THREE.SphereGeometry(1.4,24,16),new THREE.MeshBasicMaterial({color:LOOK.neon(LOOK.PAL.ice,1.5),transparent:true,opacity:0.8}));
  core.position.y=2.2;theMan.add(core);
  for(let i=0;i<8;i++){ // 8 rings alternate violet / cyan (v2 §4.1: same rings as the overseer halo)
    const ring=new THREE.Mesh(new THREE.TorusGeometry(7+i*1.6,0.07,8,96),new THREE.MeshBasicMaterial({color:LOOK.neon(i%2?LOOK.PAL.violet:LOOK.PAL.cyan,2.8),transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false}));
    ring.position.y=2+i*3.2;ring.rotation.x=Math.PI/2;theMan.add(ring);
  }
  manGlow=LOOK.makeManGlow();theMan.add(manGlow);             // light shaft + halo (emissive only)
  staticGlow.add(0,0,22,LOOK.PAL.cyan,0.35);
  // HD Man billboard (loaded after textures — placeholder group child added later)
  theMan.userData.needsManSprite=true;
  const mL=new THREE.PointLight(LOOK.PAL.cyan,140,70,2);mL.position.set(0,7,4);theMan.add(mL);   // The Man's one real light
  theMan.position.set(0,0.9,0);scene.add(theMan);installations.push(theMan);

  // Fiber forest
  const fGeo=new THREE.CylinderGeometry(0.035,0.06,1,5,4).translate(0,0.5,0);
  {const c=[],pa=fGeo.attributes.position;for(let k=0;k<pa.count;k++){const t=Math.pow(pa.getY(k),2.2);c.push(0.08+t*1.4,0.08+t*1.4,0.08+t*1.4)}fGeo.setAttribute('color',new THREE.Float32BufferAttribute(c,3))}
  const fiber=new THREE.InstancedMesh(fGeo,new THREE.MeshBasicMaterial({vertexColors:true,color:new THREE.Color(2.4,2.4,2.4)}),70);
  {const fm=new THREE.Matrix4();for(let i=0;i<70;i++){
    const h=2.5+Math.random()*7;const a=Math.random()*Math.PI*2,r=16+Math.random()*65;
    fm.makeScale(1,h,1).setPosition(Math.cos(a)*r,0,Math.sin(a)*r);fiber.setMatrixAt(i,fm);fiber.setColorAt(i,new THREE.Color(neonCols[i%7]));
  }}
  scene.add(fiber);

  // Floating pyramids / diamonds
  for(let i=0;i<16;i++){
    const pyR=2+Math.random()*2,pyWire=Math.random()>0.4;
    const py=new THREE.Mesh(new THREE.OctahedronGeometry(pyR,0),pyWire
      ?new THREE.MeshBasicMaterial({color:LOOK.neon(neonCols[i%7],2.4),wireframe:true})                    // neon edges → bloom
      :new THREE.MeshStandardMaterial({color:LOOK.PAL.glassDark,roughness:0.12,metalness:0.6,transparent:true,opacity:0.6,emissive:neonCols[i%7],emissiveIntensity:0.22,envMapIntensity:2.0,flatShading:true})); // neon glass
    const a=(i/10)*Math.PI*2+0.2,r=36+Math.random()*35;
    py.position.set(Math.cos(a)*r,4+Math.random()*3,Math.sin(a)*r);
    py.userData={float:true,baseY:py.position.y,phase:Math.random()*Math.PI*2};
    scene.add(py);installations.push(py);
  }

  // Art cars — placeholder groups; sprites attached after texture load
  for(let i=0;i<10;i++){
    const car=new THREE.Group();
    car.userData.glowColor=neonCols[i%7];   // was PointLight(4,22) → underglow pool + light-pool candidate
    const a=Math.random()*Math.PI*2,r=48+Math.random()*50;
    car.position.set(Math.cos(a)*r,1.4,Math.sin(a)*r);
    car.userData={isCar:true,speed:0.008+Math.random()*0.025,radius:r,angle:a,needsArtcar:true};
    scene.add(car);installations.push(car);
  }

  // Temple
  const temple=new THREE.Group();
  // Temple: Ω violet role. Dust-brick base, playa-wood pillars with violet seams, neon-glass roof.
  const tBase=new THREE.Mesh(new THREE.BoxGeometry(13,0.9,13),LOOK.pbr(LOOK.PAL.playa,{rough:0.95,metal:0.0,env:0.3}));
  tBase.castShadow=tBase.receiveShadow=true;temple.add(tBase);
  const pillarMat=LOOK.pbr(LOOK.PAL.woodMid,{rough:0.85,metal:0.05,seam:LOOK.PAL.violet,seamK:3.2});
  for(let i=0;i<4;i++){
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.9,11,0.9),pillarMat);p.castShadow=true;
    p.position.set((i%2?4.5:-4.5),5.5,(i<2?4.5:-4.5));temple.add(p);
  }
  const roof=new THREE.Mesh(new THREE.ConeGeometry(9,5,4),new THREE.MeshStandardMaterial({color:LOOK.PAL.glassDark,transparent:true,opacity:0.75,roughness:0.15,metalness:0.5,emissive:LOOK.PAL.violet,emissiveIntensity:0.35,envMapIntensity:1.2,flatShading:true}));
  roof.position.y=13;temple.add(roof);
  const roofEdge=new THREE.LineSegments(new THREE.EdgesGeometry(roof.geometry),new THREE.LineBasicMaterial({color:LOOK.neon(LOOK.PAL.violet,3)}));
  roofEdge.position.y=13;temple.add(roofEdge);
  staticGlow.add(-62,-36,12,LOOK.PAL.violet,0.4);
  temple.position.set(-62,0,-36);scene.add(temple);installations.push(temple);

  // Geodesic-ish domes
  for(let i=0;i<4;i++){
    const dome=new THREE.Mesh(new THREE.SphereGeometry(5+i,12,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:LOOK.neon(LOOK.PAL.violet,1.9),transparent:true,opacity:0.8,wireframe:true}));
    const a=i*1.6+0.5,r=45+i*12;
    dome.position.set(Math.cos(a)*r,0,Math.sin(a)*r);
    staticGlow.add(dome.position.x,dome.position.z,6+i,LOOK.PAL.violet,0.18);
    scene.add(dome);installations.push(dome);
  }

  // Omega station pads
  const stations=[{name:'ZPEG Field',pos:[14,0,12],color:LOOK.PAL.gold},{name:'x402 Node',pos:[-16,0,22],color:LOOK.PAL.cyan},{name:'Auction House',pos:[30,0,-24],color:LOOK.PAL.gold},{name:'Escrow Terminal',pos:[-34,0,-18],color:LOOK.PAL.violet}];
  stations.forEach(s=>{
    // scrap-metal pad + emissive role-colour ring (was emissive slab + PointLight beacon)
    const st=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.8,0.35,24),LOOK.pbr(LOOK.PAL.scrapDark,{rough:0.6,metal:0.7}));
    st.position.set(s.pos[0],0.2,s.pos[2]);st.userData={isStation:true,stationName:s.name};st.castShadow=st.receiveShadow=true;
    const stRing=new THREE.Mesh(new THREE.TorusGeometry(1.45,0.045,6,48),new THREE.MeshBasicMaterial({color:LOOK.neon(s.color,3.4)}));
    stRing.rotation.x=Math.PI/2;stRing.position.y=0.18;st.add(stRing);
    scene.add(st);installations.push(st);
    staticGlow.add(s.pos[0],s.pos[2],5,s.color,0.5);
    lightCandidates.push({pos:new THREE.Vector3(s.pos[0],2.3,s.pos[2]),color:s.color});
  });

  // Set dressing: lamp posts, cables + string lights, scrap crates (instanced; ~6 draws)
  {const sd=LOOK.makeSetDressing([[0,0,14],[0,26,4],[-62,-36,9],[14,12,3],[-16,22,3],[30,-24,3],[-34,-18,3]]);
   scene.add(sd.group);sd.glow.forEach(g=>staticGlow.add(...g));crateData=sd.crates||[];}
  carGlow=new LOOK.GlowLayer(16);scene.add(carGlow.mesh);
  itemRings=new LOOK.GlowLayer(64,{ring:true,y:0.04});scene.add(itemRings.mesh);
  lightPool=new LOOK.LightPool(scene,2);   // nearest 2 neon installations get the only other real lights

  // Preload textures
  const texList=['dragon','dragon_hd','panda','panda_hd','npc_shaman','npc_shaman_hd','npc_pilot','npc_scribe','npc_auctioneer','npc_fox','npc_fox_hd','npc_monk','npc_engineer','zpeg','item_shard','item_spark','item_creator','rogue_drone','fire_patch','suppress_drone','frost_breath','the_man','artcar'];
  for(const n of texList){
    const path = n.includes('.') ? assetUrl(n) : assetUrl(n+'.png');
    textures[n]=await loadTexture(path.replace(/\.png\.png$/,'.png').replace(/\.jpg\.png$/,'.jpg'));
  }
  // fix extensions for jpg
  textures.item_creator=await loadTexture(assetUrl('item_creator.png').replace('item_creator.png','item_creator.png'));
  try{textures.item_creator=await loadTexture(useLocal?LOCAL+'item_creator.png':CDN+'item_creator.png');}catch(e){}


  // Attach HD The Man billboard
  if(textures.the_man && theMan){
    const manSpr=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.the_man,transparent:true,alphaTest:0.08,depthWrite:false,color:new THREE.Color(1.35,1.35,1.35)}));manSpr.renderOrder=1; // holo highlights cross the bloom threshold
    manSpr.scale.set(18,28,1);
    manSpr.position.y=15;
    theMan.add(manSpr);
    theMan.userData.manSprite=manSpr;
  }
  // Art car sprites
  installations.forEach(obj=>{
    if(obj.userData.needsArtcar && textures.artcar){
      const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.artcar,transparent:true,alphaTest:0.1,depthWrite:false}));
      spr.scale.set(7.5,4.2,1);
      obj.add(spr);
      obj.userData.needsArtcar=false;
    }
  });

  // Title images
  document.getElementById('img-dragon').src = assetUrl('dragon_hd.png');
  document.getElementById('img-panda').src = assetUrl('panda_hd.png');

  // Player
  player=new THREE.Group();player.position.set(0,0,26);scene.add(player);
  createPlayerMesh('dragon');

  controls=new PointerLockControls(camera,document.body);
  scene.add(controls.getObject());
  controls.getObject().position.set(0,1.7,26);

  // NPCs with detailed sprites + labels
  for(let i=0;i<NPC_DATA.length;i++){
    const data=NPC_DATA[i];
    const texKey=textures[data.sprite]?data.sprite:(data.fallback||data.sprite);
    const mat=new THREE.SpriteMaterial({map:textures[texKey]||textures.npc_shaman,transparent:true,alphaTest:0.08,depthWrite:false});
    const spr=new THREE.Sprite(mat);
    spr.scale.set(2.8,4.2,1);
    const a=(i/NPC_DATA.length)*Math.PI*2+0.12,r=14+(i%5)*8+Math.random()*5;
    spr.position.set(Math.cos(a)*r,2.1,Math.sin(a)*r);
    spr.userData={...data,phase:Math.random()*Math.PI*2,isNPC:true,friendly:true};
    scene.add(spr);npcs.push(spr);
    staticGlow.add(spr.position.x,spr.position.z,2.4,neonCols[i%7],0.45);   // was PointLight(0.85,6)
  }

  // Collectibles
  const itemKeys=Object.keys(ITEM_DEFS);
  for(let i=0;i<55;i++){
    const key=itemKeys[Math.floor(Math.random()*itemKeys.length)];
    const def=ITEM_DEFS[key];
    let mesh;
    if(def.tex && textures[def.tex]){
      mesh=new THREE.Sprite(new THREE.SpriteMaterial({map:textures[def.tex],transparent:true,alphaTest:0.08,depthWrite:false,blending:THREE.AdditiveBlending}));
      mesh.scale.set(0.85,0.85,1);
    }else{
      mesh=new THREE.Mesh(new THREE.OctahedronGeometry(0.35+Math.random()*0.18,0),new THREE.MeshStandardMaterial({color:LOOK.PAL.glassDark,emissive:neonCols[i%7],emissiveIntensity:1.7,metalness:0.6,roughness:0.2,flatShading:true}));
    }
    const a=Math.random()*Math.PI*2,r=10+Math.random()*78;
    mesh.position.set(Math.cos(a)*r,0.7+Math.random()*1.2,Math.sin(a)*r);
    mesh.userData={isCollectible:true,itemKey:key,phase:Math.random()*Math.PI*2,ringColor:def.tex==='item_spark'||key==='zpeg-kit'||key==='token-chip'?LOOK.PAL.gold:neonCols[i%7]};
    scene.add(mesh);collectibles.push(mesh);
    // was a PointLight on every 2nd item → accent ring under every item (v2 §3 pickup rule), drawn by itemRings
  }

  inventory['neon-shard']=1;inventory['fiber-coil']=1;inventory['auction-badge']=1;
  quests=NPC_DATA.map(n=>({...n.quest,name:n.name,status:'active'}));

  document.addEventListener('keydown',onKeyDown);
  document.addEventListener('keyup',onKeyUp);
  document.addEventListener('mousedown',onMouseDown);
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer&&composer.resize(innerWidth,innerHeight)});
  document.getElementById('canvas-container').addEventListener('click',()=>{if(!dialogueOpen&&!panelOpen)controls.lock()});
  controls.addEventListener('lock',()=>isLocked=true);
  controls.addEventListener('unlock',()=>isLocked=false);

  staticGlow.commit();
  colliderSpecs=buildColliderSpecs();
  P=PHYS.makePlayer({x:0,y:0,z:26});
  window.__cbmPhys={get P(){return P},state:physState,input:physInput,PHYS,get ready(){return !!(P&&P.phys)},get specs(){return colliderSpecs},loadPhysics};
  composer=LOOK.makeComposer(renderer,scene,camera);
  clock=new THREE.Clock();
  document.getElementById('loading').style.display='none';
  updateUI();
  animate();
}

// Colliders for The Man's base, the Temple, NPCs, station pads and crates (plain data -> physics.js)
function buildColliderSpecs(){
  const out=[];
  out.push({type:'cyl',tag:'man-plinth',x:theMan.position.x,y:0.85,z:theMan.position.z,r:12,h:1.7});
  const temple=installations.find(o=>o.children&&o.children.length>=6&&Math.abs(o.position.x+62)<1);
  if(temple){const tx=temple.position.x,tz=temple.position.z;
    out.push({type:'box',tag:'temple-base',x:tx,y:0.45,z:tz,hx:6.5,hy:0.45,hz:6.5});
    for(let i=0;i<4;i++)out.push({type:'box',tag:'temple-pillar',x:tx+(i%2?4.5:-4.5),y:5.5,z:tz+(i<2?4.5:-4.5),hx:0.45,hy:5.5,hz:0.45});}
  installations.filter(o=>o.userData.isStation).forEach(st=>out.push({type:'cyl',tag:'station-pad',x:st.position.x,y:0.2,z:st.position.z,r:1.8,h:0.4}));
  npcs.forEach(n=>out.push({type:'cap',tag:'npc',x:n.position.x,y:1.0,z:n.position.z,r:0.55,h:2.0}));
  crateData.forEach(([x,y,z,r,sz])=>out.push({type:'box',tag:'crate',x,y,z,hx:sz/2,hy:sz/2,hz:sz/2,rotY:r}));
  return out;
}
function loadPhysics(){
  if(physLoading)return physLoading;
  physLoading=PHYS.loadRapier().then(R=>{PHYS.attachPhysics(R,P,colliderSpecs);return true})
    .catch(e=>{console.warn('Rapier unavailable, using flat-ground fallback',e);physLoading=null;return false});
  return physLoading;
}

function createPlayerMesh(type){
  if(playerMesh){player.remove(playerMesh);if(playerMesh.material.map)playerMesh.material.map.dispose();playerMesh.material.dispose()}
  selectedChar=type;
  const tex=type==='dragon'?(textures.dragon_hd||textures.dragon):(textures.panda_hd||textures.panda);
  playerMesh=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,alphaTest:0.08,depthWrite:false}));
  // Larger, more readable hero avatars
  playerMesh.scale.set(type==='dragon'?3.6:3.0,type==='dragon'?5.4:4.5,1);
  playerMesh.position.y=type==='dragon'?2.6:2.3;player.add(playerMesh);
  document.getElementById('avatar-name').textContent=type.toUpperCase();
}

function onKeyDown(e){
  switch(e.code){
    case 'KeyW':case 'ArrowUp':moveForward=true;break;
    case 'KeyS':case 'ArrowDown':moveBackward=true;break;
    case 'KeyA':case 'ArrowLeft':moveLeft=true;break;
    case 'KeyD':case 'ArrowRight':moveRight=true;break;
    case 'Space':
      e.preventDefault();
      if(isFlying)physInput.up=true;
      else if(!e.repeat)physInput.jump=true;
      break;
    case 'ShiftLeft':case 'ShiftRight':case 'KeyC':physInput.down=true;break;
    case 'KeyE':interact();break;
    case 'KeyF':toggleFlight();break;
    case 'KeyR':useSpecialAbility();break;
    case 'Digit1':createPlayerMesh('dragon');showToast('🐉 DRAGON — F to fly · R frost breath');break;
    case 'Digit2':createPlayerMesh('panda');showToast('🐼 PANDA — craft suppress drones · ride Dragon');break;
    case 'KeyI':case 'Tab':e.preventDefault();togglePanel();break;
    case 'Escape':if(dialogueOpen)closeDialogue();else if(panelOpen)togglePanel();break;
  }
}
function onKeyUp(e){
  switch(e.code){
    case 'KeyW':case 'ArrowUp':moveForward=false;break;
    case 'KeyS':case 'ArrowDown':moveBackward=false;break;
    case 'KeyA':case 'ArrowLeft':moveLeft=false;break;
    case 'KeyD':case 'ArrowRight':moveRight=false;break;
    case 'Space':physInput.up=false;break;
    case 'ShiftLeft':case 'ShiftRight':case 'KeyC':physInput.down=false;break;
  }
}
function onMouseDown(e){
  if(e.button===0 && isLocked && !dialogueOpen && !panelOpen){
    if(gamePhase==='drone'||gamePhase==='defend') attackNearest();
  }
}

function toggleFlight(){
  if(selectedChar!=='dragon' && !pandaRiding){
    showToast('Only Dragon can fly solo. Panda can ride once Dragon is flying nearby.');
    return;
  }
  if(gamePhase==='collect' && !phaseUnlocked.drone){
    showToast('Flight unlocks after you place ZPEGs / deploy apps / clear early quests.');
    checkPhaseUnlocks();
    return;
  }
  if(P.landing)return;
  if(!isFlying){
    isFlying=P.flying=true;P.vel.y=Math.max(P.vel.y,6);
    showToast('🐉 Flight engaged — Space climb · Shift/C descend · F land · R frost');
    flyHeight=Math.max(controls.getObject().position.y,4);
  }else{
    P.landing=true;   // glide down and touch down softly (was: teleport to the ground)
    showToast('Landing…');
  }
}

function useSpecialAbility(){
  if(frostCooldown>0){showToast('Ability recharging…');return}
  if(selectedChar==='dragon' || (selectedChar==='panda' && pandaRiding)){
    // Frost breath
    frostCooldown=2.2;
    spawnFrostBreath();
    // extinguish nearby fires
    const pos=player.position.clone();pos.y=1.5;
    for(let i=fires.length-1;i>=0;i--){
      if(pos.distanceTo(fires[i].position)<12){
        scene.remove(fires[i]);fires.splice(i,1);
        manIntegrity=Math.min(100,manIntegrity+4);
      }
    }
    // damage drones / enemies in cone
    damageInFront(14,35);
    showToast('❄️ Frost breath!');
  }else if(selectedChar==='panda'){
    if((inventory['suppress-kit']||0)>0 || suppressDrones.length>0){
      deploySuppressDrone();
    }else{
      showToast('Need Suppress Kit (Symbiote quest) or craft one via Ω Apps');
    }
  }
}

function spawnFrostBreath(){
  if(!textures.frost_breath)return;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.frost_breath,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.9}));
  spr.scale.set(6,3.5,1);
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  spr.position.copy(controls.getObject().position).add(dir.multiplyScalar(4));
  scene.add(spr);
  setTimeout(()=>scene.remove(spr),700);
}

function attackNearest(){
  if(attackCooldown>0)return;
  attackCooldown=0.45;
  damageInFront(8,22);
  showToast('⚡ Attack!');
}

function damageInFront(range,dmg){
  const pos=controls.getObject().position.clone();
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  for(let i=rogueDrones.length-1;i>=0;i--){
    const d=rogueDrones[i];
    const to=d.position.clone().sub(pos);const dist=to.length();
    if(dist<range && to.normalize().dot(dir)>0.45){
      d.userData.hp=(d.userData.hp||30)-dmg;
      if(d.userData.hp<=0){
        scene.remove(d);rogueDrones.splice(i,1);
        tokens+=8;showToast('Rogue drone destroyed +8 tokens');
        checkDroneWave();
      }
    }
  }
  for(let i=enemyNpcs.length-1;i>=0;i--){
    const e=enemyNpcs[i];
    const to=e.position.clone().sub(pos);const dist=to.length();
    if(dist<range+1 && to.normalize().dot(dir)>0.35){
      e.userData.hp=(e.userData.hp||40)-dmg;
      if(e.userData.hp<=0){
        scene.remove(e);enemyNpcs.splice(i,1);
        tokens+=15;showToast('Arsonist down +15 tokens');
        checkDefendWin();
      }
    }
  }
  updateUI();
}

function deploySuppressDrone(){
  if((inventory['suppress-kit']||0)>0)inventory['suppress-kit']--;
  const mat=new THREE.SpriteMaterial({map:textures.suppress_drone||null,transparent:true,alphaTest:0.1,depthWrite:false});
  if(!textures.suppress_drone)mat.color=new THREE.Color(LOOK.PAL.cyan);
  const spr=new THREE.Sprite(mat);
  spr.scale.set(1.4,1.4,1);
  spr.position.copy(player.position);spr.position.y=3;
  spr.userData={isSuppress:true,life:45};
  scene.add(spr);suppressDrones.push(spr);
  showToast('🚁 Fire suppression drone deployed');
  updateUI();
}

function interact(){
  const pos=player.position.clone();pos.y=1.5;

  // Stomp fires
  for(let i=fires.length-1;i>=0;i--){
    if(pos.distanceTo(fires[i].position)<2.8){
      scene.remove(fires[i]);fires.splice(i,1);
      manIntegrity=Math.min(100,manIntegrity+6);
      showToast('🔥 Stomped out a fire! Integrity +6');
      updateUI();return;
    }
  }

  // Collectibles
  for(let i=collectibles.length-1;i>=0;i--){
    const c=collectibles[i];
    if(pos.distanceTo(c.position)<2.5){
      const key=c.userData.itemKey;
      inventory[key]=(inventory[key]||0)+1;
      scene.remove(c);collectibles.splice(i,1);
      showToast(`Collected ${ITEM_DEFS[key].emoji} ${ITEM_DEFS[key].name}`);
      updateUI();checkPhaseUnlocks();return;
    }
  }

  if(pos.distanceTo(theMan.position)<16){
    if(gamePhase==='burn' || (gamePhase==='defend' && enemyNpcs.length===0 && fires.length===0)){
      openDialogue("The Man","The enemies are gone. The Playa is ready. Will you light the final Burn?",[
        {label:'🔥 BURN THE MAN',action:()=>startFinalBurn()}
      ]);
    }else{
      openDialogue("The Man","You stand before the cybernetic Man of Black Rock City 2077. Place Zero-Point Generators near me. Defend me when the arsonists come. Only then may the Burn begin.",[]);
    }
    return;
  }

  for(const g of generators){
    if(pos.distanceTo(g.position)<3.2){
      openDialogue("⚡ ZPEG",`This Zero-Point Energy Generator is humming. Produced ${Math.floor(g.userData.produced||0)} tokens so far.`,[
        {label:'Harvest tokens',action:()=>harvestGenerator(g)}
      ]);
      return;
    }
  }

  for(const inst of installations){
    if(inst.userData.isStation&&pos.distanceTo(inst.position)<3.8){
      openDialogue(inst.userData.stationName,"Open Ω Panel (I / Tab) for full station controls.",[
        {label:'Open Ω Panel',action:()=>{closeDialogue();togglePanel();switchTab('omega')}}
      ]);
      return;
    }
  }

  // Panda mount Dragon (if nearby and dragon flying)
  if(selectedChar==='panda' && isFlying){
    // already conceptual
  }

  let nearest=null,minD=5.8;
  for(const n of npcs){const d=pos.distanceTo(n.position);if(d<minD){minD=d;nearest=n}}
  if(nearest){
    const q=nearest.userData.quest;
    const actions=[];
    if(q&&!q.done)actions.push({label:'Turn in quest',action:()=>tryCompleteQuest(nearest)});
    actions.push({label:'Ask about tokens',action:()=>showToast(`${nearest.userData.name}: Tokens come from generators, quests, Auction, and combat.`)});
    if(gamePhase==='defend')actions.push({label:'Join defense',action:()=>{showToast(`${nearest.userData.name} will help fight arsonists!`);closeDialogue()}});
    const needStr=q&&!q.done?`\n\n[Quest] Need: ${Object.entries(q.need).map(([k,v])=>`${v}× ${ITEM_DEFS[k]?.name||k}`).join(', ')}`:'';
    openDialogue(nearest.userData.name,nearest.userData.text+needStr,actions);
    return;
  }
  showToast("Nothing nearby. Collect glowing items, talk to NPCs, or approach The Man.");
}

function tryCompleteQuest(npc){
  const q=npc.userData.quest;
  if(!q||q.done){showToast("No active quest.");return}
  for(const[k,v]of Object.entries(q.need)){if((inventory[k]||0)<v){showToast(`Missing ${ITEM_DEFS[k]?.name||k}`);return}}
  for(const[k,v]of Object.entries(q.need))inventory[k]-=v;
  tokens+=q.reward.tokens||0;
  if(q.reward.items)for(const[k,v]of Object.entries(q.reward.items))inventory[k]=(inventory[k]||0)+v;
  q.done=true;questsDone++;
  const qq=quests.find(x=>x.id===q.id);if(qq)qq.status='done';
  showToast(`✅ Quest complete! +${q.reward.tokens||0} tokens`);
  closeDialogue();updateUI();checkPhaseUnlocks();
}

function harvestGenerator(g){
  const produced=g.userData.produced||0;
  if(produced<1){showToast("Still charging…");return}
  tokens+=Math.floor(produced);
  g.userData.produced=0;
  showToast(`⚡ Harvested ${Math.floor(produced)} tokens`);
  closeDialogue();updateUI();checkPhaseUnlocks();
}

function checkPhaseUnlocks(){
  if(!phaseUnlocked.drone && (zpegsPlaced>=2 || tokens>=80 || questsDone>=3 || appsDeployed>=2)){
    phaseUnlocked.drone=true;
    setPhase('drone');
    spawnRogueDrones(6);
    showPhaseBanner('PHASE 2: ROGUE DRONES — Fly & fight! F=fly R=frost Click=attack');
  }
  if(phaseUnlocked.drone && !phaseUnlocked.defend && droneWaveCleared && (appsDeployed>=2 || zpegsPlaced>=3 || tokens>=150)){
    phaseUnlocked.defend=true;
    setPhase('defend');
    document.getElementById('man-health').style.display='block';
    document.getElementById('btn-suppress').style.display='block';
    document.getElementById('btn-wind').style.display='block';
    showPhaseBanner('PHASE 3: DEFEND THE MAN — Enemies try to burn the effigy! Extinguish fires, eliminate arsonists');
    spawnArsonists(4);
  }
  if(phaseUnlocked.defend && enemyNpcs.length===0 && fires.length===0 && manIntegrity>20){
    if(!phaseUnlocked.burn){
      phaseUnlocked.burn=true;
      setPhase('burn');
      showPhaseBanner('PHASE 4: THE BURN — Approach The Man and light the final fire when ready');
    }
  }
}

function setPhase(p){
  gamePhase=p;
  document.getElementById('phase-display').textContent=p.toUpperCase();
  document.getElementById('status').textContent='Phase: '+p;
}

function showPhaseBanner(msg){
  const b=document.getElementById('phase-banner');
  b.textContent=msg;b.style.display='block';
  setTimeout(()=>b.style.display='none',8000);
}

function spawnRogueDrones(n){
  for(let i=0;i<n;i++){
    const mat=new THREE.SpriteMaterial({map:textures.rogue_drone||null,transparent:true,alphaTest:0.1,depthWrite:false});
    if(!textures.rogue_drone)mat.color=new THREE.Color(LOOK.PAL.hostile);
    const spr=new THREE.Sprite(mat);
    spr.scale.set(1.6,1.6,1);
    const a=Math.random()*Math.PI*2,r=25+Math.random()*40;
    spr.position.set(Math.cos(a)*r,4+Math.random()*6,Math.sin(a)*r);
    spr.userData={isRogue:true,hp:30,phase:Math.random()*Math.PI*2,speed:0.015+Math.random()*0.02};
    scene.add(spr);rogueDrones.push(spr);
  }
  showToast(`${n} rogue drones inbound!`);
}

function checkDroneWave(){
  if(rogueDrones.length===0 && gamePhase==='drone'){
    droneWaveCleared=true;
    showToast('All rogue drones cleared! Deploy more apps / ZPEGs to unlock Defend phase.');
    checkPhaseUnlocks();
  }
}

function spawnArsonists(n){
  for(let i=0;i<n;i++){
    // reuse engineer/fox as hostile look
    const tex=textures.npc_engineer||textures.npc_fox;
    const mat=new THREE.SpriteMaterial({map:tex,transparent:true,alphaTest:0.12,depthWrite:false,color:0xff9a9a});   // hostile tint, softened so it reads as tint not glow
    const spr=new THREE.Sprite(mat);
    spr.scale.set(2,3,1);
    const a=Math.random()*Math.PI*2,r=40+Math.random()*30;
    spr.position.set(Math.cos(a)*r,1.5,Math.sin(a)*r);
    spr.userData={isEnemy:true,hp:45,fireTimer:3+Math.random()*4,phase:Math.random()*Math.PI*2};
    scene.add(spr);enemyNpcs.push(spr);
  }
  showToast(`${n} arsonist agents spotted near The Man!`);
}

function spawnFireNearMan(){
  if(fires.length>12)return;
  const mat=new THREE.SpriteMaterial({map:textures.fire_patch||null,transparent:true,alphaTest:0.05,depthWrite:false,blending:THREE.AdditiveBlending});
  if(!textures.fire_patch)mat.color=new THREE.Color(LOOK.PAL.fireMid);
  const spr=new THREE.Sprite(mat);
  spr.scale.set(2.2,2.2,1);
  const a=Math.random()*Math.PI*2,r=4+Math.random()*10;
  spr.position.set(Math.cos(a)*r,0.4,Math.sin(a)*r);
  spr.userData={isFire:true,phase:Math.random()*Math.PI*2};
  scene.add(spr);fires.push(spr);
  manIntegrity=Math.max(0,manIntegrity-3);
  if(manIntegrity<=0){
    showToast('⚠️ THE MAN IS BURNING UNCONTROLLED! Extinguish fires NOW!');
  }
}

function checkDefendWin(){
  if(enemyNpcs.length===0 && fires.length===0 && gamePhase==='defend'){
    checkPhaseUnlocks();
  }
}

function startFinalBurn(){
  closeDialogue();
  setPhase('complete');
  // Visual burn: add many fire sprites + bright lights
  for(let i=0;i<20;i++){
    setTimeout(()=>{
      const mat=new THREE.SpriteMaterial({map:textures.fire_patch||null,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
      if(!textures.fire_patch)mat.color=new THREE.Color(LOOK.PAL.fire);
      const spr=new THREE.Sprite(mat);
      spr.scale.set(3+Math.random()*4,3+Math.random()*4,1);
      spr.position.set((Math.random()-0.5)*8,2+Math.random()*18,(Math.random()-0.5)*6);
      theMan.add(spr);
    },i*120);
  }
  const blaze=new THREE.PointLight(LOOK.PAL.fire,400,100,2);   // burn phase: 1 pooled fire light
  blaze.position.y=12;theMan.add(blaze);
  tokens+=500;
  showPhaseBanner('🔥 THE BURN — Radical self-expression. The Man burns. +500 tokens. Festival complete.');
  showToast('🔥 You lit The Man. The Playa celebrates. Thank you for playing Cyberpunk Burning Man Ω.');
  updateUI();
}

function openDialogue(name,text,actions=[]){
  dialogueOpen=true;
  document.getElementById('dlg-name').textContent=name;
  document.getElementById('dlg-text').textContent=text;
  const act=document.getElementById('dlg-actions');
  act.innerHTML='';
  actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;b.onclick=a.action;act.appendChild(b)});
  document.getElementById('dialogue').style.display='block';
  controls.unlock();
}
window.closeDialogue=function(){dialogueOpen=false;document.getElementById('dialogue').style.display='none'};

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.display='block';
  setTimeout(()=>t.style.display='none',3000);
}

window.togglePanel=function(){
  panelOpen=!panelOpen;
  document.getElementById('panel').style.display=panelOpen?'block':'none';
  if(panelOpen){controls.unlock();updateUI()}
};
window.switchTab=function(tab){
  ['inv','quests','omega','auction'].forEach(t=>{
    document.getElementById('tab-'+t).style.display=t===tab?'block':'none';
    document.querySelector(`.tab[data-tab="${t}"]`)?.classList.toggle('active',t===tab);
  });
  updateUI();
};

function updateUI(){
  document.getElementById('tokens').textContent=tokens.toLocaleString();
  document.getElementById('man-fill').style.width=manIntegrity+'%';
  const inv=document.getElementById('inv-list');
  inv.innerHTML=Object.keys(inventory).filter(k=>inventory[k]>0).map(k=>{
    const d=ITEM_DEFS[k]||{name:k,emoji:'❓'};
    return `<div class="item"><span>${d.emoji} ${d.name}</span><span class="qty">×${inventory[k]}</span></div>`;
  }).join('')||'<div style="color:#668">Empty — explore the Playa</div>';
  const ql=document.getElementById('quest-list');
  ql.innerHTML=quests.map(q=>{
    const need=Object.entries(q.need||{}).map(([k,v])=>`${v} ${ITEM_DEFS[k]?.name||k}`).join(', ');
    return `<div class="q ${q.status==='done'?'done':''}"><b>${q.name}</b><br>Need: ${need}<br>Reward: ${q.reward?.tokens||0} tokens</div>`;
  }).join('');
  const al=document.getElementById('auction-list');
  al.innerHTML=auctionListings.map((a,i)=>{
    const d=ITEM_DEFS[a.item]||{name:a.item,emoji:'❓'};
    return `<div class="item"><span>${d.emoji} ${d.name}</span><span>${a.price}🪙 <button onclick="buyAuction(${i})" style="margin-left:4px;padding:2px 6px;font-size:.7rem;cursor:pointer">Buy</button></span></div>`;
  }).join('')||'<div style="color:#668">No listings</div>';
}

window.buyAuction=function(i){
  const a=auctionListings[i];
  if(!a)return;
  if(tokens<a.price){showToast("Not enough tokens");return}
  tokens-=a.price;
  inventory[a.item]=(inventory[a.item]||0)+1;
  auctionListings.splice(i,1);
  showToast(`Bought ${ITEM_DEFS[a.item]?.name} for ${a.price} tokens`);
  updateUI();
};
window.listRandomAuction=function(){
  const owned=Object.keys(inventory).filter(k=>inventory[k]>0&&k!=='token-chip');
  if(!owned.length){showToast("No items to list");return}
  const key=owned[Math.floor(Math.random()*owned.length)];
  inventory[key]--;
  const price=20+Math.floor(Math.random()*80);
  auctionListings.push({item:key,price,seller:'You'});
  showToast(`Listed ${ITEM_DEFS[key]?.name} for ${price} tokens`);
  updateUI();
};

window.useStation=function(type){
  if(type==='zpeg'){
    if((inventory['zpeg-kit']||0)<1||(inventory['quantum-spark']||0)<1){showToast("Need ZPEG Kit + Quantum Spark");return}
    inventory['zpeg-kit']--;inventory['quantum-spark']--;
    let g;
    if(textures.zpeg){
      g=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.zpeg,transparent:true,alphaTest:0.1,depthWrite:false}));
      g.scale.set(2.4,2.4,1);
    }else{
      g=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.4,2.2,8),new THREE.MeshStandardMaterial({color:0x3f3726,emissive:LOOK.PAL.gold,emissiveIntensity:1.6,metalness:0.8,roughness:0.35}));
    }
    g.position.set(player.position.x+2.5,1.2,player.position.z);
    g.userData={isGenerator:true,produced:0,rate:0.22};
    scene.add(g);generators.push(g);installations.push(g);zpegsPlaced++;
    staticGlow.add(g.position.x,g.position.z,4,LOOK.PAL.gold,0.55);staticGlow.commit();   // was PointLight(4,18)
    showToast("⚡ Zero-Point Generator placed!");
    updateUI();checkPhaseUnlocks();
  }else if(type==='x402'){
    if(tokens<10){showToast("Need 10 tokens");return}
    tokens-=10;
    const earned=15+Math.floor(Math.random()*25);
    tokens+=earned;appsDeployed++;
    showToast(`💰 x402 microtx → +${earned} tokens`);
    updateUI();checkPhaseUnlocks();
  }else if(type==='escrow'){
    if((inventory['escrow-key']||0)<1){showToast("Need Escrow Key");return}
    inventory['escrow-key']--;tokens+=45;inventory['token-chip']=(inventory['token-chip']||0)+1;appsDeployed++;
    showToast("📜 FairForge escrow sealed. +45 tokens");updateUI();checkPhaseUnlocks();
  }else if(type==='vonnect'){
    if((inventory['vonnect-log']||0)<1){showToast("Need Vonnect Log");return}
    inventory['vonnect-log']--;tokens+=20;appsDeployed++;
    showToast("📡 Omega Vonnect synced. +20 tokens");updateUI();checkPhaseUnlocks();
  }else if(type==='auction'){switchTab('auction')}
  else if(type==='creator'){
    if((inventory['creator-seed']||0)<1){showToast("Need Creator Seed");return}
    inventory['creator-seed']--;tokens+=55;inventory['circuit-board']=(inventory['circuit-board']||0)+1;appsDeployed++;
    showToast("🧬 Creator of All node spawned. +55 tokens");updateUI();checkPhaseUnlocks();
  }else if(type==='suppress'){
    if((inventory['suppress-kit']||0)<1 && suppressDrones.length===0){
      // allow craft if have materials
      if((inventory['circuit-board']||0)>=1 && (inventory['fiber-coil']||0)>=1){
        inventory['circuit-board']--;inventory['fiber-coil']--;
        inventory['suppress-kit']=(inventory['suppress-kit']||0)+1;
        showToast('Crafted Suppress Kit');
      }else{showToast('Need Suppress Kit or Circuit+Fiber to craft');return}
    }
    deploySuppressDrone();
  }else if(type==='wind'){
    // wind generator clears nearby fires once
    const pos=player.position;
    let cleared=0;
    for(let i=fires.length-1;i>=0;i--){
      if(pos.distanceTo(fires[i].position)<18){
        scene.remove(fires[i]);fires.splice(i,1);cleared++;manIntegrity=Math.min(100,manIntegrity+3);
      }
    }
    showToast(cleared?`💨 Wind generator cleared ${cleared} fires`:'No fires in range');
    updateUI();
  }
};

let arsonSpawnTimer=0,fireTick=0;

function animate(){
  requestAnimationFrame(animate);
  // B3: no more slow motion: clamp only huge hitches; the player runs on a fixed 60 Hz step
  const delta=Math.min(clock.getDelta(),PHYS.MAX_FRAME),time=clock.getElapsedTime();
  if(frostCooldown>0)frostCooldown-=delta;
  if(attackCooldown>0)attackCooldown-=delta;

  const cam=controls.getObject();
  if(isLocked&&!dialogueOpen&&!panelOpen){
    _eul.setFromQuaternion(camera.quaternion);
    physInput.f=moveForward;physInput.b=moveBackward;physInput.l=moveLeft;physInput.r=moveRight;physInput.yaw=_eul.y;
    const {alpha}=PHYS.advance(physState,P,physInput,delta);
    const ip=PHYS.lerp3(P.prev,P.pos,alpha);   // render interpolation
    cam.position.set(ip.x,ip.y+PHYS.EYE,ip.z);
  }else if(P){P.vel.x=P.vel.z=0;physInput.jump=false;physState.acc=0}   // B13: no stale velocity on resume
  if(P){
    if(isFlying&&!P.flying){showToast('Landed');}
    isFlying=P.flying;canJump=P.grounded;velocity.set(P.vel.x,P.vel.y,P.vel.z);
  }
  // B5/B6: the hero sprite never pops into the camera. On foot it's first person (hidden, also when menus
  // unlock the pointer); in flight it rides ahead of and below the view.
  player.position.set(cam.position.x,0,cam.position.z);
  if(playerMesh){
    playerMesh.visible=isFlying;
    if(isFlying){camera.getWorldDirection(_fwd);_fwd.y=0;_fwd.normalize();
      player.position.set(cam.position.x+_fwd.x*4.5,cam.position.y-1.5-playerMesh.position.y+0.4,cam.position.z+_fwd.z*4.5);}
  }

  installations.forEach(obj=>{
    if(obj.userData.float){obj.position.y=obj.userData.baseY+Math.sin(time*1.2+obj.userData.phase)*0.7;obj.rotation.y+=0.008}
    if(obj.userData.isCar){obj.userData.angle+=obj.userData.speed*delta;obj.position.x=Math.cos(obj.userData.angle)*obj.userData.radius;obj.position.z=Math.sin(obj.userData.angle)*obj.userData.radius;obj.rotation.y=obj.userData.angle+Math.PI/2}
  });
  npcs.forEach(n=>{n.position.y=2.05+Math.sin(time*1.9+n.userData.phase)*0.12});
  collectibles.forEach(c=>{
    c.position.y=0.75+Math.sin(time*2.4+c.userData.phase)*0.28;
    if(c.rotation){c.rotation.y+=0.025}
  });
  generators.forEach(g=>{g.userData.produced=(g.userData.produced||0)+g.userData.rate*delta;if(g.rotation)g.rotation.y+=0.015});
  // look-dev per-frame: item rings, car underglow, pooled lights
  {let n=0;for(const c of collectibles){if(n>=64)break;itemRings.set(n++,c.position.x,c.position.z,0.55,c.userData.ringColor,1.4)}itemRings.commit(n);}
  {let n=0;const cand=lightCandidates.slice();installations.forEach(o=>{if(o.userData.isCar){carGlow.set(n++,o.position.x,o.position.z,5,o.userData.glowColor,0.5);cand.push({pos:o.position,color:o.userData.glowColor})}});carGlow.commit(n);
   lightPool.update(delta,camera,cand);}

  // Rogue drones orbit / chase
  rogueDrones.forEach(d=>{
    d.position.y=4+Math.sin(time*2+d.userData.phase)*1.5;
    const toPlayer=player.position.clone().sub(d.position);
    if(toPlayer.length()>3){
      toPlayer.normalize().multiplyScalar(d.userData.speed*60*delta);
      d.position.x+=toPlayer.x;d.position.z+=toPlayer.z;
    }
  });

  // Suppress drones seek fires
  for(let i=suppressDrones.length-1;i>=0;i--){
    const s=suppressDrones[i];
    s.userData.life-=delta;
    if(s.userData.life<=0){scene.remove(s);suppressDrones.splice(i,1);continue}
    s.position.y=2.5+Math.sin(time*3)*0.4;
    if(fires.length){
      const f=fires[0];
      const dir=f.position.clone().sub(s.position);dir.y=0;
      if(dir.length()<2.5){
        scene.remove(f);fires.shift();
        manIntegrity=Math.min(100,manIntegrity+5);
        showToast('🚁 Drone extinguished a fire');
      }else{
        dir.normalize().multiplyScalar(8*delta);
        s.position.x+=dir.x;s.position.z+=dir.z;
      }
    }
  }

  // Enemies path to Man and light fires
  if(gamePhase==='defend'||gamePhase==='burn'){
    arsonSpawnTimer+=delta;
    // gradual increase
    const spawnInterval=Math.max(8,22-time*0.02);
    if(arsonSpawnTimer>spawnInterval && enemyNpcs.length<10){
      arsonSpawnTimer=0;
      spawnArsonists(1);
    }
    enemyNpcs.forEach(e=>{
      e.position.y=1.5+Math.sin(time*2+e.userData.phase)*0.08;
      const toMan=theMan.position.clone().sub(e.position);toMan.y=0;
      if(toMan.length()>8){
        toMan.normalize().multiplyScalar(4*delta);
        e.position.x+=toMan.x;e.position.z+=toMan.z;
      }else{
        e.userData.fireTimer-=delta;
        if(e.userData.fireTimer<=0){
          e.userData.fireTimer=5+Math.random()*4;
          spawnFireNearMan();
        }
      }
    });
    fireTick+=delta;
    if(fireTick>2.5){
      fireTick=0;
      if(fires.length)manIntegrity=Math.max(0,manIntegrity-fires.length*0.8);
      document.getElementById('man-fill').style.width=manIntegrity+'%';
    }
  }

  fires.forEach(f=>{f.position.y=0.5+Math.sin(time*5+f.userData.phase)*0.15;if(f.scale){const s=2+Math.sin(time*4)*0.2;f.scale.set(s,s,1)}});

  skyGroup.userData.update(time,camera);dustGroup.userData.update(time,camera);manGlow.userData.update(time);composer.update(time);
  if(theMan)theMan.children.forEach((c,i)=>{if(c.geometry?.type==='TorusGeometry'&&!c.userData.static)c.rotation.z=time*(0.15+i*0.05)});

  if(generators.length)document.getElementById('status').textContent=`ZPEGs:${generators.length} | Phase:${gamePhase}`;
  composer.render(delta);
}

document.querySelectorAll('.char-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedChar=card.dataset.char;
    document.getElementById('start-btn').disabled=false;
  });
});
document.getElementById('start-btn').addEventListener('click',()=>{
  if(!selectedChar)return;
  document.getElementById('title-screen').style.opacity='0';
  setTimeout(()=>{
    document.getElementById('title-screen').style.display='none';
    document.getElementById('ui').style.display='flex';
    createPlayerMesh(selectedChar);
    loadPhysics();   // lazy: Rapier wasm is fetched only after the title screen
    showToast(`Welcome as ${selectedChar.toUpperCase()}! Collect items, build ZPEGs, unlock flight & defend The Man.`);
  },750);
});

init().catch(e=>{console.error(e);document.getElementById('loading').innerHTML='<div style="color:#f66">Failed to load. Check console.</div>'});
