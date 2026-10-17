// lookdev.js — procedural look-dev layer for Cyberpunk Burning Man Ω (three r160).
// All detail is generated in code (canvas / shaders / instancing). No new image assets.
// Colours are locked to palette.md / v2-art-direction.md §1.3.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- palette
export const PAL = {
  deep:0x06060d, shadow:0x1a1727, midShadow:0x302d42, armorMid:0x4d4a69, fur:0x8d91ac,
  sky:0x0c1329, scaleDark:0x221d40, scaleMid:0x423e79, violetShadow:0x531f70, coolHi:0x4b7caf,
  violet:0x7050b0, cyan:0x30b0d0, ice:0x9bd9ed, frost:0x4299bc, fire:0xeb6e37, fireMid:0xce4531,
  hostile:0xd01010, gold:0xd09010, playa:0x837b76, dust:0xaba49c,
  // v2 §3 surface values (PROPOSED, pending Nic)
  scrapDark:0x1c1c2b, scrapMid:0x545371, scrapEdge:0x66789f, woodDark:0x3d2a22, woodMid:0x675447,
  glassDark:0x242949, holoDark:0x122f41, holoMid:0x405f7b,
};
// v2 §1.3 "Replaces in current code" table. Green / lime / hot pink have no role → remapped.
const REMAP = new Map([
  [0xff00ff,PAL.violet],[0xaa00ff,PAL.violet],[0xb56bff,PAL.violet],[0xff00aa,PAL.violet],[0x8800ff,PAL.violet],
  [0x00ffff,PAL.cyan],[0x2ef6ff,PAL.cyan],[0x00aaff,PAL.cyan],
  [0xff6600,PAL.fire],[0xff6b2e,PAL.fire],[0xff4400,PAL.fireMid],[0xff8800,PAL.gold],
  [0xff2200,PAL.hostile],[0xff2244,PAL.hostile],
  [0xffff00,PAL.gold],[0xffaa00,PAL.gold],[0xffd166,PAL.gold],
  [0x00ff88,PAL.ice],      // green  → ice (removed hue)
  [0x88ff00,PAL.frost],    // lime   → frost mid (removed hue)
  [0xff0088,PAL.violet],   // hot pink → violet (removed hue)
]);
export const pal = (hex)=> REMAP.has(hex) ? REMAP.get(hex) : hex;
/** HDR neon colour: palette hex × k (k>~2.5 crosses the 0.9 bloom threshold). */
export const neon = (hex,k=3)=> new THREE.Color(pal(hex)).multiplyScalar(k);

export function rng(seed){ let a=seed>>>0; return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}; }

// ---------------------------------------------------------------- tileable noise helpers
function periodicValueNoise(size, period, R){
  const lat=new Float32Array(period*period); for(let i=0;i<lat.length;i++)lat[i]=R();
  const out=new Float32Array(size*size), s=period/size;
  for(let y=0;y<size;y++){const fy=y*s,iy=Math.floor(fy),ty=fy-iy,sy=ty*ty*(3-2*ty),y0=iy%period,y1=(iy+1)%period;
    for(let x=0;x<size;x++){const fx=x*s,ix=Math.floor(fx),tx=fx-ix,sx=tx*tx*(3-2*tx),x0=ix%period,x1=(ix+1)%period;
      const a=lat[y0*period+x0],b=lat[y0*period+x1],c=lat[y1*period+x0],d=lat[y1*period+x1];
      out[y*size+x]=(a+(b-a)*sx)+((c+(d-c)*sx)-(a+(b-a)*sx))*sy;}}
  return out;
}
function fbm(size, basePeriod, octaves, R){
  const out=new Float32Array(size*size); let amp=0.5,tot=0;
  for(let o=0;o<octaves;o++){const n=periodicValueNoise(size,basePeriod<<o,R);for(let i=0;i<out.length;i++)out[i]+=n[i]*amp;tot+=amp;amp*=0.5;}
  for(let i=0;i<out.length;i++)out[i]/=tot; return out;
}
/** Periodic Voronoi: returns F2-F1 edge distance (cell units) — 0 on crack lines. */
function voronoiEdge(size, G, R){
  const px=new Float32Array(G*G),py=new Float32Array(G*G);
  for(let i=0;i<G*G;i++){px[i]=0.1+0.8*R();py[i]=0.1+0.8*R();}
  const out=new Float32Array(size*size), s=G/size;
  for(let y=0;y<size;y++){const fy=y*s,iy=Math.floor(fy);
    for(let x=0;x<size;x++){const fx=x*s,ix=Math.floor(fx);let f1=9,f2=9;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const cx=ix+dx,cy=iy+dy,k=((cy%G+G)%G)*G+((cx%G+G)%G);
        const ddx=cx+px[k]-fx,ddy=cy+py[k]-fy,d=Math.sqrt(ddx*ddx+ddy*ddy);
        if(d<f1){f2=f1;f1=d}else if(d<f2)f2=d;}
      out[y*size+x]=f2-f1;}}
  return out;
}
const sstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
function canvasOf(size){const c=document.createElement('canvas');c.width=c.height=size;return c}

