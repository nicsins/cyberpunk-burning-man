
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as LOOK from './lookdev.js';

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
const AMMO_MAX=12,AMMO_REGEN_SEC=8;
let ammo=AMMO_MAX,ammoRegenTimer=0;
let hasGun=false,gunPickup=null;
let rideDrone=null,droneBoarded=false,droneEverBoarded=false;
const AUTO_PICKUP_RANGE=2.0,PICKUP_PULSE_RANGE=4,AUTO_PICKUP_MAX_ALT=4;
let gameStarted=false;
const lastPickupPos=new THREE.Vector3(NaN,0,NaN);
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
  'suppress-kit':{name:'Suppress Kit',emoji:'🚁'},
  'bomb':{name:'Bomb',emoji:'💣'},
  'extinguisher':{name:'Fire Extinguisher',emoji:'🧯'},
  'scanner':{name:'Scanner',emoji:'📡'},
  'ff-drone':{name:'Firefighter Drone',emoji:'🚒'}
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
   scene.add(sd.group);sd.glow.forEach(g=>staticGlow.add(...g));}
  carGlow=new LOOK.GlowLayer(16);scene.add(carGlow.mesh);
  itemRings=new LOOK.GlowLayer(64,{ring:true,y:0.04});scene.add(itemRings.mesh);
  lightPool=new LOOK.LightPool(scene,2);   // nearest 2 neon installations get the only other real lights

  // Preload textures
  const texList=['dragon','dragon_hd','panda','panda_hd','npc_shaman','npc_shaman_hd','npc_pilot','npc_scribe','npc_auctioneer','npc_fox','npc_fox_hd','npc_monk','npc_engineer','zpeg','item_shard','item_spark','item_creator','rogue_drone','fire_patch','suppress_drone','frost_breath','the_man','artcar'];
  for(const n of texList){
    const path = n.includes('.') ? assetUrl(n) : assetUrl(n+'.png');
    textures[n]=await loadTexture(path.replace(/\.png\.png$/,'.png').replace(/\.jpg\.png$/,'.jpg'));
  }
  // Animated sprite sheets ship as data URIs in assets/sprite_sheets.js (missing -> tilt/squash fallback)
  try{const {SPRITE_SHEETS}=await import('./assets/sprite_sheets.js');
    for(const [k,uri] of Object.entries(SPRITE_SHEETS))textures[k]=await loadTexture(uri);}catch(e){console.warn('sprite sheets unavailable',e)}
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
  // Plasma Rifle pickup a few steps from spawn (walk over it or press E)
  {
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.22,0.22),new THREE.MeshStandardMaterial({color:0x222233,emissive:0xff5500,emissiveIntensity:1.6,metalness:0.7,roughness:0.3}));
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.7,8),new THREE.MeshBasicMaterial({color:0xffaa00}));
    barrel.rotation.z=Math.PI/2;barrel.position.x=0.95;g.add(body,barrel);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,8,16,1,true),new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.15,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    beam.position.y=3.3;g.add(beam);
    g.position.set(3,1,21);scene.add(g);gunPickup=g;
  }
  // Pilotable hover-drone on a pad near spawn (E / mouse-forward to board; any character)
  {
    const g=new THREE.Group();
    const hull=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.3,0.4,6),new THREE.MeshStandardMaterial({color:0x1a1a2a,emissive:0x00ffcc,emissiveIntensity:0.9,metalness:0.8,roughness:0.3}));
    g.add(hull);
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;const r=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.06,6,16),new THREE.MeshBasicMaterial({color:0x00ffcc}));r.rotation.x=Math.PI/2;r.position.set(Math.cos(a)*1.4,0.15,Math.sin(a)*1.4);g.add(r)}
    const pad=new THREE.Mesh(new THREE.RingGeometry(1.8,2.2,32),new THREE.MeshBasicMaterial({color:0x00ffcc,side:THREE.DoubleSide,transparent:true,opacity:0.6}));
    pad.rotation.x=-Math.PI/2;pad.position.set(-5,0.05,21);scene.add(pad);
    g.position.set(-5,0.9,21);g.userData.home=g.position.clone();scene.add(g);rideDrone=g;padDrone=g;
  }
  spawnWorldPickups();renderForgeUI();
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
  document.addEventListener('contextmenu',e=>{if(gameStarted)e.preventDefault()});
  // Wheel = forward/back impulse; middle-drag = strafe
  document.addEventListener('wheel',onWheel,{passive:false});
  document.addEventListener('mouseup',onMouseUp);
  document.addEventListener('auxclick',e=>{if(e.button>=1)e.preventDefault()});
  document.addEventListener('mousemove',onMouseMoveStrafe);
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer&&composer.resize(innerWidth,innerHeight)});
  document.getElementById('canvas-container').addEventListener('click',()=>{if(!dialogueOpen&&!panelOpen)controls.lock()});
  controls.addEventListener('lock',()=>isLocked=true);
  controls.addEventListener('unlock',()=>isLocked=false);

  staticGlow.commit();
  composer=LOOK.makeComposer(renderer,scene,camera);
  clock=new THREE.Clock();
  document.getElementById('loading').style.display='none';
  updateUI();
  animate();
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
      if(isFlying){flyUp=true;e.preventDefault()}
      else if(canJump){velocity.y+=7.8;canJump=false}
      break;
    case 'KeyC':case 'ControlLeft':case 'ControlRight':case 'KeyQ':if(isFlying){flyDown=true;e.preventDefault()}break;
    case 'KeyK':if(tut&&document.getElementById('tut-skip').style.display!=='none')endTutorial(true);break;
    case 'KeyT':if(gameStarted)toggleTargeting();break;
    case 'KeyY':if(gameStarted)toggleAutoFire();break;
    case 'KeyV':if(targeting&&!fireRocket())showToast('No lock yet — hold the target in the reticle');break;
    case 'KeyB':if(gameStarted)smokeScreen();break;
    case 'KeyZ':if(gameStarted)chainSweep();break;
    case 'KeyJ':if(quad){quadGuard=!quadGuard;showToast(quadGuard?'🐕 Quad Drone guarding The Man':'🐕 Quad Drone following you')}else hint('noquad','🐕 Forge a Quad Minigun Drone in Ω Panel (I) → Forge');break;
    case 'KeyE':interact();break;
    case 'KeyF':toggleFlight();break;
    case 'KeyR':useSpecialAbility();break;
    case 'KeyH':if(gameStarted)toggleRideFF();break;
    case 'KeyG':if(gameStarted)throwBomb();break;
    case 'KeyX':if(gameStarted)sprayFoam();break;
    case 'KeyM':showToast(SFX.toggleMute()?'🔇 Sound muted (M)':'🔊 Sound on (M)');break;
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
    case 'Space':flyUp=false;break;
    case 'KeyC':case 'ControlLeft':case 'ControlRight':case 'KeyQ':flyDown=false;break;
  }
}
// Vertical axis while flying: Space up, C/Ctrl/Q down. Clamped to ALT_MIN..ALT_MAX.
const ALT_MIN=2,ALT_MAX=40,HULL_MAX=100;let flyUp=false,flyDown=false,droneHull=HULL_MAX;
function updateHullHud(){const el=ensureHudBox('hull','HULL','#66ffcc');el.textContent=droneBoarded?Math.max(0,Math.round(droneHull))+'%':'—'}
function damageHull(n){if(!droneBoarded||smokeT>0)return;if(selectedChar==='panda')n*=0.6;droneHull-=n;shake(0.15);updateHullHud();if(droneHull<=0){droneHull=HULL_MAX;exitDrone(true);showPhaseBanner('💥 SHOT DOWN — drone crashed. You\'re on foot now: E on the drone to re-board (hull repaired)');SFX.boom()}}
let middleHeld=false,savedPointerSpeed=1;
function mouseMoveAllowed(){return gameStarted&&!dialogueOpen&&!panelOpen}
function onWheel(e){
  if(!mouseMoveAllowed()||e.target.closest?.('#panel,#dialogue'))return;
  e.preventDefault();
  // deltaY<0 = wheel up = forward. Clamp so trackpads/fast wheels stay smooth.
  const step=Math.max(-1,Math.min(1,-e.deltaY/100));
  velocity.z-=step*(isFlying?9:6);
  velocity.z=Math.max(-30,Math.min(30,velocity.z));
}
function onMouseMoveStrafe(e){
  if(!middleHeld||!mouseMoveAllowed())return;
  velocity.x-=(e.movementX||0)*0.15;
  velocity.x=Math.max(-30,Math.min(30,velocity.x));
}
function onMouseUp(e){
  if(e.button===1&&middleHeld){middleHeld=false;if(controls)controls.pointerSpeed=savedPointerSpeed}
  if(e.button===3||e.button===4)e.preventDefault();
}
function onMouseDown(e){
  if(e.button===2&&gameStarted){sprayFoam();return}
  if(e.button===1&&gameStarted){
    e.preventDefault(); // no autoscroll
    middleHeld=true;
    if(controls){savedPointerSpeed=controls.pointerSpeed??1;controls.pointerSpeed=0} // freeze look while strafing
    return;
  }
  // Side buttons: back (3) = inventory panel, forward (4) = talk/interact. preventDefault blocks browser nav.
  if(e.button===3||e.button===4){
    e.preventDefault();
    if(!gameStarted)return;
    if(e.button===3){
      if(dialogueOpen)return;
      if(!panelOpen){controls?.unlock?.();togglePanel();switchTab('inv')}else togglePanel();
    }else{
      if(dialogueOpen)closeDialogue();else if(!panelOpen)interact();
    }
    return;
  }
  if(e.button===0 && isLocked && !dialogueOpen && !panelOpen){
    if(targeting&&lockP>=1&&fireRocket())return;
    if(hasGun||gamePhase==='drone'||gamePhase==='defend') attackNearest();
  }
}

