/* Koulupako 3D — rakenne on jaettu pieniin osiin helppoa jatkokehitystä varten. */
// index.html lataa Three.js:n varapalveluineen ennen tämän pelitiedoston suorittamista.
const THREE = globalThis.THREE;

const CONFIG = {
  playerSpeed: 7.5,
  playerRadius: 0.45,
  eyeHeight: 1.65,
  mouseSensitivity: 0.002,
  robotSpeed: 3.1,
  robotHitDistance: 1.25,
  hitCooldown: 1.8,
  keyCount: 5,
};

const state = { started:false, finished:false, keys:0, lives:3, startTime:0, elapsed:0, yaw:0, pitch:0, lastHit:-10 };
const held = Object.create(null);
const walls = [], keyItems = [];
let scene, camera, renderer, clock, robot, exitDoor, messageTimer;

const ui = {
  start: document.querySelector('#start-screen'), end: document.querySelector('#end-screen'),
  startButton: document.querySelector('#start-button'), restartButton: document.querySelector('#restart-button'),
  keys: document.querySelector('#key-count'), lives: document.querySelector('#lives-count'), timer: document.querySelector('#timer'),
  message: document.querySelector('#message'), damage: document.querySelector('#damage'), finalTime: document.querySelector('#final-time'),
  endTitle: document.querySelector('#end-title'), endCopy: document.querySelector('#end-copy'), endEyebrow: document.querySelector('#end-eyebrow'), endIcon: document.querySelector('#end-icon'),
};

function material(color, roughness=0.8, metalness=0) { return new THREE.MeshStandardMaterial({color,roughness,metalness}); }
function box(w,h,d,color,x,y,z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material(color));
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh); return mesh;
}
function addWall(w,d,x,z,color=0x55b8df) {
  const mesh=box(w,3.6,d,color,x,1.8,z); walls.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2}); return mesh;
}

function init() {
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x99dff0); scene.fog=new THREE.Fog(0x99dff0,24,49);
  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,80); camera.rotation.order='YXZ'; scene.add(camera);
  renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; document.querySelector('#game').prepend(renderer.domElement);
  clock=new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xdffaff,0x465178,2.0)); const sun=new THREE.DirectionalLight(0xffffff,2.4); sun.position.set(-8,18,10); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-28; sun.shadow.camera.right=28; sun.shadow.camera.top=28; sun.shadow.camera.bottom=-28; scene.add(sun);
  buildSchool(); bindControls(); resetGame(); animate();
}

function buildSchool() {
  // 30 x 30 metrin koulu: keskikäytävä ja kolme värikoodattua luokkahuonetta.
  box(34,.2,34,0xf1e3bb,0,-.1,0); // lattia
  const grid=new THREE.GridHelper(34,34,0xd0b875,0xe1cd98); grid.position.y=.012; scene.add(grid);
  addWall(34,.5,0,-17,0x35547d); addWall(34,.5,0,17,0x35547d); addWall(.5,34,-17,0,0x35547d); addWall(.5,34,17,0,0x35547d);
  // Pitkä keskikäytävä, oviaukot jäävät väliseinien rakoihin.
  addWall(8,.35,-13,-3,0xff7b72); addWall(6,.35,-4,-3,0xff7b72); addWall(7,.35,5.5,-3,0x66c98f); addWall(5,.35,14.5,-3,0x66c98f);
  addWall(6,.35,-14,4,0x9b7bdb); addWall(8,.35,-4,4,0x9b7bdb); addWall(6,.35,6,4,0xf0a35e); addWall(6,.35,14,4,0xf0a35e);
  addWall(.35,14,-8.5,-10,0xff7b72); addWall(.35,13,-8.5,10.5,0x9b7bdb); addWall(.35,14,8.5,-10,0x66c98f); addWall(.35,13,8.5,10.5,0xf0a35e);
  // Kalusteet tekevät huoneista tunnistettavia mutta eivät osallistu törmäyksiin.
  [[-13,-10],[-4,-10],[13,-10],[-13,11],[-4,11],[13,11]].forEach(([x,z],i)=>{ box(2.5,.7,1.1,i%2?0x55b8df:0xffc857,x,.36,z); box(.18,.8,.18,0x5c4935,x-1,.4,z); box(.18,.8,.18,0x5c4935,x+1,.4,z); });
  // Opasteet käytävällä.
  addSign('A',-8.25,2.1,-1.15,0xff6262); addSign('B',8.25,2.1,-1.15,0x58d68d); addSign('C',-8.25,2.1,5.15,0xa985e8);
  createKeys(); createRobot(); createExit();
}