// ---------------------------------------------------------------- playa ground
/** Tileable cracked-playa detail: normal map + ORM (R=AO, G=roughness). ~12 m per tile. */
export function makePlayaDetail(size=1024, seed=7){
  const R=rng(seed);
  const grain=fbm(size,8,6,R), wide=voronoiEdge(size,16,R), fine=voronoiEdge(size,44,R), wob=fbm(size,4,3,R), mask=fbm(size,6,3,R);
  const h=new Float32Array(size*size), crack=new Float32Array(size*size);
  for(let i=0;i<h.length;i++){
    const w=0.012+0.022*wob[i];
    const c1=(1-sstep(0,w,wide[i]))*sstep(0.35,0.55,mask[i]+0.15), c2=(1-sstep(0,w*0.6,fine[i]))*0.45*sstep(0.45,0.7,mask[i]); // broken, irregular crack network
    const c=Math.max(c1,c2); crack[i]=c;
    const curl=0.08*sstep(0.02,0.25,wide[i]);            // plates curl up slightly at their edges
    h[i]=0.45*grain[i]+curl-0.6*c;
  }
  const nC=canvasOf(size),oC=canvasOf(size),nx=nC.getContext('2d'),ox=oC.getContext('2d');
  const nI=nx.createImageData(size,size),oI=ox.createImageData(size,size),S=2.6;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,l=h[y*size+((x-1+size)%size)],r=h[y*size+((x+1)%size)],u=h[((y-1+size)%size)*size+x],d=h[((y+1)%size)*size+x];
    let vx=(l-r)*S,vy=(d-u)*S,vz=1;const inv=1/Math.hypot(vx,vy,vz);
    nI.data[i*4]=(vx*inv*0.5+0.5)*255;nI.data[i*4+1]=(vy*inv*0.5+0.5)*255;nI.data[i*4+2]=(vz*inv*0.5+0.5)*255;nI.data[i*4+3]=255;
    oI.data[i*4]=(1-0.5*crack[i])*255;                                 // AO
    oI.data[i*4+1]=Math.min(1,0.74+0.2*crack[i]+0.12*(grain[i]-0.5))*255; // roughness
    oI.data[i*4+2]=0;oI.data[i*4+3]=255;
  }
  nx.putImageData(nI,0,0);ox.putImageData(oI,0,0);
  const mk=(c)=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.colorSpace=THREE.NoColorSpace;return t};
  return {normal:mk(nC),orm:mk(oC)};
}

/** Ground: original ground.jpg albedo (bigger tile) × macro vertex-colour dust variation + procedural crack normal/ORM. */
export function makeGround(albedo, size=420){
  const geo=new THREE.PlaneGeometry(size,size,140,140); geo.rotateX(-Math.PI/2);
  const R=rng(42), N=64, lat=new Float32Array(N*N).map(()=>R());
  const vn=(x,z)=>{x=(x/size+0.5)*N*0.999;z=(z/size+0.5)*N*0.999;const ix=Math.floor(x),iz=Math.floor(z),tx=x-ix,tz=z-iz,
    g=(a,b)=>lat[(((b%N)+N)%N)*N+(((a%N)+N)%N)],sx=tx*tx*(3-2*tx),sz=tz*tz*(3-2*tz);
    return (g(ix,iz)*(1-sx)+g(ix+1,iz)*sx)*(1-sz)+(g(ix,iz+1)*(1-sx)+g(ix+1,iz+1)*sx)*sz;};
  const pos=geo.attributes.position,col=new Float32Array(pos.count*3);
  const lite=new THREE.Color(PAL.dust),dark=new THREE.Color(PAL.armorMid),base=new THREE.Color(PAL.playa),c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    const n=vn(x,z)*0.6+vn(x*2.7+31,z*2.7-17)*0.4;
    c.copy(base).lerp(n>0.5?lite:dark,Math.abs(n-0.5)*1.6);
    const r=Math.hypot(x,z); if(r>11&&r<19)c.multiplyScalar(0.72+0.28*sstep(11,19,Math.abs(r-15)*2+11)); // scorch ring round the plinth
    // vertex colour is a ±tint relative to the playa base, so ground.jpg detail stays dominant
    col[i*3]=Math.min(1.3,c.r/base.r*0.9);col[i*3+1]=Math.min(1.3,c.g/base.g*0.9);col[i*3+2]=Math.min(1.3,c.b/base.b*0.9);
  }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const det=makePlayaDetail();
  albedo.wrapS=albedo.wrapT=THREE.RepeatWrapping; albedo.repeat.set(10,10); albedo.anisotropy=8;
  det.normal.repeat.set(35,35); det.orm.repeat.set(35,35);
  const mat=new THREE.MeshStandardMaterial({map:albedo,vertexColors:true,color:0xffffff,normalMap:det.normal,normalScale:new THREE.Vector2(0.8,0.8),
    roughnessMap:det.orm,roughness:1,aoMap:det.orm,aoMapIntensity:0.9,metalness:0.0,envMapIntensity:0.35});
  const mesh=new THREE.Mesh(geo,mat); mesh.receiveShadow=true; return mesh;
}

