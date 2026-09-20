    document.getElementById('title-screen').style.display='none';
    document.getElementById('ui').style.display='flex';
    createPlayerMesh(selectedChar);
    gameStarted=true;
    detectTouchMode();
    updatePhaseInstructions();
    scheduleInstructionsHide();
    runTipToastSequence();
    if(!touchMode){
      const hint=document.getElementById('lock-hint');
      if(hint)hint.style.display='flex';
      showResumeOverlay('Click the playa to look around');
    }
  },750);
});

function runTipToastSequence(){
  const tips=[
    '① WASD / joystick — move around the playa',
    '② Mouse / drag — look · click canvas to lock pointer',
    '③ E interact · F fly · R ability · LMB attack'
  ];
  tipToastIdx=0;
  const next=()=>{
    if(tipToastIdx>=tips.length)return;
    showToast(tips[tipToastIdx],2800);
    tipToastIdx++;
    if(tipToastIdx<tips.length)setTimeout(next,3000);
  };
  next();
}

function showToast(msg,ms=3000){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.display='block';
  clearTimeout(t._hide);
  t._hide=setTimeout(()=>t.style.display='none',ms);
}

function phaseHelpText(){
  const p=gamePhase;
  if(p==='drone')return 'DRONE: F fly · R frost · LMB attack · E interact · H help';
  if(p==='defend')return 'DEFEND: Stomp fires (E) · R suppress · LMB attack · H help';
  if(p==='burn')return 'BURN: Clear foes · approach The Man · H help';
  if(p==='complete')return 'Festival complete — explore freely · H help';
  return 'COLLECT: WASD move · E talk/loot · I inventory · H help';
}

function updatePhaseInstructions(){
  const el=document.getElementById('instructions');
  if(!el)return;
  const tip=document.getElementById('instr-tip');
  const full=document.getElementById('instr-full');
  const help=phaseHelpText();
  if(tip)tip.textContent=help;
  else el.textContent=help;
  if(full){
    full.innerHTML='<div class="instr-row"><kbd>WASD</kbd> move</div><div class="instr-row"><kbd>Mouse</kbd> look</div><div class="instr-row"><kbd>E</kbd> interact / stomp</div><div class="instr-row"><kbd>F</kbd> fly (Dragon)</div><div class="instr-row"><kbd>R</kbd> frost / suppress</div><div class="instr-row"><kbd>LMB</kbd> attack</div><div class="instr-row"><kbd>I</kbd>/<kbd>Tab</kbd> \u03a9 panel</div><div class="instr-row"><kbd>H</kbd> toggle help \u00b7 <kbd>Esc</kbd> unlock</div>';
  }
}

function toggleInstructions(forceShow){
  const el=document.getElementById('instructions');
  if(!el)return;
  if(forceShow){instructionsHidden=false;el.classList.remove('hidden');el.style.opacity='1';scheduleInstructionsHide();return}
  instructionsHidden=!instructionsHidden;
  el.classList.toggle('hidden',instructionsHidden);
  el.style.opacity=instructionsHidden?'0':'1';
  if(!instructionsHidden)scheduleInstructionsHide();
}

function scheduleInstructionsHide(){
  clearTimeout(instructionsHideTimer);
  instructionsHideTimer=setTimeout(()=>{
    const el=document.getElementById('instructions');
    if(!el)return;
    instructionsHidden=true;
    el.classList.add('hidden');
    el.style.opacity='0';
  },12000);
}

function detectTouchMode(){
  const narrow=innerWidth<=900;
  const touch=matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);
  touchMode=touch||narrow;
  const tc=document.getElementById('touch-controls');
  if(tc)tc.style.display=(touchMode&&gameStarted)?'block':'none';
  if(touchMode){
    hideResumeOverlay();
    const hint=document.getElementById('lock-hint');
    if(hint)hint.style.display='none';
  }
}