function toggleFlight(){
  if(droneBoarded){exitDrone();return}
  if(selectedChar!=='dragon' && !pandaRiding){
    showToast('Only Dragon can fly solo. Panda: board the drone on the cyan pad near spawn (E).');
    return;
  }
  if(gamePhase==='collect' && !phaseUnlocked.drone){
    showToast('Dragon flight unlocks in Phase 2 (place 2 ZPEGs, 80 tokens, 3 quests or 2 apps). Fly now: board the drone on the cyan pad near spawn (E).');
    checkPhaseUnlocks();
    return;
  }
  isFlying=!isFlying;
  if(isFlying){
    showToast('🐉 Flight engaged — Space up · C/Ctrl/Q down · WASD strafe · R frost');
    flyHeight=Math.max(controls.getObject().position.y,4);
  }else{
    showToast('Landed');
    controls.getObject().position.y=1.7;
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
  if(!hasGun){showToast('🔫 No weapon — grab the Plasma Rifle (orange beam) near spawn');return}
  if(ammo<=0){hint('lowammo','📦 Out of ammo — orange ammo crates on the minimap',15);showToast(`Out of ammo — +1 round every ${AMMO_REGEN_SEC}s`);return}
  attackCooldown=0.45;
  ammo--;ammoRegenTimer=0;updateAmmoHud();SFX.shot();
  if(ammo<=3)hint('lowammo',`📦 Low ammo (${ammo}) — grab orange ammo crates (minimap) or wait for regen`,30);
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
      d.userData.hp=(d.userData.hp||30)-dmg;onHit(d,dmg,pos);
      if(d.userData.hp<=0){
        killSprite(d,'explode');rogueDrones.splice(i,1);
        tokens+=8;showToast('Rogue drone destroyed +8 tokens');
        checkDroneWave();
      }
    }
  }
  for(let i=enemyNpcs.length-1;i>=0;i--){
    const e=enemyNpcs[i];
    const to=e.position.clone().sub(pos);const dist=to.length();
    if(dist<range+1 && to.normalize().dot(dir)>0.35){
      e.userData.hp=(e.userData.hp||40)-dmg;onHit(e,dmg,pos);
      if(e.userData.hp<=0){
        killSprite(e,'death');enemyNpcs.splice(i,1);
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

function boardDrone(){
  droneBoarded=true;droneEverBoarded=true;isFlying=true;
  flyHeight=Math.max(controls.getObject().position.y,4);
  updateHullHud();if(!localStorage.getItem('cbm_drone_tut')&&!tut)startTutorial();showToast('🛸 Drone boarded — Space up · C/Ctrl/Q down · WASD/wheel move · F or E to land');
}
function exitDrone(crash){
  droneBoarded=false;flyUp=flyDown=false;setTimeout(updateHullHud,0);isFlying=false;controls.getObject().position.y=1.7;
  if(rideDrone)rideDrone.position.set(player.position.x+2,0.9,player.position.z);
  if(rideDrone===ffDrone)rideDrone=padDrone;
  if(!crash)showToast('Landed — drone parked next to you. E to board again.');
}
function interact(){
  if(droneBoarded){exitDrone();return}
  if(rideDrone&&flatDist(player.position,rideDrone.position)<3.5){boardDrone();return}
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

  if(gunPickup&&!hasGun&&flatDist(pos,gunPickup.position)<3){takeGun();return}

  // Collectibles (keypress fallback for items just outside auto-pickup range)
  for(let i=collectibles.length-1;i>=0;i--){
    if(flatDist(pos,collectibles[i].position)<3){collect(i);return}
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

function collect(i){
  const c=collectibles[i];if(!c)return;SFX.chime();
  const key=c.userData.itemKey;
  inventory[key]=(inventory[key]||0)+1;
  scene.remove(c);collectibles.splice(i,1);
  showToast(`Collected ${ITEM_DEFS[key].emoji} ${ITEM_DEFS[key].name}`);
  updateUI();checkPhaseUnlocks();
}

// Ground-plane distance so hover bob / flight height don't block pickup.
function flatDist(a,b){const dx=a.x-b.x,dz=a.z-b.z;return Math.sqrt(dx*dx+dz*dz)}

// Distance on the ground plane from point p to segment a→b (catches fast moves that skip over an item).
function segDistXZ(p,a,b){
  const abx=b.x-a.x,abz=b.z-a.z,l2=abx*abx+abz*abz;
  if(!(l2>1e-6))return flatDist(p,b);
  let t=((p.x-a.x)*abx+(p.z-a.z)*abz)/l2;t=Math.max(0,Math.min(1,t));
  const dx=p.x-(a.x+abx*t),dz=p.z-(a.z+abz*t);return Math.sqrt(dx*dx+dz*dz);
}

function autoPickup(time){
  if(!player)return;
  // Low flight still picks up; only skip when high in the air.
  const canGrab=!isFlying||player.position.y<AUTO_PICKUP_MAX_ALT;
  const from=Number.isNaN(lastPickupPos.x)?player.position:lastPickupPos;
  for(let i=collectibles.length-1;i>=0;i--){
    const c=collectibles[i];
    const d=flatDist(player.position,c.position);
    if(!c.userData.baseScale)c.userData.baseScale=c.scale.clone();
    if(canGrab&&(d<AUTO_PICKUP_RANGE||segDistXZ(c.position,from,player.position)<AUTO_PICKUP_RANGE)){collect(i);continue}
    // subtle pulse on items close enough to grab
    const k=d<PICKUP_PULSE_RANGE?1+Math.sin(time*8+c.userData.phase)*0.12:1;
    c.scale.copy(c.userData.baseScale).multiplyScalar(k);
  }
  if(gunPickup&&!hasGun&&flatDist(player.position,gunPickup.position)<AUTO_PICKUP_RANGE)takeGun();
  if(gunPickup&&!hasGun)gunPickup.rotation.y=time*1.5;
  tickWorldPickups(time);
  lastPickupPos.copy(player.position);
}
function takeGun(){SFX.chime();
  hasGun=true;ammo=AMMO_MAX;updateAmmoHud();
  if(gunPickup){scene.remove(gunPickup);gunPickup=null}
  showToast(`🔫 Plasma Rifle! Left-click to fire (${AMMO_MAX} rounds, +1 every ${AMMO_REGEN_SEC}s)`);
}
window.__cbm={get collectibles(){return collectibles},get inventory(){return inventory},get player(){return player},get controls(){return controls},get hasGun(){return hasGun},get droneBoarded(){return droneBoarded},get isFlying(){return isFlying},get rideDrone(){return rideDrone},interact,startDroneMode,get droneMode(){return droneMode},get rogueDrones(){return rogueDrones},toggleRideFF,get ffDrone(){return ffDrone},throwBomb,sprayFoam,forge,get ammoPickups(){return ammoPickups},get bombPickups(){return bombPickups},get fires(){return fires},get tokens(){return tokens},set tokens(v){tokens=v},spawnFireNearMan:()=>spawnFireNearMan(),get hasScanner(){return hasScanner},get extCharges(){return extCharges},resolveCollisions,get theMan(){return theMan},get ammo(){return ammo},autoPickup,get enemyNpcs(){return enemyNpcs},spawnArsonists:n=>spawnArsonists(n),spawnRogueDrones:n=>spawnRogueDrones(n),setPhase:p=>setPhase(p),damageInFront:(r,d)=>damageInFront(r,d),get dying(){return dyingSprites},get hitstop(){return hitstop},get shakeAmt(){return shakeAmt},explodeAt:p=>explodeAt(p),get SFX(){return SFX},get dmScore(){return dmScore},get dmCombo(){return dmCombo},get dmBest(){return dmBest},checkDroneWave:()=>checkDroneWave(),spawnBossDrone:()=>spawnBossDrone(),set droneModeWave(v){droneModeWave=v}};

function tryCompleteQuest(npc){
  const q=npc.userData.quest;
  if(!q||q.done){showToast("No active quest.");return}
  for(const[k,v]of Object.entries(q.need)){if((inventory[k]||0)<v){showToast(`Missing ${ITEM_DEFS[k]?.name||k}`);return}}
  for(const[k,v]of Object.entries(q.need))inventory[k]-=v;
  tokens+=q.reward.tokens||0;
  if(q.reward.items)for(const[k,v]of Object.entries(q.reward.items))inventory[k]=(inventory[k]||0)+v;
  if(q.reward.items?.['weapon-shard']&&!hasGun)takeGun();
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
    showMissionBriefing('Defend The Man. Clear the drones. Then light it.');
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

// Current phase goal: x402 Broker (collect), nearest rogue drone (drone), The Man (defend/burn).
function currentObjective(){
  if(!hasGun&&gunPickup)return {pos:gunPickup.position,label:'Plasma Rifle'};
  if(!droneEverBoarded&&rideDrone&&!droneBoarded)return {pos:rideDrone.position,label:'Ride drone (E)'};
  if(gamePhase==='collect'){const b=npcs.find(n=>n.userData.name==='x402 Broker');return b?{pos:b.position,label:'x402 Broker'}:null}
  if(gamePhase==='drone'){
    let best=null,bd=Infinity;
    for(const d of rogueDrones){const k=flatDist(player.position,d.position);if(k<bd){bd=k;best=d}}
    return best?{pos:best.position,label:'Rogue drone'}:{pos:theMan.position,label:'The Man'};
  }
  if(gamePhase==='defend'||gamePhase==='burn')return {pos:theMan.position,label:'The Man'};
  return null;
}
let objEl=null;
const _objV=new THREE.Vector3();
function updateObjectiveMarker(){
  if(!objEl){
    objEl=document.createElement('div');objEl.id='objective-marker';
    objEl.style.cssText='position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:20;pointer-events:none;text-align:center;font-family:inherit;color:#0ff;text-shadow:0 0 8px #0ff';
    objEl.innerHTML='<div id="obj-arrow" style="font-size:1.8rem;line-height:1;transition:transform .08s linear">▲</div><div id="obj-label" style="font-size:.7rem;letter-spacing:.06em"></div>';
    document.body.appendChild(objEl);
  }
  const o=currentObjective();
  const ui=document.getElementById('ui');
  if(!o||!ui||ui.style.display==='none'){objEl.style.display='none';return}
  objEl.style.display='block';
  // target in camera space: x right, -z forward
  _objV.copy(o.pos);_objV.y=camera.position.y;_objV.applyMatrix4(camera.matrixWorldInverse);
  const ang=Math.atan2(_objV.x,-_objV.z);
  document.getElementById('obj-arrow').style.transform=`rotate(${ang}rad)`;
  document.getElementById('obj-label').textContent=`${o.label} · ${Math.round(flatDist(controls.getObject().position,o.pos))}m`;
}

function showMissionBriefing(msg){
  let el=document.getElementById('mission-briefing');
  if(!el){
    el=document.createElement('div');el.id='mission-briefing';
    el.style.cssText='position:fixed;top:38%;left:50%;transform:translate(-50%,-50%);z-index:30;pointer-events:none;padding:14px 26px;border:1px solid #f0f8;border-radius:12px;background:rgba(20,0,30,.82);color:#fff;font-size:1.25rem;letter-spacing:.05em;text-align:center;box-shadow:0 0 28px #f0f6;transition:opacity .6s';
    document.body.appendChild(el);
  }
  el.innerHTML=`<div style="font-size:.65rem;color:#f0f;margin-bottom:4px">MISSION BRIEFING</div>${msg}`;
  el.style.display='block';el.style.opacity='1';
  clearTimeout(el._t1);clearTimeout(el._t2);
  el._t1=setTimeout(()=>el.style.opacity='0',4500);
  el._t2=setTimeout(()=>el.style.display='none',5200);
}
function updateDangerIndicator(time){
  let el=document.getElementById('man-danger');
  const active=(gamePhase==='defend'||gamePhase==='burn')&&manIntegrity<50;
  if(!el){
    if(!active)return;
    el=document.createElement('div');el.id='man-danger';
    el.style.cssText='position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:25;pointer-events:none;padding:6px 16px;border-radius:8px;background:rgba(80,0,0,.85);border:1px solid #f44;color:#ff6b6b;font-weight:bold;font-size:.85rem;letter-spacing:.06em';
    document.body.appendChild(el);
  }
  if(!active){el.style.display='none';return}
  el.style.display='block';
  el.textContent=`⚠ THE MAN IN DANGER — ${Math.round(manIntegrity)}% INTEGRITY`;
  el.style.opacity=String(0.55+0.45*Math.abs(Math.sin(time*4)));
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
  if(!hasGun)setTimeout(()=>hint('needgun','🔫 Drones incoming — grab the Plasma Rifle (orange beam near spawn) to fight back'),1500);
  else if((inventory.bomb||0)>0)setTimeout(()=>hint('bombtip','💣 Tip: G throws a bomb — great vs. drone clusters'),3000);
  for(let i=0;i<n;i++){
    const mat=new THREE.SpriteMaterial({map:textures.rogue_drone||null,transparent:true,alphaTest:0.1,depthWrite:false});
    if(!textures.rogue_drone)mat.color=new THREE.Color(LOOK.PAL.hostile);
    const spr=new THREE.Sprite(mat);
    spr.scale.set(1.6,1.6,1);
    const a=Math.random()*Math.PI*2,r=25+Math.random()*40;
    spr.position.set(Math.cos(a)*r,4+Math.random()*6,Math.sin(a)*r);
    spr.userData={isRogue:true,hp:30,phase:Math.random()*Math.PI*2,speed:0.015+Math.random()*0.02,fireT:2+Math.random()*4};
    if(attachSheet(spr,'drone','hover'))spr.scale.set(2,2,1);
    scene.add(spr);rogueDrones.push(spr);
  }
  showToast(`${n} rogue drones inbound!`);
}

// ---- Drone Mode scoring: score, combo (3s window, up to x5), best in localStorage, boss every 5 waves ----
let dmScore=0,dmCombo=1,dmComboT=0,dmBest=+(localStorage.getItem('cbm_drone_best')||0);
function updateScoreHud(){
  if(!droneMode)return;const el=ensureHudBox('score','SCORE','#00ffcc');
  el.innerHTML=`${dmScore}${dmCombo>1?` <b style="color:#ff3399">x${dmCombo}</b>`:''} <span style="opacity:.6;font-size:.8em">best ${dmBest}</span>`;
}
function scoreKill(spr){
  if(!droneMode)return;
  const base=spr.userData.isBoss?500:spr.userData.isRogue?100:150;
  const pts=base*dmCombo;dmScore+=pts;
  spawnDmgNum(spr.position.clone().add(new THREE.Vector3(0,1.2,0)),`+${pts}${dmCombo>1?' x'+dmCombo:''}`,'#00ffcc');
  dmCombo=Math.min(5,dmCombo+(dmComboT>0?1:0));dmComboT=3;
  if(dmScore>dmBest){dmBest=dmScore;localStorage.setItem('cbm_drone_best',dmBest)}
  updateScoreHud();
}
function tickCombo(dt){if(dmComboT>0){dmComboT-=dt;if(dmComboT<=0){dmCombo=1;updateScoreHud()}}}
function spawnBossDrone(){
  const mat=new THREE.SpriteMaterial({map:textures.rogue_drone||null,transparent:true,alphaTest:0.1,depthWrite:false,color:0xff5577});
  const spr=new THREE.Sprite(mat);spr.scale.set(4,4,1);
  const a=Math.random()*Math.PI*2;spr.position.set(Math.cos(a)*45,10,Math.sin(a)*45);
  spr.userData={isRogue:true,isBoss:true,hp:300,phase:0,speed:0.012,fireT:1.5,baseY:10};
  if(attachSheet(spr,'drone','hover'))spr.scale.set(4.5,4.5,1);
  spr.material.color.set(0xff5577);spr.userData.baseColor=new THREE.Color(0xff5577);
  scene.add(spr);rogueDrones.push(spr);
  showPhaseBanner(`⚠ BOSS DRONE — wave ${droneModeWave} · 300 HP`);SFX.boom();
}
function dropWaveLoot(){
  const o=controls.getObject().position;
  const mk=(color,geo)=>new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x111111,emissive:color,emissiveIntensity:1.5,metalness:0.6,roughness:0.3}));
  for(let i=0;i<4;i++){const bomb=i===3;const m=bomb?mk(0xff2244,new THREE.SphereGeometry(0.35,12,10)):mk(0xffaa00,new THREE.BoxGeometry(0.6,0.4,0.4));
    const a=i/4*Math.PI*2;m.position.set(o.x+Math.cos(a)*6,0.5,o.z+Math.sin(a)*6);scene.add(m);(bomb?bombPickups:ammoPickups).push(m)}
}

let droneMode=false,droneModeWave=0;
function startDroneMode(){
  droneMode=true;droneModeWave=1;dmScore=0;dmCombo=1;dmComboT=0;
  takeGun();inventory.bomb=(inventory.bomb||0)+3;
  phaseUnlocked.drone=true;setPhase('drone');
  if(padDrone){rideDrone=padDrone;boardDrone()}
  controls.getObject().position.y=8;
  if(tut)tut.onDone=()=>{spawnRogueDrones(6);updateScoreHud()};else spawnRogueDrones(6);updateScoreHud();
  showPhaseBanner('DRONE MODE — wave 1 · Click fire · G bomb · Space up · C/Ctrl/Q down · WASD/wheel fly');
}
function checkDroneWave(){
  if(tut)return; // training drone kill must not trigger waves
  if(droneMode&&rogueDrones.length===0){
    const bonus=droneModeWave*250;dmScore+=bonus;if(dmScore>dmBest){dmBest=dmScore;localStorage.setItem('cbm_drone_best',dmBest)}
    droneModeWave++;tokens+=20;rockets=ROCKET_MAX;updateRocketHud();inventory.bomb=(inventory.bomb||0)+1;ammo=AMMO_MAX;updateAmmoHud();dropWaveLoot();updateScoreHud();
    showPhaseBanner(`DRONE MODE — wave ${droneModeWave} (+${bonus} wave bonus, +1 bomb, ammo refilled, loot dropped)`);
    setTimeout(()=>{spawnRogueDrones(4+droneModeWave*2);if(droneModeWave%5===0)spawnBossDrone()},2500);updateUI();return;
  }
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
    const mat=new THREE.SpriteMaterial({map:tex,transparent:true,alphaTest:0.12,depthWrite:false,color:0xff9a9a});
    const sheeted=!!(textures['arsonist_sheet.webp']?.image?.width>64);   // hostile tint, softened so it reads as tint not glow
    const spr=new THREE.Sprite(mat);
    spr.scale.set(2,3,1);
    const a=Math.random()*Math.PI*2,r=40+Math.random()*30;
    spr.position.set(Math.cos(a)*r,1.5,Math.sin(a)*r);
    spr.userData={isEnemy:true,hp:45,fireTimer:3+Math.random()*4,phase:Math.random()*Math.PI*2};
    if(sheeted&&attachSheet(spr,'arsonist','run')){spr.material.color.set(0xffffff);spr.scale.set(2.4,3.6,1)}
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
  if(ffDrone)hint('fire','🔥 Fire at The Man — your Firefighter Drone is on it (H to ride & spray)',25);
  else if(extCharges>0)hint('fire',`🔥 Fire at The Man! Run over and press X to foam it (${extCharges} charges)`,25);
  else hint('fire','🔥 Fire at The Man! Stomp it with E, or forge an Extinguisher / Firefighter Drone in Ω Panel (I) → Forge',25);
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

function ensureHudBox(id,label,color){
  let el=document.getElementById(id);
  if(el)return el;
  const box=document.createElement('div');box.className='hud-box';box.style.textAlign='center';
  box.innerHTML=`<div style="font-size:.6rem;color:#8af">${label}</div><div id="${id}" style="font-size:1.1rem;color:${color}"></div>`;
  document.getElementById('hud').appendChild(box);
  return document.getElementById(id);
}
function updateAmmoHud(){
  const el=ensureHudBox('ammo','AMMO','#ffaa00');
  el.textContent=`${ammo} / ${AMMO_MAX}`;
}
function tickAmmoRegen(delta){
  if(ammo>=AMMO_MAX){ammoRegenTimer=0;return}
  ammoRegenTimer+=delta;
  if(ammoRegenTimer>=AMMO_REGEN_SEC){ammoRegenTimer-=AMMO_REGEN_SEC;ammo=Math.min(AMMO_MAX,ammo+1);updateAmmoHud()}
}

function updateUI(){
  updateAmmoHud();
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
const WALK_FRAME_MS=300;
// Two-frame walk cycle: swaps userData.frames[0/1] textures when a second frame exists,
// otherwise a procedural step (tilt + squash/stretch) on the same 300ms beat.
// ---- Lightweight solid collisions (XZ circles; skipped when flying above the obstacle) ----
// Intentionally simple so it doesn't fight PR #4's Rapier controller; swap for PHYS when that lands.
let staticColliders=null;
const PLAYER_R=0.5;
function buildColliders(){
  const out=[];
  if(theMan)out.push({x:theMan.position.x,z:theMan.position.z,r:4,h:12});
  installations.forEach(o=>{
    if(o.userData.isStation)out.push({x:o.position.x,z:o.position.z,r:1.8,h:1});
    else if(o.children&&o.children.length>=6&&Math.abs(o.position.x+62)<1){ // temple pillars
      for(let i=0;i<4;i++)out.push({x:o.position.x+(i%2?4.5:-4.5),z:o.position.z+(i<2?4.5:-4.5),r:0.6,h:11});
    }
  });
  npcs.forEach(n=>out.push({ref:n,r:0.6,h:2.5}));
  return out;
}
function resolveCollisions(pos){
  if(!staticColliders)staticColliders=buildColliders();
  const dyn=[];
  installations.forEach(o=>{if(o.userData.isCar)dyn.push({x:o.position.x,z:o.position.z,r:2.4,h:3})});
  enemyNpcs.forEach(e=>dyn.push({x:e.position.x,z:e.position.z,r:0.6,h:2.5}));
  const feet=pos.y-1.7;
  for(const c of staticColliders.concat(dyn)){
    const cx=c.ref?c.ref.position.x:c.x,cz=c.ref?c.ref.position.z:c.z;
    if(feet>c.h)continue;
    const dx=pos.x-cx,dz=pos.z-cz,d=Math.hypot(dx,dz),min=c.r+PLAYER_R;
    if(d<min&&d>1e-4){const push=(min-d)/d;pos.x+=dx*push;pos.z+=dz*push;velocity.x*=0.5;velocity.z*=0.5}
  }
}


// ---- Pickups (ammo crates, bombs) + forge (extinguisher, scanner) ----
const _hintAt={};function hint(k,msg,cool=20){const n=performance.now();if(_hintAt[k]&&n-_hintAt[k]<cool*1000)return;_hintAt[k]=n;showToast(msg)}
let ffDrone=null,padDrone=null;
let ammoPickups=[],bombPickups=[],bombsLive=[],extCharges=0,hasScanner=false;
const BOMB_RADIUS=8,BOMB_DMG=60;
function spawnWorldPickups(){
  const mk=(color,geo)=>new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x111111,emissive:color,emissiveIntensity:1.5,metalness:0.6,roughness:0.3}));
  for(let i=0;i<16;i++){
    const m=mk(0xffaa00,new THREE.BoxGeometry(0.6,0.4,0.4));
    const a=Math.random()*Math.PI*2,r=12+Math.random()*70;m.position.set(Math.cos(a)*r,0.5,Math.sin(a)*r);
    scene.add(m);ammoPickups.push(m);
  }
  for(let i=0;i<8;i++){
    const m=mk(0xff2244,new THREE.SphereGeometry(0.35,12,10));
    const a=Math.random()*Math.PI*2,r=12+Math.random()*70;m.position.set(Math.cos(a)*r,0.5,Math.sin(a)*r);
    scene.add(m);bombPickups.push(m);
  }
  // one of each right by spawn so players learn them
  ammoPickups[0].position.set(1,0.5,19);bombPickups[0].position.set(-1.5,0.5,18.5);
}
function tickWorldPickups(time){
  if(!player)return;
  for(let i=ammoPickups.length-1;i>=0;i--){
    const m=ammoPickups[i];m.rotation.y=time*2;
    if(flatDist(player.position,m.position)<AUTO_PICKUP_RANGE&&ammo<AMMO_MAX){
      ammo=Math.min(AMMO_MAX,ammo+6);updateAmmoHud();scene.remove(m);ammoPickups.splice(i,1);showToast('📦 Ammo +6');SFX.chime();
    }
  }
  for(let i=bombPickups.length-1;i>=0;i--){
    const m=bombPickups[i];m.position.y=0.5+Math.sin(time*3+i)*0.1;
    if(flatDist(player.position,m.position)<AUTO_PICKUP_RANGE){
      inventory.bomb=(inventory.bomb||0)+1;scene.remove(m);bombPickups.splice(i,1);SFX.chime();
      showToast(`💣 Bomb picked up (${inventory.bomb}) — G to throw`);updateUI();
    }
  }
}
function throwBomb(){
  if((inventory.bomb||0)<1){hint('nobomb','💣 No bombs — red orbs on the playa (see minimap)');return}
  inventory.bomb--;updateUI();
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.3,10,8),new THREE.MeshBasicMaterial({color:0xff2244}));
  const o=controls.getObject().position,dir=new THREE.Vector3();camera.getWorldDirection(dir);
  m.position.copy(o).addScaledVector(dir,1);
  m.userData.v=dir.multiplyScalar(18).add(new THREE.Vector3(0,5,0));m.userData.t=0;
  scene.add(m);bombsLive.push(m);
}
function explodeAt(p){
  const fx=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false}));
  fx.position.copy(p);scene.add(fx);let k=0;const iv=setInterval(()=>{k++;fx.scale.setScalar(1+k*0.8);fx.material.opacity=0.7-k*0.07;if(k>=10){clearInterval(iv);scene.remove(fx)}},30);
  let hits=0;SFX.boom();shake(Math.max(0.08,0.5-camera.position.distanceTo(p)*0.012));
  for(let i=rogueDrones.length-1;i>=0;i--){const d=rogueDrones[i];if(d.position.distanceTo(p)<BOMB_RADIUS){d.userData.hp=(d.userData.hp||30)-BOMB_DMG;onHit(d,BOMB_DMG,p,2.5);if(d.userData.hp<=0){killSprite(d,'explode');rogueDrones.splice(i,1);tokens+=8;hits++}}}
  for(let i=enemyNpcs.length-1;i>=0;i--){const e=enemyNpcs[i];if(e.position.distanceTo(p)<BOMB_RADIUS){e.userData.hp=(e.userData.hp||40)-BOMB_DMG;onHit(e,BOMB_DMG,p,2.5);if(e.userData.hp<=0){killSprite(e,'death');enemyNpcs.splice(i,1);tokens+=15;hits++}}}
  showToast(hits?`💥 Boom! ${hits} down`:'💥 Boom!');
  if(gamePhase==='drone')checkDroneWave();if(gamePhase==='defend')checkDefendWin();updateUI();
}
function tickBombs(delta){
  for(let i=bombsLive.length-1;i>=0;i--){
    const b=bombsLive[i];b.userData.t+=delta;b.userData.v.y-=18*delta;b.position.addScaledVector(b.userData.v,delta);
    if(b.position.y<=0.3||b.userData.t>2.5){scene.remove(b);bombsLive.splice(i,1);explodeAt(b.position)}
  }
}
function sprayFoam(){
  if(!(droneBoarded&&rideDrone===ffDrone)&&extCharges<=0){
    hint('noext','🧯 No extinguisher — forge one in Ω Panel (I) → Forge');return;
  }
  SFX.hiss();
  const o=controls.getObject().position,dir=new THREE.Vector3();camera.getWorldDirection(dir);dir.y=0;dir.normalize();
  let out=0;
  for(let i=fires.length-1;i>=0;i--){
    const f=fires[i],to=f.position.clone().sub(o);to.y=0;const d=to.length();
    if(d<8&&(d<2.5||to.normalize().dot(dir)>0.3)){scene.remove(f);fires.splice(i,1);out++;manIntegrity=Math.min(100,manIntegrity+4)}
  }
  if(!(droneBoarded&&rideDrone===ffDrone))extCharges--;
  showToast(out?`🧯 Foam! ${out} fire${out>1?'s':''} out`:'🧯 Foam sprayed — aim at a fire within 8m');
  if(gamePhase==='defend')checkDefendWin();updateUI();
}
const FORGE=[
  {id:'extinguisher',label:'🧯 Fire Extinguisher',desc:'8 foam blasts (X). Cost: Plasma Vial or 25 tokens',items:{'plasma-vial':1},tokens:25},
  {id:'scanner',label:'📡 Scanner',desc:'Shows enemies on the minimap. Cost: Circuit Board + Neon Shard or 40 tokens',items:{'circuit-board':1,'neon-shard':1},tokens:40},
];
function forge(id){
  const r=FORGE.find(f=>f.id===id);if(!r)return;
  const hasItems=Object.entries(r.items).every(([k,v])=>(inventory[k]||0)>=v);
  if(hasItems)for(const[k,v]of Object.entries(r.items))inventory[k]-=v;
  else if(tokens>=r.tokens)tokens-=r.tokens;
  else{showToast(`Need ${Object.keys(r.items).map(k=>ITEM_DEFS[k]?.name||k).join(' + ')} or ${r.tokens} tokens`);return}
  if(id==='extinguisher'){extCharges+=8;inventory.extinguisher=1;showToast('🧯 Extinguisher forged — X to spray foam')}
  if(id==='scanner'){hasScanner=true;inventory.scanner=1;showToast('📡 Scanner forged — enemies now show on the minimap')}
  if(r.onForge)r.onForge();
  updateUI();
}
window.forgeItem=forge;
function renderForgeUI(){
  const tab=document.getElementById('tab-omega');if(!tab)return;
  let box=document.getElementById('forge-box');
  if(!box){box=document.createElement('div');box.id='forge-box';tab.appendChild(box)}
  box.innerHTML='<h3 style="margin-top:8px">🔨 Forge</h3>'+FORGE.map(f=>`<button class="station-btn" onclick="forgeItem('${f.id}')">${f.label}<small>${f.desc}</small></button>`).join('');
}