/** Tire tracks: merged ribbon decals (art-car circles round The Man + wandering bike lines). */
export function makeTireTracks(seed=11){
  const R=rng(seed);
  const tc=canvasOf(128),g=tc.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,128,128);
  // tread: chevrons across width (u) repeating along length (v)
  for(let y=0;y<128;y+=16){g.strokeStyle='#fff';g.lineWidth=7;g.beginPath();g.moveTo(10,y+12);g.lineTo(64,y+2);g.lineTo(118,y+12);g.stroke();}
  const edge=g.createLinearGradient(0,0,128,0);edge.addColorStop(0,'rgba(0,0,0,1)');edge.addColorStop(0.12,'rgba(0,0,0,0)');edge.addColorStop(0.88,'rgba(0,0,0,0)');edge.addColorStop(1,'rgba(0,0,0,1)');
  g.globalCompositeOperation='multiply';g.fillStyle='#bbb';g.fillRect(0,0,128,128);g.globalCompositeOperation='source-over';g.fillStyle=edge;g.fillRect(0,0,128,128);
  const tread=new THREE.CanvasTexture(tc);tread.wrapS=tread.wrapT=THREE.RepeatWrapping;tread.colorSpace=THREE.NoColorSpace;tread.anisotropy=8;
  const geos=[];
  const strip=(pts,w,offset)=>{ // pts: Vector2[] path; builds a ribbon offset sideways
    const P=[],U=[],I=[];let len=0;
    for(let i=0;i<pts.length;i++){
      const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],t=new THREE.Vector2().subVectors(b,a).normalize(),n=new THREE.Vector2(-t.y,t.x);
      if(i>0)len+=pts[i].distanceTo(pts[i-1]);
      const c=pts[i].clone().addScaledVector(n,offset);
      P.push(c.x+n.x*w/2,0.012,c.y+n.y*w/2, c.x-n.x*w/2,0.012,c.y-n.y*w/2);U.push(0,len/0.5,1,len/0.5);
      if(i>0){const k=(i-1)*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));gg.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
    gg.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(P.length).fill(0).map((_,j)=>j%3===1?1:0),3));gg.setIndex(I);geos.push(gg);
  };
  // concentric art-car loops (cars orbit at r 48–98)
  for(let k=0;k<7;k++){const r=48+R()*50,a0=R()*6.28,span=1.2+R()*3.5,pts=[];
    for(let s=0;s<=160;s++){const a=a0+span*s/160,rr=r+Math.sin(a*3+k)*1.2;pts.push(new THREE.Vector2(Math.cos(a)*rr,Math.sin(a)*rr));}
    strip(pts,0.42,-1.1);strip(pts,0.42,1.1);}
  // wandering bike tracks
  for(let k=0;k<14;k++){let p=new THREE.Vector2((R()-0.5)*160,(R()-0.5)*160),h=R()*6.28;const pts=[];
    for(let s=0;s<90;s++){h+=(R()-0.5)*0.25;p=p.clone().add(new THREE.Vector2(Math.cos(h),Math.sin(h)).multiplyScalar(0.8));pts.push(p);}
    strip(pts,0.12,0);}
  const geo=mergeGeometries(geos);
  const mat=new THREE.MeshStandardMaterial({color:PAL.armorMid,roughness:1,metalness:0,transparent:true,opacity:0.5,alphaMap:tread,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const m=new THREE.Mesh(geo,mat);m.receiveShadow=true;m.renderOrder=-2;return m;
}

// ---------------------------------------------------------------- shared surface textures
let _surf=null;
/** Grime albedo (multiplied with material colour), roughness variation, emissive seam/trim masks. */
export function surfaces(){
  if(_surf)return _surf;
  const S=256,R=rng(5),n=fbm(S,4,5,R),streak=fbm(S,16,2,R);
  const gC=canvasOf(S),gx=gC.getContext('2d'),gI=gx.createImageData(S,S);
  const rC=canvasOf(S),rx=rC.getContext('2d'),rI=rx.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=y*S+x;
    const dust=sstep(0.62,1.0,y/S)*0.35;                  // canvas bottom = lower part of faces: dust on lower ~30%
    const v=Math.min(1,0.62+0.38*n[i]-0.12*streak[(y*S+x)%(S*S)]);
    gI.data[i*4]=(v+dust*0.9)*255;gI.data[i*4+1]=(v+dust*0.85)*255;gI.data[i*4+2]=(v+dust*0.8)*255;gI.data[i*4+3]=255;
    const r=0.45+0.4*n[i]+dust*0.4;rI.data[i*4]=255;rI.data[i*4+1]=Math.min(1,r)*255;rI.data[i*4+2]=0;rI.data[i*4+3]=255;}
  gx.putImageData(gI,0,0);rx.putImageData(rI,0,0);
  // seam mask: thin bright lines near the top and along vertical edges
  const sC=canvasOf(S),sx=sC.getContext('2d');sx.fillStyle='#000';sx.fillRect(0,0,S,S);sx.fillStyle='#fff';
  sx.fillRect(0,S*0.08,S,3);sx.fillRect(0,S*0.42,S,2);sx.fillRect(2,0,2,S);sx.fillRect(S-4,0,2,S);
  const tex=(c,srgb)=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;return t};
  _surf={grime:tex(gC,true),rough:tex(rC,false),seam:tex(sC,true)};
  return _surf;
}
/** Stylized PBR: matte dusty body + optional emissive seams (v2 §1.1 two-tier rule). */
export function pbr(color,{rough=0.75,metal=0.3,seam=null,seamK=3,env=0.6,repeat=1,...rest}={}){
  const s=surfaces();
  const m=new THREE.MeshStandardMaterial({color:pal(color),map:s.grime,roughnessMap:s.rough,roughness:rough/0.65,metalness:metal,envMapIntensity:env,...rest});
  if(seam!=null){m.emissiveMap=s.seam;m.emissive=neon(seam,1);m.emissiveIntensity=seamK;}
  return m;
}

