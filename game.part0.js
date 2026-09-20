import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const CDN = 'https://cdn.jsdelivr.net/gh/nicsins/cyberpunk-burning-man@main/assets/';
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
let gameStarted=false,wantPointerLock=false,intentionalUnlock=false,escPressed=false,firstLockHintShown=false;
let instructionsHidden=false,instructionsHideTimer=null,touchMode=false;
let tipToastIdx=0,lookTouchId=null,lookLastX=0,lookLastY=0;
let joyActive=false,joyVec={x:0,y:0},joyTouchId=null;

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
