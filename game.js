/**
 * Cyberpunk Burning Man — pointer-lock + input polish loader
 * Fetches last known-good game.js from CDN, applies critical UX patches, then imports.
 */
const BASE = 'https://cdn.jsdelivr.net/gh/nicsins/cyberpunk-burning-man@7740e36d3b2eb4dcf7d52761e5248a7f35423ef4/game.js';

// Ensure resume overlay exists even on older index.html shells
(function ensureResumeUI(){
  if(document.getElementById('resume-overlay')) return;
  if(!document.getElementById('cbm-pl-style')){
    const s=document.createElement('style');
    s.id='cbm-pl-style';
    s.textContent='body.pointer-locked,body.pointer-locked *{cursor:none!important}#resume-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:80;background:rgba(0,0,0,.45);cursor:pointer}#resume-overlay .box{background:rgba(0,15,40,.94);border:1px solid #0ff;border-radius:16px;padding:22px 28px;text-align:center;box-shadow:0 0 40px #0ff6;max-width:90vw;color:#9cf;font-family:system-ui,sans-serif}#resume-overlay h2{color:#0ff;font-size:1.2rem;margin:0 0 8px;text-shadow:0 0 14px #0ff8}';
    document.head.appendChild(s);
  }
  const ov=document.createElement('div');
  ov.id='resume-overlay';
  ov.style.display='none';
  ov.innerHTML='<div class="box"><h2 id="resume-text">Click to resume</h2><p style="margin:0;font-size:.88rem">Pointer unlocked — click to capture mouse again<br><span style="color:#668;font-size:.75rem">Esc unlocks intentionally</span></p></div>';
  document.body.appendChild(ov);
})();

let code = await (await fetch(BASE)).text();

// --- #1 POINTER LOCK ---
code = code.replace(
  'controls=new PointerLockControls(camera,document.body);',
  `controls=new PointerLockControls(camera,renderer.domElement);
  renderer.domElement.style.touchAction='none';
  renderer.domElement.style.outline='none';`
);

if (!code.includes('wantPointerLock')) {
  code = code.replace(
    'let moveForward=false,moveBackward=false,moveLeft=false,moveRight=false,canJump=false,isLocked=false,dialogueOpen=false;',
    `let moveForward=false,moveBackward=false,moveLeft=false,moveRight=false,canJump=false,isLocked=false,dialogueOpen=false;
let wantPointerLock=false,intentionalUnlock=false,escPressed=false;`
  );
}

const OLD_LOCK = "document.getElementById('canvas-container').addEventListener('click',()=>{if(!dialogueOpen&&!panelOpen)controls.lock()});\n  controls.addEventListener('lock',()=>isLocked=true);\n  controls.addEventListener('unlock',()=>isLocked=false);";

const NEW_LOCK = `
  document.addEventListener('pointerlockchange',()=>{
    const locked=!!document.pointerLockElement;
    isLocked=locked;
    if(locked){document.body.classList.add('pointer-locked');hideResumeOverlay();}
    else{document.body.classList.remove('pointer-locked');}
  });
  document.addEventListener('pointerlockerror',()=>showResumeOverlay('Click to resume — pointer lock blocked'));
  document.addEventListener('keydown',(e)=>{if(e.code==='Escape')escPressed=true},{capture:true});
  function showResumeOverlay(msg){
    const ov=document.getElementById('resume-overlay'); if(!ov)return;
    const t=document.getElementById('resume-text'); if(t)t.textContent=msg||'Click to resume';
    ov.style.display='flex';
  }
  function hideResumeOverlay(){const ov=document.getElementById('resume-overlay'); if(ov)ov.style.display='none';}
  function requestGameLock(){
    if(dialogueOpen||panelOpen)return;
    wantPointerLock=true; intentionalUnlock=false; hideResumeOverlay();
    try{controls.lock();}catch(e){showResumeOverlay('Click to resume');}
  }
  function unlockForUI(){
    intentionalUnlock=true; wantPointerLock=false;
    if(controls&&controls.isLocked)controls.unlock();
    hideResumeOverlay();
  }
  const canvasEl=renderer.domElement;
  const tryLock=()=>{
    if(dialogueOpen||panelOpen)return;
    wantPointerLock=true; intentionalUnlock=false; hideResumeOverlay();
    try{controls.lock();}catch(err){showResumeOverlay('Click to resume');}
  };
  canvasEl.addEventListener('click',(e)=>{
    if(e.target.closest&&e.target.closest('#ui,#title-screen,#resume-overlay,#touch-controls'))return;
    tryLock();
  });
  document.getElementById('canvas-container').addEventListener('click',(e)=>{
    if(e.target!==canvasEl&&e.target!==document.getElementById('canvas-container'))return;
    tryLock();
  });
  controls.addEventListener('lock',()=>{
    isLocked=true; wantPointerLock=true; intentionalUnlock=false;
    document.body.classList.add('pointer-locked'); hideResumeOverlay();
  });
  controls.addEventListener('unlock',()=>{
    isLocked=false; document.body.classList.remove('pointer-locked');
    moveForward=moveBackward=moveLeft=moveRight=false; velocity.x=0; velocity.z=0;
    const wasEsc=escPressed; const wasIntentional=intentionalUnlock;
    escPressed=false; intentionalUnlock=false;
    if(dialogueOpen||panelOpen||wasIntentional)return;
    showResumeOverlay(wasEsc?'Click to resume · Esc unlocked mouse':'Click to resume');
  });
  document.getElementById('resume-overlay')?.addEventListener('click',(e)=>{
    e.preventDefault(); hideResumeOverlay(); requestGameLock();
  });
`;

if (code.includes(OLD_LOCK)) {
  code = code.replace(OLD_LOCK, NEW_LOCK);
} else {
  console.warn('[cbm] OLD_LOCK block not found — check CDN game.js');
}

// --- #2 INPUT FEEL ---
code = code.replace(
  'velocity.x-=velocity.x*10*delta;velocity.z-=velocity.z*10*delta;',
  'const damp=14.5;velocity.x-=velocity.x*damp*delta;velocity.z-=velocity.z*damp*delta;'
);
code = code.replace(
  'const speed=isFlying?70:46;',
  'const speed=isFlying?380:280;'
);

code = code.replace(
  'function openDialogue(name,text,actions=[]){\n  dialogueOpen=true;',
  'function openDialogue(name,text,actions=[]){\n  dialogueOpen=true;try{unlockForUI()}catch(e){}'
);
code = code.replace(
  "window.closeDialogue=function(){dialogueOpen=false;",
  "window.closeDialogue=function(){dialogueOpen=false;try{if(!panelOpen)showResumeOverlay('Click to resume')}catch(e){};"
);

const blob = new Blob([code], { type: 'text/javascript' });
await import(URL.createObjectURL(blob));