// ---------------------------------------------------------------- environment / sky / stars
const SKY_VS=`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_Position.z=gl_Position.w;}`;
const SKY_FS=`uniform vec3 uZen,uHor,uGlow,uAurA,uAurB;uniform float uTime,uAur;varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec3 d=normalize(vDir);float h=d.y;float az=atan(d.z,d.x);
 vec3 c=mix(uHor,uZen,smoothstep(0.0,0.55,h));
 c+=uGlow*exp(-max(h,0.)*11.)*0.35*step(-0.02,h);                       // horizon haze band
 float bx=(h-0.32-0.07*sin(az*2.+uTime*0.03))*7.;float band=exp(-bx*bx);       // aurora ribbon
 float curt=smoothstep(0.35,1.,vnoise(vec2(az*6.+uTime*0.05,h*2.))*vnoise(vec2(az*15.+3.,uTime*0.08))*1.6);
 c+=mix(uAurA,uAurB,0.5+0.5*sin(az*1.5+uTime*0.02))*band*curt*uAur;
 float mx=dot(d,normalize(vec3(0.4,0.6,-0.7)))*5.;float mw=exp(-mx*mx)*vnoise(d.xz*18.+d.y*7.);  // faint milky-way dust
 c+=uHor*mw*0.6;
 if(h<0.)c=uHor+uGlow*0.35;
 gl_FragColor=vec4(c,1.);}`;