function addSign(letter,x,y,z,color) {
  const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=128; const c=canvas.getContext('2d'); c.fillStyle=`#${color.toString(16).padStart(6,'0')}`; c.fillRect(0,0,128,128); c.fillStyle='white'; c.font='bold 82px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(letter,64,68);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)})); sign.position.set(x,y,z); sign.rotation.y=z<0?0:Math.PI; scene.add(sign);
}

function createKeys() {
  const spots=[[-13,1,-11],[0,1,0],[13,1,-11],[-13,1,12],[12,1,12]];
  spots.forEach(([x,y,z],index)=>{
    const group=new THREE.Group(); const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.09,10,20),material(0xffd447,.25,.7)); const stem=boxGeometry(.48,.12,.12); stem.position.x=.43; group.add(ring,stem); const tooth=boxGeometry(.13,.28,.12); tooth.position.set(.62,-.13,0); group.add(tooth); group.position.set(x,y,z); group.rotation.x=Math.PI/2; group.userData={index,baseY:y,collected:false}; scene.add(group); keyItems.push(group);
  });
  function boxGeometry(w,h,d){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(0xffd447,.25,.7)); }
}

function createRobot() {
  robot=new THREE.Group(); const body=new THREE.Mesh(new THREE.CylinderGeometry(.48,.58,1,12),material(0x5969e8,.25,.35)); body.position.y=.78; const head=new THREE.Mesh(new THREE.BoxGeometry(.85,.55,.7),material(0xeaf4ff,.3,.1)); head.position.y=1.48; const eyeMat=new THREE.MeshBasicMaterial({color:0xff315b}); [-.2,.2].forEach(x=>{const eye=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),eyeMat); eye.position.set(x,1.52,-.36); robot.add(eye);}); robot.add(body,head); robot.position.set(0,0,11); robot.userData.direction=1; scene.add(robot);
}

function createExit() {
  exitDoor=box(3,3.1,.22,0xff5d8f,0,1.55,16.72); exitDoor.userData.locked=true;
  const glow=new THREE.PointLight(0xff5d8f,3,7); glow.position.set(0,2,14.5); scene.add(glow);
  const frame=material(0x25395d); box(.25,3.6,.5,0x25395d,-1.65,1.8,16.6); box(.25,3.6,.5,0x25395d,1.65,1.8,16.6); box(3.55,.25,.5,0x25395d,0,3.48,16.6);
}

function bindControls() {
  ui.startButton.addEventListener('click',startGame); ui.restartButton.addEventListener('click',()=>{ui.end.classList.remove('visible'); resetGame(); startGame();});
  renderer.domElement.addEventListener('click',()=>{if(state.started&&!state.finished) renderer.domElement.requestPointerLock();});
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==renderer.domElement||!state.started||state.finished)return; state.yaw-=e.movementX*CONFIG.mouseSensitivity; state.pitch-=e.movementY*CONFIG.mouseSensitivity; state.pitch=THREE.MathUtils.clamp(state.pitch,-1.42,1.42);});
  addEventListener('keydown',e=>{held[e.code]=true; if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();}); addEventListener('keyup',e=>held[e.code]=false);
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);});
}

function resetGame() {
  state.started=false; state.finished=false; state.keys=0; state.lives=3; state.elapsed=0; state.yaw=0; state.pitch=0; state.lastHit=-10; camera.position.set(0,CONFIG.eyeHeight,-14); camera.rotation.set(0,0,0); robot.position.set(0,0,11); robot.userData.direction=1;
  keyItems.forEach(k=>{k.visible=true;k.userData.collected=false;}); exitDoor.visible=true; exitDoor.userData.locked=true; exitDoor.material.color.setHex(0xff5d8f); ui.keys.textContent=`0 / ${CONFIG.keyCount}`; ui.lives.textContent='3'; ui.timer.textContent='00:00.0';
}
function startGame(){ state.started=true; state.startTime=performance.now(); ui.start.classList.remove('visible'); ui.end.classList.remove('visible'); renderer.domElement.requestPointerLock(); showMessage('Etsi viisi avainta ja suuntaa pääovelle!'); }

