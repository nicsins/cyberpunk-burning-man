  if(name.includes('.')) return base + name;
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
  scene.background=new THREE.Color(0x030012);
  scene.fog=new THREE.FogExp2(0x0a0028,0.0055);

  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,0.1,900);
  camera.position.set(0,1.7,28);

  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x1a1040,0.5));
  const moon=new THREE.DirectionalLight(0x6688ff,0.65);
  moon.position.set(-40,90,-20);scene.add(moon);
  const fill=new THREE.DirectionalLight(0xff44aa,0.22);
  fill.position.set(30,40,40);scene.add(fill);

  const neonCols=[0xff00ff,0x00ffff,0xff6600,0x00ff88,0xff0088,0x88ff00,0xffaa00];
  for(let i=0;i<16;i++){
    const l=new THREE.PointLight(neonCols[i%7],2.6,45,1.8);
    const a=(i/16)*Math.PI*2,r=18+Math.random()*50;
    l.position.set(Math.cos(a)*r,2+Math.random()*7,Math.sin(a)*r);
    scene.add(l);
  }

  const gTex=await loadTexture(assetUrl('ground.jpg'));
  gTex.wrapS=gTex.wrapT=THREE.RepeatWrapping;gTex.repeat.set(30,30);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(360,360),new THREE.MeshStandardMaterial({map:gTex,roughness:0.93,metalness:0.06,color:0xccbbaa}));
  ground.rotation.x=-Math.PI/2;scene.add(ground);

  const sGeo=new THREE.BufferGeometry();const sPos=[];
  for(let i=0;i<2800;i++){const r=300+Math.random()*200,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);sPos.push(r*Math.sin(ph)*Math.cos(th),r*Math.cos(ph),r*Math.sin(ph)*Math.sin(th))}
  sGeo.setAttribute('position',new THREE.Float32BufferAttribute(sPos,3));
  scene.add(new THREE.Points(sGeo,new THREE.PointsMaterial({color:0xffffff,size:0.5,transparent:true,opacity:0.9})));

  for(let i=0;i<3;i++){
    const aMat=new THREE.MeshBasicMaterial({color:i%2?0x00ffaa:0xaa00ff,transparent:true,opacity:0.08,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
    const aMesh=new THREE.Mesh(new THREE.PlaneGeometry(180,40,aMat));
