// Shared harness: static server (+ read-only debug hook appended at serve time, never written to disk),
// seeded RNG (same split streams as capture.mjs), and a virtual clock (performance.now / rAF / setTimeout).
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const MIME={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.wasm':'application/wasm'};
const HOOK=`\n;window.__dbg={get scene(){return scene},get camera(){return camera},get renderer(){return renderer},get controls(){return controls},get player(){return player},
get npcs(){return npcs},get collectibles(){return collectibles},get rogueDrones(){return rogueDrones},get theMan(){return theMan},get installations(){return installations},
get velocity(){return velocity},get canJump(){return canJump},get isLocked(){return isLocked},get isFlying(){return isFlying},get gamePhase(){return gamePhase},
get tokens(){return tokens},get inventory(){return inventory},get dialogueOpen(){return dialogueOpen},get panelOpen(){return panelOpen}};\n`;
export async function serve(gameDir){
  const srv=http.createServer((req,res)=>{
    let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
    const f=path.join(gameDir,p);
    if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end()}
    let body=fs.readFileSync(f);
    if(p==='/game.js') body=Buffer.concat([body,Buffer.from(HOOK)]);
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); res.end(body);
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  return srv;
}
export async function launch(w=1280,h=720){
  const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',`--window-size=${w},${h}`]});
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{
    const mk=(a)=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
    const gGame=mk(1337),gOther=mk(4242);
    Math.random=function(){const l=(new Error().stack||'').split('\n')[2]||'';return (l.includes('/game.js')?gGame:gOther)();};
    // virtual clock, off until __vt.enable()
    const rPerf=performance.now.bind(performance),rRaf=window.requestAnimationFrame.bind(window),rST=window.setTimeout.bind(window);
    let on=false,vt=0,q=[],timers=[],tid=1e6;
    performance.now=()=>on?vt:rPerf();
    window.requestAnimationFrame=cb=>{if(!on)return rRaf(cb);q.push(cb);return ++tid};
    window.setTimeout=(fn,ms=0,...a)=>{if(!on)return rST(fn,ms,...a);const id=++tid;timers.push({id,due:vt+(+ms||0),fn,a});return id};
    const rCT=window.clearTimeout.bind(window);
    window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);else rCT(id)};
    window.__vt={enable(){vt=rPerf();on=true},
      step(dtMs){vt+=dtMs;
        for(;;){timers.sort((a,b)=>a.due-b.due);if(!timers.length||timers[0].due>vt)break;const t=timers.shift();try{typeof t.fn==='function'?t.fn(...t.a):0}catch(e){console.error(e)}}
        const cbs=q;q=[];for(const cb of cbs){try{cb(vt)}catch(e){console.error('raf',e)}}
        return cbs.length},
      get t(){return vt}};
  });
  return {browser,page};
}