// ---- Firefighter Drone: forged companion; auto-hunts fires, H to ride (X/right-click sprays foam, unlimited) ----
let ffCool=0;
function makeFFDrone(){
  const g=new THREE.Group();
  const hull=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.35,1.0),new THREE.MeshStandardMaterial({color:0x330000,emissive:0xff2200,emissiveIntensity:1.2,metalness:0.7,roughness:0.3}));
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.9,10),new THREE.MeshBasicMaterial({color:0xffffff}));tank.rotation.z=Math.PI/2;tank.position.y=0.3;
  g.add(hull,tank);
  for(let k=0;k<4;k++){const r=new THREE.Mesh(new THREE.TorusGeometry(0.35,0.05,6,14),new THREE.MeshBasicMaterial({color:0xff4422}));r.rotation.x=Math.PI/2;r.position.set(k%2?0.8:-0.8,0.2,k<2?0.6:-0.6);g.add(r)}
  g.position.set(player.position.x+2,3,player.position.z);scene.add(g);return g;
}
function toggleRideFF(){
  if(!ffDrone){hint('noff','🚒 Forge a Firefighter Drone in Ω Panel (I) → Forge');return}
  if(droneBoarded){exitDrone();return}
  rideDrone=ffDrone;boardDrone();showToast('🚒 Riding Firefighter Drone — X / right-click sprays foam (unlimited) · H to hop off');
}
function tickFFDrone(delta,time){
  if(!ffDrone||(droneBoarded&&rideDrone===ffDrone))return;
  if(!droneBoarded&&rideDrone===ffDrone)rideDrone=padDrone;
  ffCool-=delta;
  let best=null,bd=Infinity;for(const f of fires){const d=flatDist(ffDrone.position,f.position);if(d<bd){bd=d;best=f}}
  const tgt=best?best.position:new THREE.Vector3(player.position.x+2.5,0,player.position.z+1.5);
  const dx=tgt.x-ffDrone.position.x,dz=tgt.z-ffDrone.position.z,d=Math.hypot(dx,dz);
  if(d>0.8){const sp=Math.min(d,(best?9:12)*delta);ffDrone.position.x+=dx/d*sp;ffDrone.position.z+=dz/d*sp}
  ffDrone.position.y=(best?2.2:3)+Math.sin(time*3)*0.15;ffDrone.rotation.y=Math.atan2(dx,dz);
  if(best&&bd<1.8&&ffCool<=0){
    ffCool=1.2;scene.remove(best);fires.splice(fires.indexOf(best),1);manIntegrity=Math.min(100,manIntegrity+4);
    showToast('🚒 Firefighter Drone put out a fire');if(gamePhase==='defend')checkDefendWin();updateUI();
  }
}
FORGE.push({id:'ff-drone',label:'🚒 Firefighter Drone',desc:'Companion that flies to fires and foams them; H to ride. Cost: Circuit Board + Fiber Coil or 60 tokens',items:{'circuit-board':1,'fiber-coil':1},tokens:60,
  onForge(){if(ffDrone){showToast('You already have a Firefighter Drone');return}ffDrone=makeFFDrone();inventory['ff-drone']=1;showToast('🚒 Firefighter Drone deployed — it hunts fires on its own. H to ride it.')}});