function collides(x,z) { const r=CONFIG.playerRadius; return walls.some(w=>x+r>w.minX&&x-r<w.maxX&&z+r>w.minZ&&z-r<w.maxZ); }
function updatePlayer(dt) {
  if(document.pointerLockElement!==renderer.domElement)return;
  let forward=(held.KeyW?1:0)-(held.KeyS?1:0), side=(held.KeyD?1:0)-(held.KeyA?1:0); if(!forward&&!side)return;
  const length=Math.hypot(forward,side); forward/=length; side/=length; const sin=Math.sin(state.yaw), cos=Math.cos(state.yaw); const dx=(side*cos-forward*sin)*CONFIG.playerSpeed*dt, dz=(-side*sin-forward*cos)*CONFIG.playerSpeed*dt;
  if(!collides(camera.position.x+dx,camera.position.z))camera.position.x+=dx; if(!collides(camera.position.x,camera.position.z+dz))camera.position.z+=dz;
}
function updateKeys(t) { keyItems.forEach(k=>{if(k.userData.collected)return; k.rotation.z+=.025; k.position.y=k.userData.baseY+Math.sin(t*3+k.userData.index)*.16; if(camera.position.distanceTo(k.position)<1.25){k.userData.collected=true;k.visible=false;state.keys++;ui.keys.textContent=`${state.keys} / ${CONFIG.keyCount}`; showMessage(`Avain löydetty! ${state.keys}/${CONFIG.keyCount}`); if(state.keys===CONFIG.keyCount){exitDoor.userData.locked=false;exitDoor.material.color.setHex(0x55dd91);showMessage('Kaikki avaimet löytyivät – pääovi on auki!');}}}); }
function updateRobot(dt,t) {
  robot.position.x+=robot.userData.direction*CONFIG.robotSpeed*dt; if(Math.abs(robot.position.x)>14){robot.userData.direction*=-1;robot.position.x=THREE.MathUtils.clamp(robot.position.x,-14,14);} robot.rotation.y=robot.userData.direction>0?-Math.PI/2:Math.PI/2; robot.position.y=Math.sin(t*4)*.06;
  const dx=camera.position.x-robot.position.x,dz=camera.position.z-robot.position.z; if(Math.hypot(dx,dz)<CONFIG.robotHitDistance&&state.elapsed-state.lastHit>CONFIG.hitCooldown){state.lastHit=state.elapsed;state.lives--;ui.lives.textContent=state.lives;ui.damage.classList.add('hit');setTimeout(()=>ui.damage.classList.remove('hit'),160); camera.position.set(0,CONFIG.eyeHeight,-14); showMessage(state.lives?`Robotti sai sinut! Elämiä jäljellä: ${state.lives}`:'Robotti sai sinut kiinni!'); if(state.lives<=0)finish(false);}
}
function checkExit(){if(camera.position.z>15.2&&Math.abs(camera.position.x)<1.5){if(exitDoor.userData.locked){camera.position.z=15.1;showMessage(`Ovi on lukossa – avaimia puuttuu ${CONFIG.keyCount-state.keys}!`);}else finish(true);}}

function finish(won){state.finished=true;document.exitPointerLock?.();ui.end.classList.add('visible');ui.end.setAttribute('aria-hidden','false');ui.finalTime.textContent=formatTime(state.elapsed);ui.endEyebrow.textContent=won?'PAKO ONNISTUI!':'YRIKSI UUDELLEEN';ui.endTitle.textContent=won?'Vapaus!':'Jäit kiinni';ui.endCopy.textContent=won?'Pääsit ulos koulusta ajassa':'Vahtirobotti voitti tällä kertaa. Aikasi oli';ui.endIcon.textContent=won?'★':'⚙';}
function showMessage(text){ui.message.textContent=text;ui.message.classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>ui.message.classList.remove('show'),2200);}
function formatTime(seconds){const m=Math.floor(seconds/60).toString().padStart(2,'0'),s=Math.floor(seconds%60).toString().padStart(2,'0'),d=Math.floor(seconds*10)%10;return `${m}:${s}.${d}`;}

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),t=performance.now()/1000;if(state.started&&!state.finished){state.elapsed=(performance.now()-state.startTime)/1000;ui.timer.textContent=formatTime(state.elapsed);updatePlayer(dt);updateKeys(t);updateRobot(dt,t);checkExit();}camera.rotation.set(state.pitch,state.yaw,0);renderer.render(scene,camera);}

init();