function setupTouchControls(){
  const tc=document.getElementById('touch-controls');
  if(!tc)return;
  detectTouchMode();

  const base=document.getElementById('joy-base');
  const knob=document.getElementById('joy-knob');
  if(base&&knob){
    const resetJoy=()=>{joyActive=false;joyTouchId=null;joyVec.x=0;joyVec.y=0;knob.style.transform='translate(-50%,-50%)'};
    const moveJoy=(cx,cy)=>{
      const r=base.getBoundingClientRect();
      const midX=r.left+r.width/2,midY=r.top+r.height/2;
      let dx=cx-midX,dy=cy-midY;
      const max=r.width*0.38;
      const mag=Math.hypot(dx,dy)||1;
      if(mag>max){dx=dx/mag*max;dy=dy/mag*max}
      joyVec.x=dx/max;joyVec.y=dy/max;
      knob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    base.addEventListener('touchstart',(e)=>{
      e.preventDefault();
      const t=e.changedTouches[0];
      joyTouchId=t.identifier;joyActive=true;moveJoy(t.clientX,t.clientY);
    },{passive:false});
    base.addEventListener('touchmove',(e)=>{
      e.preventDefault();
      for(const t of e.changedTouches){if(t.identifier===joyTouchId)moveJoy(t.clientX,t.clientY)}
    },{passive:false});
    base.addEventListener('touchend',(e)=>{
      for(const t of e.changedTouches){if(t.identifier===joyTouchId)resetJoy()}
    });
    base.addEventListener('touchcancel',resetJoy);
  }

  const canvas=renderer?.domElement || document.querySelector('#canvas-container canvas');
  if(canvas){
    canvas.addEventListener('touchstart',(e)=>{
      if(!gameStarted||dialogueOpen||panelOpen)return;
      for(const t of e.changedTouches){
        const el=document.elementFromPoint(t.clientX,t.clientY);
        if(el&&el.closest('#touch-controls'))continue;
        lookTouchId=t.identifier;lookLastX=t.clientX;lookLastY=t.clientY;break;
      }
    },{passive:true});
    canvas.addEventListener('touchmove',(e)=>{
      if(lookTouchId==null)return;
      for(const t of e.changedTouches){
        if(t.identifier!==lookTouchId)continue;
        const dx=t.clientX-lookLastX,dy=t.clientY-lookLastY;
        lookLastX=t.clientX;lookLastY=t.clientY;
        const obj=controls.getObject();
        obj.rotation.y-=dx*0.005;
        camera.rotation.x-=dy*0.0035;
        camera.rotation.x=Math.max(-Math.PI/2.2,Math.min(Math.PI/2.2,camera.rotation.x));
      }
    },{passive:true});
    canvas.addEventListener('touchend',(e)=>{
      for(const t of e.changedTouches){if(t.identifier===lookTouchId)lookTouchId=null}
    });
  }

  const bindTap=(id,fn)=>{
    const el=document.getElementById(id);
    if(!el)return;
    const fire=(e)=>{e.preventDefault();e.stopPropagation();fn()};
    el.addEventListener('touchstart',fire,{passive:false});
    el.addEventListener('click',fire);
  };
  bindTap('btn-act-e',()=>interact());
  bindTap('btn-act-f',()=>toggleFlight());
  bindTap('btn-act-r',()=>useSpecialAbility());
  bindTap('btn-act-atk',()=>{if(!dialogueOpen&&!panelOpen)attackNearest()});
}

document.getElementById('resume-overlay')?.addEventListener('click',(e)=>{
  e.preventDefault();
  hideResumeOverlay();
  const hint=document.getElementById('lock-hint');
  if(hint)hint.style.display='none';
  requestGameLock();
});

init().catch(e=>{console.error(e);document.getElementById('loading').innerHTML='<div style="color:#f66;text-align:center;padding:2rem">Failed to load assets.<br><span style="color:#8af;font-size:.85rem">Check connection / console.</span></div>'});