// ---- Minimap radar (heading-up, 60m radius) ----
let mmCtx=null;const MM_SIZE=150,MM_RANGE=60;
function ensureMinimap(){
  if(mmCtx)return mmCtx;
  const c=document.createElement('canvas');c.id='minimap';c.width=c.height=MM_SIZE;
  c.style.cssText='position:fixed;right:14px;bottom:14px;width:150px;height:150px;border-radius:50%;border:2px solid #0ff8;background:rgba(0,10,25,.7);box-shadow:0 0 20px #0ff4;z-index:15;pointer-events:none';
  document.body.appendChild(c);mmCtx=c.getContext('2d');return mmCtx;
}
function drawMinimap(){
  if(!gameStarted||!player)return;
  const g=ensureMinimap(),R=MM_SIZE/2,sc=R/MM_RANGE;
  const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;if(f.lengthSq()<1e-6)f.set(0,0,-1);f.normalize();
  const rx=-f.z,rz=f.x;
  g.clearRect(0,0,MM_SIZE,MM_SIZE);
  g.save();g.beginPath();g.arc(R,R,R-1,0,Math.PI*2);g.clip();
  g.strokeStyle='#0ff3';g.lineWidth=1;[R*0.33,R*0.66].forEach(r=>{g.beginPath();g.arc(R,R,r,0,Math.PI*2);g.stroke()});
  const dot=(p,col,size=3,shape='dot',clamp=false)=>{
    const dx=p.x-player.position.x,dz=p.z-player.position.z;
    let sx=(dx*rx+dz*rz)*sc,sy=-(dx*f.x+dz*f.z)*sc;
    const d=Math.hypot(sx,sy);if(d>R-6){if(!clamp)return;sx*=(R-6)/d;sy*=(R-6)/d}
    g.fillStyle=col;g.beginPath();
    if(shape==='sq')g.rect(R+sx-size,R+sy-size,size*2,size*2);
    else if(shape==='tri'){g.moveTo(R+sx,R+sy-size-1);g.lineTo(R+sx+size,R+sy+size);g.lineTo(R+sx-size,R+sy+size)}
    else g.arc(R+sx,R+sy,size,0,Math.PI*2);
    g.fill();
  };
  ammoPickups.forEach(m=>dot(m.position,'#ffaa00',2.2,'sq'));
  bombPickups.forEach(m=>dot(m.position,'#ff2244',2.5));
  if(gunPickup&&!hasGun)dot(gunPickup.position,'#ff7700',4.5,'sq',true);
  if(padDrone&&!(droneBoarded&&rideDrone===padDrone))dot(padDrone.position,'#00ffcc',4,'tri',true);
  if(ffDrone&&!(droneBoarded&&rideDrone===ffDrone))dot(ffDrone.position,'#ff3311',4,'tri',true);
  fires.forEach(m=>dot(m.position,'#ff8800',2));
  const broker=npcs.find(n=>n.userData.name==='x402 Broker');if(broker)dot(broker.position,'#ffff00',4,'dot',true);
  if(theMan)dot(theMan.position,'#ffffff',5,'dot',true);
  if(hasScanner){rogueDrones.forEach(d=>dot(d.position,'#ff00ff',3));enemyNpcs.forEach(e=>dot(e.position,'#ff0044',3))}
  g.restore();
  g.fillStyle='#0ff';g.beginPath();g.moveTo(R,R-8);g.lineTo(R+5,R+5);g.lineTo(R,R+2);g.lineTo(R-5,R+5);g.fill();
  g.fillStyle='#9cf';g.font='9px monospace';g.fillText(hasScanner?'SCAN ON':'no scanner',R-24,MM_SIZE-10);
}