/** Fog colour = sky horizon incl. haze band, so the playa melts into the sky without a seam. */
export const HAZE=new THREE.Color(PAL.sky).add(new THREE.Color(PAL.scaleMid).multiplyScalar(0.35));
export function makeSky(){
  const u={uZen:{value:new THREE.Color(PAL.deep)},uHor:{value:new THREE.Color(PAL.sky)},uGlow:{value:new THREE.Color(PAL.scaleMid)},
    uAurA:{value:new THREE.Color(PAL.violet)},uAurB:{value:new THREE.Color(PAL.frost)},uTime:{value:0},uAur:{value:0.16}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(800,48,24),new THREE.ShaderMaterial({uniforms:u,vertexShader:SKY_VS,fragmentShader:SKY_FS,side:THREE.BackSide,depthWrite:false,fog:false}));
  sky.renderOrder=-10;sky.frustumCulled=false;
  // stars: round, sized, twinkling points on a camera-centred shell
  const R=rng(99),N=3200,P=new Float32Array(N*3),C=new Float32Array(N*3),Z=new Float32Array(N),T=new Float32Array(N);
  const cols=[PAL.ice,PAL.fur,0xffffff,PAL.violet,PAL.gold].map(h=>new THREE.Color(h));
  for(let i=0;i<N;i++){const th=R()*6.283,y=Math.pow(R(),0.8)*0.98+0.02,r=Math.sqrt(1-y*y);
    P.set([Math.cos(th)*r*700,y*700,Math.sin(th)*r*700],i*3);
    const c=cols[R()<0.55?0:R()<0.6?1:R()<0.7?2:R()<0.7?3:4],big=R()<0.03;C.set([c.r,c.g,c.b],i*3);
    Z[i]=big?3.2+R()*1.5:0.9+R()*1.4;T[i]=R()*6.28;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
  g.setAttribute('size',new THREE.BufferAttribute(Z,1));g.setAttribute('tw',new THREE.BufferAttribute(T,1));
  const su={uTime:{value:0}};
  const stars=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:su,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float size,tw;attribute vec3 color;uniform float uTime;varying vec3 vC;varying float vA;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_Position.z=gl_Position.w*0.9999;
      float t=0.75+0.25*sin(uTime*(1.3+fract(tw)*2.)+tw*10.);vA=t*smoothstep(0.0,0.12,position.y/700.);vC=color*(size>3.?2.2:1.0);gl_PointSize=size;}`,
    fragmentShader:`varying vec3 vC;varying float vA;void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float a=1.-smoothstep(0.,.5,d);gl_FragColor=vec4(vC*a*vA,a*vA);}`}));
  stars.frustumCulled=false;stars.renderOrder=-9;
  const grp=new THREE.Group();grp.add(sky,stars);
  grp.userData.update=(t,cam)=>{u.uTime.value=t;su.uTime.value=t;grp.position.copy(cam.position);};
  return grp;
}

/** Dark night-playa PMREM with neon streaks for reflections (v2 §1.3). */
export function makeEnv(renderer){
  const es=new THREE.Scene();
  const sky=makeSky().children[0];sky.material=sky.material.clone();sky.material.uniforms.uAur.value=0.0;es.add(sky);
  const strip=(col,k,x,y,z,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:neon(col,k),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,y,0);es.add(m)};
  strip(PAL.cyan,4,40,4,0,30,1.2);strip(PAL.violet,4,-35,6,20,26,1.4);strip(PAL.gold,3,-10,3,-40,18,0.8);strip(PAL.cyan,2,15,10,38,10,0.6);
  const fl=new THREE.Mesh(new THREE.CircleGeometry(200,24),new THREE.MeshBasicMaterial({color:new THREE.Color(PAL.playa).multiplyScalar(0.08)}));fl.rotation.x=-Math.PI/2;fl.position.y=-2;es.add(fl);
  const pm=new THREE.PMREMGenerator(renderer);const rt=pm.fromScene(es,0.03);pm.dispose();return rt.texture;
}

// ---------------------------------------------------------------- dust + haze particles (GPU-animated, no CPU loop)
export function makeDust(){
  const mk=(N,box,hMax,size,alpha,col,wind,seed)=>{
    const R=rng(seed),P=new Float32Array(N*3),S=new Float32Array(N);
    for(let i=0;i<N;i++){P.set([(R()-0.5)*box,Math.pow(R(),2.2)*hMax,(R()-0.5)*box],i*3);S[i]=0.6+R()*0.8;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('sz',new THREE.BufferAttribute(S,1));
    const u={uTime:{value:0},uCam:{value:new THREE.Vector3()},uBox:{value:box},uWind:{value:wind},uSize:{value:size},uAlpha:{value:alpha},uCol:{value:new THREE.Color(col)},uFog:{value:new THREE.Color(PAL.sky)}};
    const pts=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,
      vertexShader:`attribute float sz;uniform float uTime,uBox,uSize;uniform vec3 uCam,uWind;varying float vA;
        void main(){vec3 p=position+uWind*uTime;p.y+=sin(uTime*0.4+position.x)*0.4;
          p.xz=mod(p.xz-uCam.xz+uBox*.5,uBox)-uBox*.5+uCam.xz;
          vec4 mv=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;float d=-mv.z;
          vA=smoothstep(1.5,5.,d)*(1.-smoothstep(uBox*.3,uBox*.5,d));gl_PointSize=clamp(uSize*sz*300./d,1.,64.);}`,
      fragmentShader:`uniform vec3 uCol;uniform float uAlpha;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(0.,.5,d);gl_FragColor=vec4(uCol,a*vA*uAlpha);}`}));
    pts.frustumCulled=false;pts.userData.u=u;return pts;
  };
  const dust=mk(2600,120,16,0.05,0.55,PAL.dust,new THREE.Vector3(1.1,0,0.35),3);
  const haze=mk(260,160,4,1.6,0.05,PAL.scaleMid,new THREE.Vector3(0.5,0,0.2),4);
  const grp=new THREE.Group();grp.add(haze,dust);
  grp.userData.update=(t,cam)=>{for(const p of [dust,haze]){p.userData.u.uTime.value=t;p.userData.u.uCam.value.copy(cam.position);}};
  return grp;
}

// ---------------------------------------------------------------- fake light: ground glow pools & pickup rings (1 draw each)
const GLOW_VS=`varying vec2 vUv;varying vec3 vC;varying float vFog;
 void main(){vUv=uv;vC=vec3(1.);
 #ifdef USE_INSTANCING_COLOR
 vC=instanceColor;
 #endif
 vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vFog=-mv.z;gl_Position=projectionMatrix*mv;}`;
const GLOW_FS=`uniform float uFog;varying vec2 vUv;varying vec3 vC;varying float vFog;
 void main(){float r=length(vUv-.5)*2.;
 #ifdef RING
 float a=(1.-smoothstep(0.,.12,abs(r-.8)))+0.25*pow(max(1.-r,0.),2.);
 #else
 float a=pow(max(1.-r,0.),2.2);
 #endif
 float fd=uFog*max(vFog,0.);float f=exp(-fd*fd);gl_FragColor=vec4(vC*a*f,1.);}`;
export class GlowLayer{
  constructor(max,{ring=false,y=0.03}={}){
    const g=new THREE.PlaneGeometry(1,1);g.rotateX(-Math.PI/2);
    this.mesh=new THREE.InstancedMesh(g,new THREE.ShaderMaterial({uniforms:{uFog:{value:0.006}},vertexShader:GLOW_VS,fragmentShader:GLOW_FS,
      defines:ring?{RING:''}:{},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.renderOrder=-1;
    this.mesh.setColorAt(0,new THREE.Color());this.mesh.count=0;this.y=y;this._m=new THREE.Matrix4();this._c=new THREE.Color();this.n=0;
  }
  /** colour is HDR-ish: keep k<0.9 for "light on the ground" so it does not bloom. */
  add(x,z,radius,hex,k=0.5){this.set(this.n++,x,z,radius,hex,k);return this.n-1}
  set(i,x,z,radius,hex,k=0.5){this._m.makeScale(radius*2,1,radius*2).setPosition(x,this.y,z);this.mesh.setMatrixAt(i,this._m);
    this._c.set(pal(hex)).multiplyScalar(k);this.mesh.setColorAt(i,this._c);}
  commit(n=this.n){this.mesh.count=n;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;}
}

/** Soft halo + light shaft around The Man (additive, emissive only). */
export function makeManGlow(){
  const grp=new THREE.Group();
  const shaftMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uA:{value:new THREE.Color(PAL.cyan).multiplyScalar(0.55)},uB:{value:new THREE.Color(PAL.violet).multiplyScalar(0.5)}},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;varying vec3 vN,vV;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform float uTime;uniform vec3 uA,uB;varying vec2 vUv;varying vec3 vN,vV;
      float h(float x){return fract(sin(x*91.7)*4375.5);}
      void main(){float face=pow(abs(dot(normalize(vN),normalize(vV))),2.5);float up=pow(1.-vUv.y,1.6)*smoothstep(0.,.04,vUv.y);
      float s=floor(vUv.x*48.);float streak=0.55+0.45*sin(vUv.y*14.-uTime*0.8+h(s)*6.28)*h(s+1.);
      vec3 c=mix(uA,uB,vUv.y)*face*up*streak;gl_FragColor=vec4(c,1.);}`});
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(3.5,9.5,46,40,1,true),shaftMat);shaft.position.y=23.8;grp.add(shaft);
  // halo sprite behind the effigy
  const hc=canvasOf(256),g=hc.getContext('2d'),rg=g.createRadialGradient(128,128,0,128,128,128);
  rg.addColorStop(0,'rgba(255,255,255,0.9)');rg.addColorStop(0.25,'rgba(255,255,255,0.35)');rg.addColorStop(0.6,'rgba(255,255,255,0.08)');rg.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=rg;g.fillRect(0,0,256,256);const ht=new THREE.CanvasTexture(hc);ht.colorSpace=THREE.SRGBColorSpace;
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:ht,color:new THREE.Color(PAL.cyan).multiplyScalar(0.5),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  halo.scale.set(34,40,1);halo.position.y=15;halo.renderOrder=-1;grp.add(halo);
  const halo2=new THREE.Sprite(new THREE.SpriteMaterial({map:ht,color:new THREE.Color(PAL.violet).multiplyScalar(0.35),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  halo2.scale.set(70,60,1);halo2.position.y=14;halo2.renderOrder=-1;grp.add(halo2);
  grp.userData.update=(t)=>{shaftMat.uniforms.uTime.value=t;};
  return grp;
}

// ---------------------------------------------------------------- set dressing (instanced primitives)
function crateTextures(){
  const S=256,R=rng(21);
  const a=canvasOf(S),g=a.getContext('2d');
  g.fillStyle='#1c1c2b';g.fillRect(0,0,S,S);
  for(const [x,y,w,h] of [[6,6,120,120],[130,6,120,120],[6,130,120,120],[130,130,120,120]]){
    const gr=g.createLinearGradient(x,y,x+w,y+h);gr.addColorStop(0,'#545371');gr.addColorStop(1,'#2b2a40');g.fillStyle=gr;g.fillRect(x,y,w,h);
    g.strokeStyle='#66789f';g.lineWidth=2;g.strokeRect(x+1,y+1,w-2,h-2);                          // edge wear
    g.fillStyle='#8d91ac';for(const [rx,ry] of [[x+8,y+8],[x+w-8,y+8],[x+8,y+h-8],[x+w-8,y+h-8]]){g.beginPath();g.arc(rx,ry,2.5,0,7);g.fill();}
  }
  for(let i=0;i<26;i++){g.fillStyle=`rgba(206,69,49,${0.25+R()*0.4})`;g.beginPath();g.ellipse(R()*S,R()*S,1+R()*5,1+R()*3,R()*3,0,7);g.fill();} // rust chips
  const dg=g.createLinearGradient(0,S*0.68,0,S);dg.addColorStop(0,'rgba(131,123,118,0)');dg.addColorStop(1,'rgba(171,164,156,0.75)');g.fillStyle=dg;g.fillRect(0,S*0.68,S,S*0.32); // playa dust lower 30%
  const e=canvasOf(S),eg=e.getContext('2d');eg.fillStyle='#000';eg.fillRect(0,0,S,S);eg.fillStyle='#fff';eg.fillRect(0,S*0.47,S,4);
  const t=(c,s)=>{const x=new THREE.CanvasTexture(c);x.colorSpace=s?THREE.SRGBColorSpace:THREE.NoColorSpace;x.anisotropy=4;return x};
  return {map:t(a,true),emi:t(e,true)};
}
export function makeSetDressing(avoid=[]){
  const R=rng(77),grp=new THREE.Group(),glow=[],lightSites=[];
  const ok=(x,z,r=3)=>avoid.every(([ax,az,ar])=>Math.hypot(x-ax,z-az)>ar+r);
  // --- lamp posts ring the Esplanade (r=30) + a short avenue toward the Temple
  const posts=[];
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2+0.1,x=Math.cos(a)*30,z=Math.sin(a)*30;if(ok(x,z,2))posts.push([x,z,a]);}
  for(let i=0;i<5;i++){const t=0.25+i*0.15,x=-62*t,z=-36*t+4;posts.push([x,z,Math.atan2(z,x)]);}
  const poleG=mergeGeometries([new THREE.CylinderGeometry(0.09,0.14,5.2,6).translate(0,2.6,0),new THREE.BoxGeometry(1.1,0.08,0.08).translate(0.45,5.0,0),new THREE.CylinderGeometry(0.35,0.42,0.18,8).translate(0,0.09,0)]);
  const poles=new THREE.InstancedMesh(poleG,pbr(PAL.scrapMid,{rough:0.55,metal:0.75,env:1.2}),posts.length);
  const heads=new THREE.InstancedMesh(new THREE.BoxGeometry(0.34,0.16,0.34),new THREE.MeshBasicMaterial({color:new THREE.Color(1,1,1).multiplyScalar(2.6)}),posts.length);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),cols=[PAL.cyan,PAL.violet,PAL.gold];
  posts.forEach(([x,z,a],i)=>{q.setFromAxisAngle(up,-a);m.compose(new THREE.Vector3(x,0,z),q,new THREE.Vector3(1,1,1));poles.setMatrixAt(i,m);
    const hx=x+Math.cos(a)*0.9,hz=z+Math.sin(a)*0.9;m.makeTranslation(hx,4.9,hz);heads.setMatrixAt(i,m);const c=cols[i%3];heads.setColorAt(i,new THREE.Color(c));
    glow.push([hx,hz,4.5,c,0.32]);lightSites.push(new THREE.Vector3(hx,4.6,hz));});
  poles.castShadow=true;grp.add(poles,heads);
  // --- catenary cables + string-light bulbs between neighbouring ring posts
  const cables=[],bulbs=[];
  const ring=posts.slice(0,posts.length-5);
  for(let i=0;i<ring.length;i++){const A=ring[i],B=ring[(i+1)%ring.length];if(Math.hypot(A[0]-B[0],A[1]-B[1])>18)continue;
    const p0=new THREE.Vector3(A[0],5.15,A[1]),p1=new THREE.Vector3(B[0],5.15,B[1]),pts=[];
    for(let s=0;s<=16;s++){const t=s/16,p=p0.clone().lerp(p1,t);p.y-=Math.sin(t*Math.PI)*1.1;pts.push(p);}
    cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,0.025,3,false));
    for(let s=1;s<8;s++)bulbs.push(pts[s*2]);}
  // avenue cables
  for(let i=ring.length;i<posts.length-1;i++){const A=posts[i],B=posts[i+1],p0=new THREE.Vector3(A[0],5.15,A[1]),p1=new THREE.Vector3(B[0],5.15,B[1]),pts=[];
    for(let s=0;s<=16;s++){const t=s/16,p=p0.clone().lerp(p1,t);p.y-=Math.sin(t*Math.PI)*0.9;pts.push(p);}
    cables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,0.025,3,false));for(let s=1;s<8;s++)bulbs.push(pts[s*2]);}
  if(cables.length)grp.add(new THREE.Mesh(mergeGeometries(cables),new THREE.MeshStandardMaterial({color:PAL.deep,roughness:0.6,metalness:0.2})));
  const bulbM=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07,0),new THREE.MeshBasicMaterial({color:new THREE.Color(1,1,1).multiplyScalar(3.5)}),bulbs.length);
  bulbs.forEach((p,i)=>{m.makeTranslation(p.x,p.y-0.08,p.z);bulbM.setMatrixAt(i,m);bulbM.setColorAt(i,new THREE.Color(i%4===0?PAL.ice:PAL.gold));});
  grp.add(bulbM);
  // --- scattered scrap-metal crates (clusters near camps/stations), some stacked
  const ct=crateTextures(),crates=[];
  const clusters=[[20,16],[-20,26],[34,-28],[-38,-14],[-55,-28],[52,30],[8,-46],[-6,52]];
  for(const [cx,cz] of clusters){const n=3+Math.floor(R()*4);for(let k=0;k<n;k++){const s=0.8+R()*0.6,x=cx+(R()-0.5)*6,z=cz+(R()-0.5)*6;if(!ok(x,z,1))continue;
    crates.push([x,s/2,z,R()*Math.PI,s]);if(R()<0.35)crates.push([x+(R()-0.5)*0.2,s+s*0.4,z,R()*Math.PI,s*0.8]);}}
  const crateMat=new THREE.MeshStandardMaterial({map:ct.map,roughnessMap:surfaces().rough,roughness:1.25,metalness:0.55,emissiveMap:ct.emi,emissive:neon(PAL.cyan,1),emissiveIntensity:2.8,envMapIntensity:0.7});
  const crateM=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),crateMat,crates.length);
  crates.forEach(([x,y,z,r,s],i)=>{q.setFromAxisAngle(up,r);m.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(s,s,s));crateM.setMatrixAt(i,m);});
  crateM.castShadow=crateM.receiveShadow=true;grp.add(crateM);
  return {group:grp,glow,lightSites,crates};   // crates: [x,y,z,rotY,size] (physics colliders)
}