// ---- Sprite-sheet animation state machine ----
// Sheets are grids of equal cells; each anim = row, start col, frame count, fps, once?
const SHEETS={
  arsonist:{tex:'arsonist_sheet.webp',cols:4,rows:4,anims:{
    walk:{row:0,n:4,fps:7},run:{row:1,n:4,fps:11},throw:{row:2,n:3,fps:7,once:true,next:'walk'},death:{row:3,n:3,fps:6,once:true}}},
  drone:{tex:'rogue_drone_sheet.webp',cols:4,rows:2,anims:{
    hover:{row:0,n:2,fps:8},fire:{row:0,start:2,n:2,fps:8,once:true,next:'hover'},explode:{row:1,n:4,fps:10,once:true}}}
};
function attachSheet(spr,key,state){
  const sh=SHEETS[key],base=textures[sh.tex];
  if(!base||!base.image||base.image.width<=64)return false; // missing -> keep tilt/squash fallback
  const t=base.clone();t.needsUpdate=true;t.repeat.set(1/sh.cols,1/sh.rows);
  spr.material.map=t;spr.material.needsUpdate=true;
  spr.userData.anim={sheet:sh,state:null,t:0,frame:-1,done:false,face:1};
  setAnim(spr,state);return true;
}
function setAnim(spr,state,force){
  const a=spr.userData.anim;if(!a||!a.sheet.anims[state])return;
  if(a.state===state&&!force)return;
  a.state=state;a.t=0;a.frame=-1;a.done=false;
}
function tickAnim(spr,dt){
  const a=spr.userData.anim;if(!a)return false;
  const an=a.sheet.anims[a.state];a.t+=dt;
  let f=Math.floor(a.t*an.fps);
  if(an.once&&f>=an.n){f=an.n-1;if(!a.done){a.done=true;if(an.next)setAnim(spr,an.next)}}
  else f%=an.n;
  if(f!==a.frame){a.frame=f;const sh=a.sheet,col=(an.start||0)+f;
    spr.material.map.offset.set(col/sh.cols,1-(an.row+1)/sh.rows);}
  return true;
}
// Flip sheet (drawn facing right) by movement direction relative to camera's right vector.
const _camR=new THREE.Vector3();
function faceByMotion(spr,dx,dz){
  const a=spr.userData.anim;if(!a||Math.abs(dx)+Math.abs(dz)<1e-4)return;
  _camR.setFromMatrixColumn(camera.matrixWorld,0);
  const s=(dx*_camR.x+dz*_camR.z)<0?-1:1;
  if(s!==a.face){a.face=s;spr.scale.x=Math.abs(spr.scale.x)*s}
}
// Corpses/explosions play their one-shot anim then get removed.
const dyingSprites=[];
function killSprite(spr,state){
  scoreKill(spr);
  if(!spr.userData.isRogue&&theMan&&flatDist(spr.position,theMan.position)>8){
    tokens+=10;manIntegrity=Math.min(100,manIntegrity+2);
    spawnDmgNum(spr.position.clone().add(new THREE.Vector3(0,2.4,0)),'INTERCEPT! +10','#ffd000');updateUI();
  }
  if(spr.userData.anim){setAnim(spr,state,true);spr.userData.dying=true;dyingSprites.push(spr)}
  else scene.remove(spr);
}
function tickDying(dt){
  for(let i=dyingSprites.length-1;i>=0;i--){const s=dyingSprites[i];tickAnim(s,dt);
    if(s.userData.anim.done){s.userData.linger=(s.userData.linger||0)+dt;
      if(s.userData.linger>(s.userData.isRogue?0.1:1.5)){s.material.opacity=Math.max(0,1-(s.userData.linger-1.5));}
      if(s.userData.linger>(s.userData.isRogue?0.2:2.5)){scene.remove(s);s.material.map.dispose();dyingSprites.splice(i,1)}}}
}


// ---- Hit feedback: hitmarker, damage numbers, flash, knockback, shake, hitstop ----
let hitstop=0,shakeAmt=0;const dmgNums=[];
function ensureHitmarker(){
  let h=document.getElementById('hitmarker');if(h)return h;
  h=document.createElement('div');h.id='hitmarker';
  h.style.cssText='position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:30;opacity:0;transition:opacity .12s';
  h.innerHTML='<svg viewBox="0 0 26 26" width="26" height="26" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M3 3l6 6M23 3l-6 6M3 23l6-6M23 23l-6-6"/></svg>';
  document.body.appendChild(h);return h;
}
function flashHitmarker(kill){const h=ensureHitmarker();h.querySelector('svg').setAttribute('stroke',kill?'#ff3355':'#fff');h.style.transition='none';h.style.opacity=1;h.style.transform=kill?'scale(1.4)':'scale(1)';requestAnimationFrame(()=>{h.style.transition='opacity .25s';h.style.opacity=0})}
function spawnDmgNum(pos,txt,col){
  const el=document.createElement('div');el.textContent=txt;
  el.style.cssText=`position:fixed;pointer-events:none;z-index:29;font:bold 18px monospace;color:${col};text-shadow:0 0 6px #000,0 0 10px ${col}`;
  document.body.appendChild(el);dmgNums.push({el,p:pos.clone().add(new THREE.Vector3((Math.random()-.5)*.6,1.6,0)),t:0});
}
function tickDmgNums(dt){
  const v=new THREE.Vector3();
  for(let i=dmgNums.length-1;i>=0;i--){const d=dmgNums[i];d.t+=dt;d.p.y+=dt*1.5;
    if(d.t>0.9){d.el.remove();dmgNums.splice(i,1);continue}
    v.copy(d.p).project(camera);
    if(v.z>1){d.el.style.display='none';continue}
    d.el.style.display='block';d.el.style.left=((v.x+1)/2*innerWidth)+'px';d.el.style.top=((1-v.y)/2*innerHeight)+'px';d.el.style.opacity=String(1-d.t/0.9);
  }
}
// ---- First drone run tutorial (completion in localStorage 'cbm_drone_tut'; Skip after basics, always on later runs via 'cbm_drone_tut_seen') ----
let tut=null;
const TUT_STEPS=[
  {t:'⬆ Hold SPACE to climb',k:'up'},{t:'⬇ Hold C / Ctrl / Q to descend',k:'down'},
  {t:'⬅ Strafe LEFT (A)',k:'left'},{t:'➡ Strafe RIGHT (D)',k:'right'},
  {t:'⏫ Fly FORWARD (W or wheel up)',k:'fwd'},{t:'⏬ Fly BACK (S or wheel down)',k:'back'},
  {t:'↗ Go DIAGONAL (W+A or W+D together)',k:'diag'},
  {t:'🎯 SHOOT the training drone (click — it\'s marked on the minimap)',k:'hit'},{t:'💥 DESTROY it',k:'kill'}];
const TUT_BASICS=7;
function startTutorial(){
  tut={i:0,acc:0,y0:controls.getObject().position.y,target:null,onDone:null};
  if(!hasGun)takeGun();
  let el=document.getElementById('tut-box');
  if(!el){el=document.createElement('div');el.id='tut-box';el.style.cssText='position:fixed;top:22%;left:50%;transform:translateX(-50%);background:rgba(0,10,20,.85);border:2px solid #0ff;border-radius:12px;padding:12px 20px;color:#fff;font:600 1rem monospace;z-index:60;text-align:center;box-shadow:0 0 18px #0ff8';
    el.innerHTML='<div style="font-size:.65rem;color:#0ff;letter-spacing:2px">DRONE FLIGHT SCHOOL</div><div id="tut-step" style="margin:6px 0"></div><div id="tut-prog" style="font-size:.7rem;color:#8af"></div><button id="tut-skip" style="display:none;margin-top:8px;background:#f0f;border:0;border-radius:20px;padding:5px 16px;font-weight:bold;cursor:pointer">SKIP (K)</button>';
    document.body.appendChild(el);el.querySelector('#tut-skip').onclick=()=>endTutorial(true)}
  el.style.display='block';renderTut();
}
function renderTut(){
  if(!tut)return;document.getElementById('tut-step').textContent=TUT_STEPS[tut.i].t;
  document.getElementById('tut-prog').textContent=`step ${tut.i+1}/${TUT_STEPS.length}`;
  document.getElementById('tut-skip').style.display=(tut.i>=TUT_BASICS||localStorage.getItem('cbm_drone_tut_seen'))?'inline-block':'none';
}
function tutAdvance(){tut.i++;tut.acc=0;tut.y0=controls.getObject().position.y;SFX.chime();
  if(tut.i===7&&!tut.target){spawnRogueDrones(1);tut.target=rogueDrones[rogueDrones.length-1];Object.assign(tut.target.userData,{tut:true,hp:40,speed:0,fireT:1e9});const p=controls.getObject().position,d=new THREE.Vector3();camera.getWorldDirection(d);d.y=0;d.normalize();tut.target.position.set(p.x+d.x*7,p.y,p.z+d.z*7);tut.target.userData.baseY=p.y}
  if(tut.i>=TUT_STEPS.length){endTutorial(false);return}renderTut()}
function endTutorial(skipped){
  if(!tut)return;localStorage.setItem('cbm_drone_tut_seen','1');if(!skipped)localStorage.setItem('cbm_drone_tut','1');
  if(tut.target&&rogueDrones.includes(tut.target)){scene.remove(tut.target);rogueDrones.splice(rogueDrones.indexOf(tut.target),1)}
  const cb=tut.onDone;tut=null;document.getElementById('tut-box').style.display='none';
  showToast(skipped?'Tutorial skipped — it stays skippable next time':'✅ Flight school complete! You\'re cleared for combat.');cb&&cb();
}
function tickTutorial(dt){
  if(!tut||!droneBoarded)return;const k=TUT_STEPS[tut.i].k,y=controls.getObject().position.y;
  const held={left:moveLeft&&!moveRight,right:moveRight&&!moveLeft,fwd:moveForward||velocity.z<-6,back:moveBackward||velocity.z>6,diag:(moveForward||moveBackward)&&(moveLeft||moveRight)}[k];
  if(k==='up'&&y>tut.y0+3)tutAdvance();else if(k==='down'&&y<tut.y0-2.5)tutAdvance();
  else if(held!==undefined){if(held){tut.acc+=dt;if(tut.acc>0.6)tutAdvance()}}
  else if(k==='hit'&&tut.target&&tut.target.userData.hp<40)tutAdvance();
  else if(k==='kill'&&tut.target&&!rogueDrones.includes(tut.target)){tut.target=null;tutAdvance()}
}
// ---- Mini rockets + lock-on: T targeting, Y auto/manual, V or click fires when locked ----
const ROCKET_MAX=6,LOCK_TIME=1.2;let rockets=ROCKET_MAX,targeting=false,autoFire=localStorage.getItem('cbm_autofire')!=='0',lockT=null,lockP=0,rocketsLive=[];
function ensureLockHud(){
  let el=document.getElementById('lock-hud');if(el)return el;
  el=document.createElement('div');el.id='lock-hud';el.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:55;display:none;font:700 12px monospace;color:#0f8';
  el.innerHTML='<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,255,120,.06) 0 2px,transparent 2px 4px);border:3px solid rgba(0,255,120,.35)"></div>'+
   '<div id="lk-x" style="position:absolute;height:3px;width:90px;background:#f33;box-shadow:0 0 8px #f33"></div><div id="lk-y" style="position:absolute;width:3px;height:90px;background:#3f3;box-shadow:0 0 8px #3f3"></div><div id="lk-z" style="position:absolute;width:70px;height:70px;border:3px solid #39f;border-radius:50%;box-shadow:0 0 8px #39f"></div>'+
   '<div id="lk-box" style="position:absolute;width:56px;height:56px;border:2px dashed #0f8"></div>'+
   '<div id="lk-txt" style="position:absolute;left:50%;top:14%;transform:translateX(-50%);font-size:18px;text-shadow:0 0 6px #0f8;letter-spacing:3px"></div>'+
   '<div style="position:absolute;left:24px;bottom:120px;line-height:1.5">TGT SYS v0.9 ▮ <span id="lk-mode"></span><br>ROCKETS <span id="lk-ammo"></span><br><span style="opacity:.6">T exit · Y auto/manual · V fire</span></div>';
  document.body.appendChild(el);return el;
}
function updateRocketHud(){ensureHudBox('rockets','ROCKETS','#ff8844').textContent=`${rockets}/${ROCKET_MAX} ${autoFire?'AUTO':'MAN'}`}
function toggleTargeting(){targeting=!targeting;lockT=null;lockP=0;ensureLockHud().style.display=targeting?'block':'none';updateRocketHud();if(targeting)hint('tgt',`🎯 Targeting ON — keep an enemy near the crosshair to lock (${autoFire?'auto':'manual: V/click'} fire)`,10)}
function toggleAutoFire(){autoFire=!autoFire;localStorage.setItem('cbm_autofire',autoFire?'1':'0');updateRocketHud();showToast(`🚀 Rocket fire: ${autoFire?'AUTO on lock':'MANUAL (V / click when locked)'}`)}
function pickLockTarget(){
  const p=camera.getWorldPosition(new THREE.Vector3()),dir=new THREE.Vector3();camera.getWorldDirection(dir);let best=null,bd=0.93;
  for(const t of rogueDrones.concat(enemyNpcs)){const to=t.position.clone().sub(p),d=to.length();if(d>70)continue;const dot=to.normalize().dot(dir);if(dot>bd){bd=dot;best=t}}
  return best;
}
function fireRocket(){
  if(!lockT||lockP<1)return false;
  if(rockets<=0){hint('norock','🚀 Out of rockets — clear a wave or grab ammo crates to reload',8);return true}
  rockets--;updateRocketHud();SFX.shot();
  const m=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.6,6),new THREE.MeshBasicMaterial({color:0xffaa33}));
  m.position.copy(camera.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0,-0.5,0));m.userData={tgt:lockT,life:4};scene.add(m);rocketsLive.push(m);
  lockP=0;lockT=null;return true;
}
function tickRockets(dt){
  if(targeting){
    const el=ensureLockHud(),t=pickLockTarget();
    if(t!==lockT){lockT=t;lockP=0}
    if(lockT)lockP=Math.min(1,lockP+dt/LOCK_TIME);
    const W=innerWidth,H=innerHeight;let sx=W/2,sy=H/2;
    if(lockT){const v=lockT.position.clone().project(camera);sx=(v.x+1)/2*W;sy=(1-v.y)/2*H}
    const off=(1-lockP)*220,j=lockP<1?Math.sin(performance.now()/40)*6*(1-lockP):0;
    const X=el.querySelector('#lk-x'),Y=el.querySelector('#lk-y'),Z=el.querySelector('#lk-z'),B=el.querySelector('#lk-box');
    X.style.left=(sx-45-off+j)+'px';X.style.top=(sy-1)+'px';Y.style.left=(sx-1)+'px';Y.style.top=(sy-45+off-j)+'px';
    const zs=70+off;Z.style.width=Z.style.height=zs+'px';Z.style.left=(sx-zs/2)+'px';Z.style.top=(sy-zs/2)+'px';
    B.style.left=(sx-28)+'px';B.style.top=(sy-28)+'px';B.style.borderColor=lockP>=1?'#f33':'#0f8';B.style.display=lockT?'block':'none';
    const locked=lockT&&lockP>=1;
    el.querySelector('#lk-txt').textContent=!lockT?'SCANNING…':locked?'◆ LOCKED ◆':`ACQUIRING SIGNATURE ${Math.round(lockP*100)}%  X${(off/22).toFixed(1)} Y${(off/31).toFixed(1)} Z${(off/17).toFixed(1)}`;
    el.querySelector('#lk-txt').style.color=locked?'#f33':'#0f8';el.querySelector('#lk-mode').textContent=autoFire?'AUTO':'MANUAL';el.querySelector('#lk-ammo').textContent='▮'.repeat(rockets)+'▯'.repeat(ROCKET_MAX-rockets);
    if(locked&&autoFire&&rockets>0)fireRocket();
  }
  for(let i=rocketsLive.length-1;i>=0;i--){const m=rocketsLive[i],t=m.userData.tgt;m.userData.life-=dt;
    const alive=t&&(rogueDrones.includes(t)||enemyNpcs.includes(t));const dest=alive?t.position:m.position.clone().add(new THREE.Vector3(0,-1,0));
    const to=dest.clone().sub(m.position),d=to.length();m.position.add(to.normalize().multiplyScalar(Math.min(d,38*dt)));m.lookAt(dest);m.rotateX(Math.PI/2);
    if(d<1||m.userData.life<=0||!alive){if(alive){t.userData.hp-=40;onHit(t,40,m.position)}explodeAt(m.position.clone());scene.remove(m);rocketsLive.splice(i,1)}}
}
// ---- Dragon wingman: AI escort while you fly a drone (as Panda, or Dragon riding a drone). Wing-flap audio by distance, banks on hard turns, fire breath, smoke screen (B) ----
let wing=null,wingFireCd=2,wingFlapT=0,lastYaw=0,smokeT=0,smokeCd=0,smokes=[];
function makeWingman(){
  const g=new THREE.Group();
  const body=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.dragon_hd||textures.dragon||null,transparent:true,alphaTest:0.08,depthWrite:false}));body.scale.set(2.6,3.6,1);g.add(body);
  const wm=new THREE.MeshStandardMaterial({color:0x220a33,emissive:0x8800ff,emissiveIntensity:0.9,side:THREE.DoubleSide,transparent:true,opacity:0.9});
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, 3.2,0.6,0.4, 2.6,-0.4,-0.9, 0,0,0, 2.6,-0.4,-0.9, 1.2,-0.2,-1.3],3));wg.computeVertexNormals();
  const L=new THREE.Mesh(wg,wm),R=new THREE.Mesh(wg,wm);R.scale.x=-1;L.position.y=R.position.y=0.4;g.add(L,R);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(0.25,2.8,6),new THREE.MeshStandardMaterial({color:0x330044,emissive:0xff00aa,emissiveIntensity:0.6}));tail.rotation.x=Math.PI/2;tail.position.set(0,-0.6,-1.8);g.add(tail);
  g.userData={L,R,tail,bank:0};g.position.copy(player.position);scene.add(g);return g;
}
function smokeScreen(){
  if(!wing){hint('nowing','💨 Smoke screen comes from the Dragon wingman — fly a drone to call him in',10);return}
  if(smokeCd>0){showToast(`💨 Smoke recharging ${Math.ceil(smokeCd)}s`);return}
  smokeCd=20;smokeT=6;SFX.whoosh();showToast('💨 Dragon smoke screen — rogue drones lose you for 6s');
  for(let i=0;i<14;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({color:0x99a0aa,transparent:true,opacity:0.55,depthWrite:false}));
    const a=i/14*Math.PI*2;sp.position.set(player.position.x+Math.cos(a)*4,player.position.y+1+Math.random()*2,player.position.z+Math.sin(a)*4);sp.scale.setScalar(5+Math.random()*3);scene.add(sp);smokes.push(sp)}
}
function wingBreath(t){
  const from=wing.position.clone(),to=t.position.clone();
  for(let k=1;k<=6;k++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.fire_patch||null,color:textures.fire_patch?0xffffff:0xff5500,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    sp.position.lerpVectors(from,to,k/6);sp.scale.setScalar(1+k*0.4);scene.add(sp);setTimeout(()=>scene.remove(sp),350+k*40)}
  SFX.hiss();t.userData.hp-=30;onHit(t,30,from);
  if(t.userData.hp<=0){const isR=rogueDrones.includes(t);killSprite(t,isR?'explode':'death');(isR?rogueDrones:enemyNpcs).splice((isR?rogueDrones:enemyNpcs).indexOf(t),1);tokens+=isR?8:15;showToast('🐉 Dragon wingman torched one!');isR?checkDroneWave():checkDefendWin();updateUI()}
}
function tickWingman(dt,time){
  if(smokeCd>0)smokeCd-=dt;if(smokeT>0)smokeT-=dt;
  for(let i=smokes.length-1;i>=0;i--){const s=smokes[i];s.material.opacity-=dt*0.09;s.scale.multiplyScalar(1+dt*0.1);if(s.material.opacity<=0){scene.remove(s);smokes.splice(i,1)}}
  const want=droneBoarded&&!(selectedChar==='dragon'&&!rideDrone);
  if(want&&!wing){wing=makeWingman();showToast('🐉 Dragon wingman on your wing — fire breath auto, B smoke screen')}
  if(!want&&wing){scene.remove(wing);wing=null}
  if(!wing)return;
  const yaw=controls.getObject().rotation.y;let dy=yaw-lastYaw;lastYaw=yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));
  const turn=Math.max(-1,Math.min(1,dy/dt/3));wing.userData.bank+=(turn-wing.userData.bank)*Math.min(1,dt*4);
  const fwd=new THREE.Vector3();camera.getWorldDirection(fwd);fwd.y=0;fwd.normalize();const right=new THREE.Vector3(-fwd.z,0,fwd.x);
  const tgt=player.position.clone().addScaledVector(right,5).addScaledVector(fwd,3+wing.userData.bank*2);tgt.y=player.position.y+2+Math.sin(time*1.3)*0.6;
  wing.position.lerp(tgt,Math.min(1,dt*2.5));wing.rotation.y=Math.atan2(fwd.x,fwd.z);wing.rotation.z=-wing.userData.bank*0.9;
  const flap=Math.sin(time*7)*0.7,extra=Math.abs(wing.userData.bank);
  wing.userData.L.rotation.z=flap;wing.userData.R.rotation.z=-flap;wing.userData.L.scale.setScalar(1+extra*0.5);wing.userData.R.scale.set(-(1+extra*0.5),1+extra*0.5,1+extra*0.5);
  wing.userData.tail.rotation.y=wing.userData.bank*0.8;
  wingFlapT+=dt;if(wingFlapT>Math.PI*2/7){wingFlapT=0;SFX.flap(Math.max(0,1-camera.getWorldPosition(new THREE.Vector3()).distanceTo(wing.position)/30)*(1+extra))}
  wingFireCd-=dt;if(wingFireCd<=0){let best=null,bd=20;for(const t of rogueDrones.concat(enemyNpcs)){if(t.userData.tut)continue;const d=t.position.distanceTo(wing.position);if(d<bd){bd=d;best=t}}if(best){wingBreath(best);wingFireCd=2.5}else wingFireCd=0.5}
}
// ---- Panda ground tank: Z chain sweep (360° melee), Bamboo Boost wafers (15s fusion glow: bigger/stronger sweep, faster, auto-sweep) ----
let sweepCd=0,boostT=0,boostFx=null,wafers=[],waferT=0;
function spawnWafer(){
  const g=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.12,16),new THREE.MeshStandardMaterial({color:0x66ff44,emissive:0x33ff66,emissiveIntensity:1.6}));
  const a=Math.random()*Math.PI*2,r=8+Math.random()*30;g.position.set(Math.cos(a)*r,1,Math.sin(a)*r);g.rotation.x=Math.PI/2;scene.add(g);wafers.push(g);
}
function chainSweep(auto){
  if(selectedChar!=='panda'){if(!auto)showToast('⛓ Chain sweep is Panda\'s move (2 to switch)');return}
  if(sweepCd>0)return;const B=boostT>0;sweepCd=B?0.6:1.2;
  const R=B?8:5,dmg=B?70:35,p=player.position;let n=0;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(R*0.8,0.08,6,40),new THREE.MeshBasicMaterial({color:B?0x66ff88:0xccccdd,transparent:true,opacity:0.9}));
  ring.rotation.x=Math.PI/2;ring.position.set(p.x,1.2,p.z);scene.add(ring);let k=0;const iv=setInterval(()=>{k++;ring.rotation.z+=0.5;ring.material.opacity=0.9-k*0.08;if(k>=11){clearInterval(iv);scene.remove(ring)}},30);
  SFX.shot();
  for(let i=enemyNpcs.length-1;i>=0;i--){const e=enemyNpcs[i];if(flatDist(e.position,p)<R){e.userData.hp-=dmg;onHit(e,dmg,p,2);n++;if(e.userData.hp<=0){killSprite(e,'death');enemyNpcs.splice(i,1);tokens+=15;checkDefendWin()}}}
  if(n){showToast(`⛓ Chain sweep! ${n} arsonist${n>1?'s':''} knocked back`);updateUI()}
}
function tickPanda(dt,time){
  if(sweepCd>0)sweepCd-=dt;
  waferT-=dt;if(gameStarted&&wafers.length<3&&waferT<=0){spawnWafer();waferT=20}
  wafers.forEach(w=>{w.rotation.z+=dt*2;w.position.y=1+Math.sin(time*3)*0.2});
  for(let i=wafers.length-1;i>=0;i--)if(!isFlying&&flatDist(wafers[i].position,player.position)<2){scene.remove(wafers[i]);wafers.splice(i,1);SFX.chime();
    if(selectedChar==='panda'){boostT=15;showPhaseBanner('🎋 BAMBOO BOOST — fusion mode 15s: bigger chain sweep, faster, auto-sweep')}else showToast('🎋 Bamboo Boost wafer — only Panda can use it (press 2)')}
  if(boostT>0){boostT-=dt;
    if(!boostFx){boostFx=new THREE.Group();for(let k=0;k<3;k++){const t=new THREE.Mesh(new THREE.TorusGeometry(1.2+k*0.35,0.05,6,32),new THREE.MeshBasicMaterial({color:[0x66ff88,0x00ffcc,0xffee66][k],transparent:true,opacity:0.8,blending:THREE.AdditiveBlending}));t.rotation.x=Math.PI/2;boostFx.add(t)}scene.add(boostFx)}
    boostFx.position.set(player.position.x,0.3,player.position.z);boostFx.children.forEach((c,k)=>{c.position.y=0.4+k*0.9+Math.sin(time*4+k)*0.3;c.rotation.z+=dt*(2+k)});
    if(playerMesh)playerMesh.material.color.setHSL(0.33,1,0.6+Math.sin(time*10)*0.15);
    if(enemyNpcs.some(e=>flatDist(e.position,player.position)<8))chainSweep(true);
  }else if(boostFx){scene.remove(boostFx);boostFx=null;if(playerMesh)playerMesh.material.color.set(0xffffff);showToast('🎋 Bamboo Boost wore off')}
}
// ---- Quadruped ground drone (FF Drone template): ground height, minigun instead of foam, J toggles follow/guard The Man ----
let quad=null,quadCool=0,quadGuard=false;
function makeQuad(){
  const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:0x111a22,emissive:0x00aaff,emissiveIntensity:0.8,metalness:0.8,roughness:0.3});
  const hull=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.4,1.6),m);hull.position.y=0.9;g.add(hull);
  const gun=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,1.1,8),new THREE.MeshBasicMaterial({color:0xffcc33}));gun.rotation.x=Math.PI/2;gun.position.set(0,1.25,0.6);g.add(gun);
  const legs=[];for(let k=0;k<4;k++){const l=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.9,0.15),m);l.position.set(k%2?0.55:-0.55,0.45,k<2?0.6:-0.6);g.add(l);legs.push(l)}
  g.userData={legs,gun};g.position.set(player.position.x+2,0,player.position.z-2);scene.add(g);return g;
}
function tickQuad(delta,time){
  if(!quad)return;quadCool-=delta;
  let best=null,bd=18;for(const t of enemyNpcs.concat(rogueDrones)){if(t.userData.tut)continue;const d=t.position.distanceTo(quad.position);if(d<bd){bd=d;best=t}}
  const home=quadGuard&&theMan?theMan.position:player.position;
  const tgt=new THREE.Vector3(home.x-2.5,0,home.z+2);
  const dx=tgt.x-quad.position.x,dz=tgt.z-quad.position.z,d=Math.hypot(dx,dz),moving=d>0.8;
  if(moving){const sp=Math.min(d,10*delta);quad.position.x+=dx/d*sp;quad.position.z+=dz/d*sp}
  quad.userData.legs.forEach((l,k)=>l.rotation.x=moving?Math.sin(time*12+(k%3?Math.PI:0))*0.5:0);
  quad.rotation.y=best?Math.atan2(best.position.x-quad.position.x,best.position.z-quad.position.z):Math.atan2(dx,dz);
  if(best&&quadCool<=0){quadCool=0.15;
    const a=quad.position.clone().add(new THREE.Vector3(0,1.25,0)),ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,best.position.clone()]),new THREE.LineBasicMaterial({color:0xffdd55}));scene.add(ln);setTimeout(()=>scene.remove(ln),50);
    best.userData.hp-=6;onHit(best,6,a,0.2);if(Math.random()<0.3)SFX.hit(false);
    if(best.userData.hp<=0){const isR=rogueDrones.includes(best);killSprite(best,isR?'explode':'death');(isR?rogueDrones:enemyNpcs).splice((isR?rogueDrones:enemyNpcs).indexOf(best),1);tokens+=isR?8:15;isR?checkDroneWave():checkDefendWin();updateUI()}}
}
FORGE.push({id:'quad-drone',label:'🐕 Quad Minigun Drone',desc:'Four-legged ground sidekick with a minigun; follows you, J = guard The Man. Cost: Weapon Shard + Circuit Board or 90 tokens',items:{'weapon-shard':1,'circuit-board':1},tokens:90,
  onForge(){if(quad){showToast('You already have a Quad Drone');return}quad=makeQuad();inventory['quad-drone']=1;showToast('🐕 Quad Minigun Drone online — it follows and shoots. J toggles guard The Man.')}});