// ---------------------------------------------------------------- pooled real lights (v2: ≤8 live)
export class LightPool{
  constructor(scene,n=2,{intensity=28,distance=26}={}){this.lights=[];for(let i=0;i<n;i++){const l=new THREE.PointLight(0xffffff,intensity,distance,2);scene.add(l);this.lights.push(l);}this._t=0;}
  /** candidates: [{pos:Vector3,color:hex}] — the nearest n to the camera get the real lights. */
  update(dt,cam,candidates){this._t-=dt;if(this._t>0)return;this._t=0.25;
    const sorted=candidates.map(c=>({c,d:c.pos.distanceToSquared(cam.position)})).sort((a,b)=>a.d-b.d);
    this.lights.forEach((l,i)=>{const s=sorted[i];if(!s){l.visible=false;return}l.visible=true;l.position.copy(s.c.pos);l.position.y=Math.max(l.position.y,1.6);l.color.set(pal(s.c.color));});}
}

// ---------------------------------------------------------------- post: bloom + ACES (OutputPass) + palette grade
const GRADE={uniforms:{tDiffuse:{value:null},uTime:{value:0},uPal:{value:[]},uSnap:{value:0.16},uLift:{value:new THREE.Vector3()},uVig:{value:0.32},uGrain:{value:0.022},uRes:{value:new THREE.Vector2(1280,720)}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uSnap,uVig,uGrain;uniform vec3 uPal[20];uniform vec3 uLift;uniform vec2 uRes;varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;const vec3 W=vec3(.2126,.7152,.0722);float l=dot(c,W);
   c+=uLift*(1.-smoothstep(0.,.3,l));                                   // blacks sit on night-sky navy, not pure black
   vec3 best=uPal[0];float bd=1e9;for(int i=0;i<20;i++){vec3 d=c-uPal[i];float dd=dot(d,d);if(dd<bd){bd=dd;best=uPal[i];}}
   vec3 snap=best*(l/max(dot(best,W),1e-3));c=mix(c,snap,uSnap*smoothstep(.02,.12,l)); // pull chroma toward nearest palette swatch, keep luminance
   vec2 q=vUv-.5;q.x*=uRes.x/uRes.y;c*=mix(1.,(1.-smoothstep(.25,1.05,length(q))),uVig);
   c+=(hash(vUv*uRes+fract(uTime)*91.)-.5)*uGrain;
   gl_FragColor=vec4(c,1.);}`};
export function makeComposer(renderer,scene,camera){
  const comp=new EffectComposer(renderer);
  comp.addPass(new RenderPass(scene,camera));
  const sz=renderer.getSize(new THREE.Vector2());
  const bloom=new UnrealBloomPass(new THREE.Vector2(sz.x,sz.y),0.85,0.55,0.9); // threshold 0.9: only emissive >~1 blooms
  comp.addPass(bloom);
  comp.addPass(new OutputPass());                                                // ACES + sRGB
  const grade=new ShaderPass(GRADE);
  const swatches=[PAL.deep,PAL.shadow,PAL.midShadow,PAL.armorMid,PAL.fur,PAL.sky,PAL.scaleDark,PAL.scaleMid,PAL.violetShadow,PAL.coolHi,
    PAL.violet,PAL.cyan,PAL.ice,PAL.frost,PAL.fire,PAL.fireMid,PAL.hostile,PAL.gold,PAL.playa,PAL.dust];
  grade.uniforms.uPal.value=swatches.map(h=>new THREE.Vector3(((h>>16)&255)/255,((h>>8)&255)/255,(h&255)/255)); // display-space swatches
  grade.uniforms.uLift.value.set(0x0c/255,0x13/255,0x29/255).multiplyScalar(0.55);
  grade.uniforms.uRes.value.copy(sz);
  comp.addPass(grade);
  comp.userData={bloom,grade};
  comp.update=(t)=>{grade.uniforms.uTime.value=t;};
  comp.resize=(w,h)=>{comp.setSize(w,h);grade.uniforms.uRes.value.set(w,h);};
  return comp;
}