window.__cbm2={get quad(){return quad},get boostT(){return boostT},get wafers(){return wafers},chainSweep,get wing(){return wing},smokeScreen,get rockets(){return rockets},get lockP(){return lockP},get targeting(){return targeting},toggleTargeting,toggleAutoFire,fireRocket,get tut(){return tut},startTutorial,endTutorial,get alt(){return controls.getObject().position.y},get hull(){return droneHull},damageHull:n=>damageHull(n)};
function onHit(e,dmg,from,kb=0.8){
  const ud=e.userData;
  if(!ud.baseColor)ud.baseColor=e.material.color.clone();
  ud.flash=0.12;e.material.color.setRGB(4,4,4);
  const away=e.position.clone().sub(from);away.y=0;if(away.lengthSq()>1e-6){away.normalize().multiplyScalar(kb);e.position.x+=away.x;e.position.z+=away.z}
  const kill=ud.hp<=0;
  spawnDmgNum(e.position,String(Math.round(dmg)),kill?'#ff3355':'#ffee66');
  flashHitmarker(kill);
  if(kill)hitstop=Math.max(hitstop,0.08);
  SFX.hit(kill);
}
function tickHitFlash(dt){
  const all=rogueDrones.concat(enemyNpcs,dyingSprites);
  for(const e of all){const ud=e.userData;if(ud.flash>0){ud.flash-=dt;if(ud.flash<=0)e.material.color.copy(ud.baseColor)}}
}
function shake(a){shakeAmt=Math.max(shakeAmt,a)}


// ---- Procedural audio (WebAudio, no samples): SFX + festival bass loop. M = mute ----
const SFX=(()=>{
  let ctx=null,master=null,sfxBus=null,musicBus=null,muted=localStorage.getItem('cbm_muted')==='1',hum=null,noiseBuf=null,nextBeat=0,step=0,musicOn=false;
  function init(){
    if(ctx)return ctx.state==='suspended'?ctx.resume():null;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ctx=new AC();master=ctx.createGain();master.gain.value=muted?0:0.7;master.connect(ctx.destination);
    sfxBus=ctx.createGain();sfxBus.gain.value=0.8;sfxBus.connect(master);
    musicBus=ctx.createGain();musicBus.gain.value=0.35;musicBus.connect(master);
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  }
  const ok=()=>ctx&&ctx.state==='running';
  function env(g,t,a,peak,dec){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec)}
  function tone(type,f0,f1,dur,vol,bus=sfxBus,t=ctx.currentTime){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    env(g,t,0.005,vol,dur);o.connect(g).connect(bus);o.start(t);o.stop(t+dur+0.05);
  }
  function noise(dur,vol,filt,fType='lowpass',bus=sfxBus,t=ctx.currentTime,f1){
    const s=ctx.createBufferSource();s.buffer=noiseBuf;const f=ctx.createBiquadFilter();f.type=fType;f.frequency.setValueAtTime(filt,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=ctx.createGain();env(g,t,0.005,vol,dur);s.connect(f).connect(g).connect(bus);s.start(t);s.stop(t+dur+0.05);
  }
  const api={
    init,get muted(){return muted},
    shot(){if(!ok())return;tone('sawtooth',1400,180,0.14,0.25);tone('square',700,90,0.1,0.12);noise(0.06,0.2,4000,'highpass')},
    hit(kill){if(!ok())return;tone('square',kill?520:880,kill?140:600,kill?0.18:0.05,0.12)},
    boom(){if(!ok())return;tone('sine',120,30,0.7,0.9);noise(0.9,0.7,1800,'lowpass',sfxBus,ctx.currentTime,120)},
    hiss(){if(!ok())return;noise(0.5,0.35,3000,'bandpass',sfxBus,ctx.currentTime,6000)},
    flap(v){if(!ok()||v<0.02)return;noise(0.16,0.5*v,420,'lowpass',sfxBus,ctx.currentTime,160);tone('sine',70,45,0.14,0.25*v)},
    whoosh(){if(!ok())return;noise(0.8,0.3,900,'bandpass',sfxBus,ctx.currentTime,3000)},
    chime(){if(!ok())return;const t=ctx.currentTime;[880,1320,1760].forEach((f,i)=>tone('triangle',f,f,0.25,0.15,sfxBus,t+i*0.06))},
    setHum(on){
      if(!ok())return;
      if(on&&!hum){const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();
        o.type='sawtooth';o.frequency.value=92;o2.type='sawtooth';o2.frequency.value=93.5;lfo.frequency.value=17;lg.gain.value=0.03;
        const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=600;g.gain.value=0.07;
        lfo.connect(lg).connect(g.gain);o.connect(f);o2.connect(f);f.connect(g).connect(sfxBus);[o,o2,lfo].forEach(x=>x.start());hum={o,o2,lfo,g}}
      else if(!on&&hum){const h=hum;hum=null;h.g.gain.setTargetAtTime(0,ctx.currentTime,0.1);setTimeout(()=>[h.o,h.o2,h.lfo].forEach(x=>x.stop()),400)}
    },
    // 124 BPM four-on-the-floor kick + offbeat hats + minor-key bassline (A minor: A, A, C, G)
    music(on){musicOn=on;if(on&&ok()&&!nextBeat)nextBeat=ctx.currentTime+0.1},
    tick(){
      if(!ok()||!musicOn)return;const spb=60/124/2; // 8th notes
      const bass=[55,55,0,55,65.4,0,49,55];
      while(nextBeat<ctx.currentTime+0.2){const t=nextBeat,s=step%16;
        if(s%2===0)tone('sine',150,40,0.25,0.8,musicBus,t);
        if(s%2===1)noise(0.04,0.15,7000,'highpass',musicBus,t);
        const bf=bass[(step>>1)%8];if(s%2===1&&bf){tone('sawtooth',bf*2,bf*2,0.2,0.18,musicBus,t);tone('square',bf,bf,0.2,0.12,musicBus,t)}
        if(s===14&&(step>>4)%2===1)tone('triangle',440,880,0.3,0.06,musicBus,t);
        nextBeat+=spb;step++;}
    },
    toggleMute(){muted=!muted;localStorage.setItem('cbm_muted',muted?'1':'0');if(master)master.gain.setTargetAtTime(muted?0:0.7,ctx.currentTime,0.05);return muted}
  };
  return api;
})();
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>{SFX.init();if(gameStarted)SFX.music(true)},{passive:true}));

function animateWalkCycle(spr,time,isDrone){
  const ud=spr.userData;
  if(!ud.baseScale)ud.baseScale=spr.scale.clone();
  const frame=Math.floor(time*1000/WALK_FRAME_MS+(ud.phase||0))%2;
  if(ud.frames&&ud.frames[1]){
    const tex=ud.frames[frame];if(spr.material.map!==tex){spr.material.map=tex;spr.material.needsUpdate=true}
    return;
  }
  const tilt=isDrone?0.12:0.09;
  spr.material.rotation=frame?tilt:-tilt;
  const sy=frame?1.05:0.95,sx=frame?0.97:1.03;
  spr.scale.set(ud.baseScale.x*sx,ud.baseScale.y*sy,1);
}

function animate(){
  requestAnimationFrame(animate);
  let delta=Math.min(clock.getDelta(),0.05);const time=clock.getElapsedTime();
  const rawDelta=delta;if(hitstop>0){hitstop-=delta;delta*=0.05}
  if(frostCooldown>0)frostCooldown-=delta;
  if(attackCooldown>0)attackCooldown-=delta;
  tickAmmoRegen(delta);
  tickBombs(delta);
  tickFFDrone(delta,time);tickTutorial(delta);tickRockets(delta);tickWingman(delta,time);tickPanda(delta,time);tickQuad(delta,time);
  tickDying(delta);tickCombo(delta);SFX.setHum(droneBoarded);SFX.tick();tickHitFlash(rawDelta);tickDmgNums(rawDelta);
  drawMinimap();

  if(isLocked&&!dialogueOpen&&!panelOpen){
    // Friction: firm on foot, glidey in the air so flight has momentum.
    const fr=isFlying?2.5:8;
    velocity.x-=velocity.x*fr*delta;velocity.z-=velocity.z*fr*delta;
    if(!isFlying)velocity.y-=18.5*delta;
    else{velocity.y-=velocity.y*3*delta;velocity.y+=(Number(flyUp)-Number(flyDown))*45*delta}

    direction.z=Number(moveForward)-Number(moveBackward);direction.x=Number(moveRight)-Number(moveLeft);direction.normalize();
    const speed=(isFlying?40:60)*(boostT>0&&!isFlying?1.5:1); // terminal ≈ speed/friction: ~7.5 u/s walking, ~16 u/s flying
    if(moveForward||moveBackward)velocity.z-=direction.z*speed*delta;
    if(moveLeft||moveRight)velocity.x-=direction.x*speed*delta;
    controls.moveRight(-velocity.x*delta);controls.moveForward(-velocity.z*delta);
    resolveCollisions(controls.getObject().position);

    if(isFlying){
      controls.getObject().position.y+=velocity.y*delta;
      if(controls.getObject().position.y<ALT_MIN){controls.getObject().position.y=ALT_MIN;velocity.y=Math.max(0,velocity.y)}
      if(controls.getObject().position.y>ALT_MAX){controls.getObject().position.y=ALT_MAX;velocity.y=Math.min(0,velocity.y)}
    }else{
      controls.getObject().position.y+=velocity.y*delta;
      if(controls.getObject().position.y<1.7){velocity.y=0;controls.getObject().position.y=1.7;canJump=true}
    }
    player.position.x=controls.getObject().position.x;
    player.position.z=controls.getObject().position.z;
    player.position.y=isFlying?controls.getObject().position.y-1.5:0;
    if(playerMesh)playerMesh.visible=!isLocked || isFlying;
    if(droneBoarded&&rideDrone){rideDrone.position.set(player.position.x,player.position.y+0.4,player.position.z);rideDrone.rotation.y+=0.02}
  }else if(playerMesh)playerMesh.visible=true;
  // Run pickup every frame once the game starts, not only while pointer-locked.
  if(gameStarted&&!dialogueOpen)autoPickup(time);

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
    d.position.y=(d.userData.baseY||4)+Math.sin(time*2+d.userData.phase)*1.5;
    if(!tickAnim(d,delta))animateWalkCycle(d,time,true);
    const toPlayer=player.position.clone().sub(d.position);
    if(d.userData.anim&&toPlayer.length()<25){d.userData.fireT-=delta;if(d.userData.fireT<=0){d.userData.fireT=2.5+Math.random()*3;setAnim(d,'fire',true);if(droneBoarded&&toPlayer.length()<20)damageHull(d.userData.isBoss?18:7)}}
    if(toPlayer.length()>3){
      toPlayer.normalize().multiplyScalar(d.userData.speed*60*delta);
      d.position.x+=toPlayer.x;d.position.z+=toPlayer.z;faceByMotion(d,toPlayer.x,toPlayer.z);
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
      if(!tickAnim(e,delta))animateWalkCycle(e,time,false);
      const toMan=theMan.position.clone().sub(e.position);toMan.y=0;
      if(toMan.length()>8){
        setAnim(e,'run');
        toMan.normalize().multiplyScalar(5.5*delta);
        e.position.x+=toMan.x;e.position.z+=toMan.z;faceByMotion(e,toMan.x,toMan.z);
      }else{
        if(e.userData.anim&&e.userData.anim.state==='run')setAnim(e,'walk');
        e.userData.fireTimer-=delta;
        if(e.userData.fireTimer<=0){
          e.userData.fireTimer=5+Math.random()*4;
          setAnim(e,'throw',true);
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
  updateObjectiveMarker();
  updateDangerIndicator(time);
  let _sh=null;if(shakeAmt>0.002){_sh=new THREE.Vector3((Math.random()-.5),(Math.random()-.5),(Math.random()-.5)).multiplyScalar(shakeAmt);camera.position.add(_sh);shakeAmt*=Math.pow(0.002,rawDelta)}else shakeAmt=0;
  composer.render(delta);
  if(_sh)camera.position.sub(_sh);
}

document.querySelectorAll('.char-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedChar=card.dataset.char;
    document.getElementById('start-btn').disabled=false;
  });
});
// Drone Mode: arcade start straight into rogue-drone waves on the pad drone with the rifle.
{
  const sb=document.getElementById('start-btn');
  const db=document.createElement('button');db.id='drone-mode-btn';db.textContent='🛸 DRONE MODE';
  db.style.cssText=sb.style.cssText+';margin-left:10px;margin-top:1rem;padding:14px 30px;font-size:1rem;font-weight:bold;background:linear-gradient(90deg,#0ff,#f0f);color:#000;border:none;border-radius:50px;cursor:pointer';
  sb.insertAdjacentElement('afterend',db);
  db.addEventListener('click',()=>{
    if(!selectedChar){selectedChar='dragon';document.querySelector('[data-char="dragon"]')?.classList.add('selected')}
    sb.disabled=false;sb.click();setTimeout(()=>startDroneMode(),900);
  });
}
document.getElementById('start-btn').addEventListener('click',()=>{
  if(!selectedChar)return;
  document.getElementById('title-screen').style.opacity='0';
  setTimeout(()=>{
    document.getElementById('title-screen').style.display='none';
    document.getElementById('ui').style.display='flex';
    createPlayerMesh(selectedChar);
    gameStarted=true;SFX.init();SFX.music(true);
    setTimeout(()=>showToast('🔫 Orange beam = Plasma Rifle · 🛸 cyan pad = drone (E to board) · Dragon: F to fly after Phase 2'),4000);
    showToast(`Welcome as ${selectedChar.toUpperCase()}! Collect items, build ZPEGs, unlock flight & defend The Man.`);
  },750);
});

init().catch(e=>{console.error(e);document.getElementById('loading').innerHTML='<div style="color:#f66">Failed to load. Check console.</div>'});
