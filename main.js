import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

// Koulupako 3D – kevyt, geometrioista rakennettu ensimmäisen persoonan peli.
const canvas = document.querySelector('#game');
const ui = {
  menu: document.querySelector('#menu'), result: document.querySelector('#result'), hud: document.querySelector('#hud'),
  timer: document.querySelector('#timer'), keys: document.querySelector('#key-count'), lives: document.querySelector('#lives'),
  toast: document.querySelector('#toast'), danger: document.querySelector('#danger'), crosshair: document.querySelector('#crosshair'),
  loading: document.querySelector('#loading'), resultIcon: document.querySelector('#result-icon'), resultTag: document.querySelector('#result-tag'),
  resultTitle: document.querySelector('#result-title'), resultText: document.querySelector('#result-text'), resultTime: document.querySelector('#result-time')
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9edff4);
scene.fog = new THREE.Fog(0x9edff4, 26, 58);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 90);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const clock = new THREE.Clock();
const blockers = [];
const pressed = new Set();
const keyItems = [];
const PLAYER_RADIUS = 0.42;
const START = new THREE.Vector3(0, 1.65, 11.8);
const state = { mode: 'menu', keyCount: 0, lives: 3, elapsed: 0, yaw: Math.PI, pitch: 0, invulnerableUntil: 0, toastTimer: 0 };
let robot;
let exitDoor;

function material(color, roughness = .72, metalness = .02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function box(name, position, size, color, collision = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (collision) blockers.push(new THREE.Box3().setFromObject(mesh));
  return mesh;
}

// Luo koulun kuusi värikästä huonetta, keskikäytävän, ovet, ikkunat ja kalusteet.
function createSchool() {
  box('Lattia', [0, -.12, 0], [36, .24, 30], 0xe9dfc5);
  box('Katto', [0, 4.4, 0], [36, .15, 30], 0xf5f7fb);
  const wall = 0x304968;
  box('Pohjoisseinä', [0, 2.1, -15], [36, 4.2, .35], wall, true);
  box('Eteläseinä vasen', [-11.5, 2.1, 15], [13, 4.2, .35], wall, true);
  box('Eteläseinä oikea', [11.5, 2.1, 15], [13, 4.2, .35], wall, true);
  box('Eteläseinä oven vasen', [-3.4, 2.1, 15], [3.8, 4.2, .35], wall, true);
  box('Eteläseinä oven oikea', [3.4, 2.1, 15], [3.8, 4.2, .35], wall, true);
  box('Länsiseinä', [-18, 2.1, 0], [.35, 4.2, 30], wall, true);
  box('Itäseinä', [18, 2.1, 0], [.35, 4.2, 30], wall, true);

  // Käytävän vierusseinissä on oviaukot jokaisen luokan kohdalla.
  [-3, 3].forEach(x => {
    [[-13.05,3.9],[-5,7.8],[5,7.8],[13.05,3.9]].forEach(([z,length]) =>
      box('Käytävän seinä', [x, 2.1, z], [.28, 4.2, length], wall, true));
  });
  [-5, 5].forEach(z => {
    box('Luokkaseinä vasen', [-10.5, 2.1, z], [15, 4.2, .25], wall, true);
    box('Luokkaseinä oikea', [10.5, 2.1, z], [15, 4.2, .25], wall, true);
  });

  // Värialueet, ikkunat ja luokkien nimikyltit.
  const roomColors = [0xf27575, 0xffb650, 0x55c6ad, 0x797ee5, 0xd975ad, 0x43a9d8];
  const rooms = [[-10.5,-10],[-10.5,0],[-10.5,10],[10.5,-10],[10.5,0],[10.5,10]];
  rooms.forEach(([x,z], index) => {
    box('Luokan matto', [x,.015,z], [13.8,.035,8.9], roomColors[index]);
    const outerX = x < 0 ? -17.78 : 17.78;
    [-2.2, 2.2].forEach(offset => box('Ikkuna', [outerX,2.55,z+offset], [.06,1.55,2.5], 0x82ddff));
    const sign = box(`LUOKKA ${index+1}`, [x < 0 ? -3.17 : 3.17,2.8,z], [.08,.65,1.8], roomColors[index]);
    sign.rotation.y = Math.PI / 2;
    // Pöydät jätetään kevyiksi mutta ne ovat oikeita törmäysesteitä.
    [-2.6, 0, 2.6].forEach(dx => {
      const px = x + dx;
      box('Pöytälevy', [px,.85,z], [1.7,.16,1.15], 0xffd98b, true);
      box('Pöydän jalka', [px,.42,z], [.22,.78,.22], 0x374963);
    });
    box('Liitutaulu', [x,2.35,z-4.42], [5.4,1.55,.12], 0x245946);
  });

  // Ovet merkitsevät aukkoja selvästi (eivät estä kulkua).
  rooms.forEach(([x,z], i) => {
    const frameX = x < 0 ? -3.1 : 3.1;
    box('Oven yläkarmi', [frameX,3.55,z], [.32,.25,2.25], 0xffd447);
    [-1.05,1.05].forEach(dz => box('Oven karmi', [frameX,1.75,z+dz], [.32,3.5,.18], 0xffd447));
  });
  exitDoor = box('Ulko-ovi', [0,1.8,14.82], [3,3.6,.18], 0xef426f);
  const exitLight = new THREE.PointLight(0xff557a, 12, 7); exitLight.position.set(0,3,12.5); scene.add(exitLight); exitDoor.userData.light = exitLight;

  // Katon valopaneelit valaisevat käytävän tehokkaasti.
  scene.add(new THREE.HemisphereLight(0xdff7ff, 0x526271, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(-8,16,7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-20; sun.shadow.camera.right=20; sun.shadow.camera.top=18; sun.shadow.camera.bottom=-18; scene.add(sun);
  [-10,-3,4,11].forEach(z => { const p = new THREE.PointLight(0xfff1c9, 4, 10); p.position.set(0,3.8,z); scene.add(p); box('Valopaneeli',[0,4.25,z],[1.8,.08,.7],0xffffff); });
}

function createPlayer() { camera.position.copy(START); camera.rotation.order = 'YXZ'; scene.add(camera); }

function createKey(x, z, color = 0xffd21f) {
  const group = new THREE.Group();
  const mat = material(color,.25,.65);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.27,.09,10,22),mat); ring.rotation.y=Math.PI/2; group.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(.65,.11,.11),mat); shaft.position.x=.48; group.add(shaft);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(.12,.28,.11),mat); tooth.position.set(.72,-.14,0); group.add(tooth);
  group.position.set(x,1.05,z); group.castShadow=true; group.userData={baseY:1.05,taken:false,phase:Math.random()*Math.PI*2}; scene.add(group); keyItems.push(group);
}
function createKeys() { [[-13,-11],[-9,1],[-14,11],[13,-9],[12,9]].forEach(([x,z],i)=>createKey(x,z,i===4?0x8dffdd:0xffd21f)); }

function createRobotMesh() {
  const group = new THREE.Group(), steel=material(0x5e6be8,.35,.45), dark=material(0x24304f), eye=material(0xff315b,.2,.3);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.05,1.1,.75),steel);body.position.y=1.05;group.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.9,.65,.7),dark);head.position.y=1.9;group.add(head);
  [-.22,.22].forEach(x=>{const e=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),eye);e.position.set(x,1.95,-.36);group.add(e)});
  [-.33,.33].forEach(x=>{const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,.55,.3),dark);leg.position.set(x,.3,0);group.add(leg)});
  const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.45,8),steel);antenna.position.y=2.45;group.add(antenna);
  const light=new THREE.PointLight(0xff2858,4,4);light.position.set(0,1.9,-.5);group.add(light);group.traverse(o=>{if(o.isMesh)o.castShadow=true});return group;
}
function createRobot() {
  robot=createRobotMesh(); robot.position.set(0,0,-8); robot.userData={speed:2.05,routeIndex:0,chasing:false,route:[new THREE.Vector3(0,0,-11),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,8),new THREE.Vector3(0,0,12)]}; scene.add(robot);
}

function initGame() { createSchool(); createPlayer(); createKeys(); createRobot(); ui.loading.remove(); renderer.setAnimationLoop(animate); }
function collidesAt(x,z) { const sphere=new THREE.Sphere(new THREE.Vector3(x,1,z),PLAYER_RADIUS); return blockers.some(wall=>wall.intersectsSphere(sphere)); }

// Liike lasketaan kameran katselusuunnasta ja testataan akseleittain seinien läpi kävelyn estämiseksi.
function updatePlayer(dt) {
  let forward=(pressed.has('KeyW')?1:0)-(pressed.has('KeyS')?1:0), side=(pressed.has('KeyD')?1:0)-(pressed.has('KeyA')?1:0);
  if (!forward&&!side) return;
  const length=Math.hypot(forward,side); forward/=length; side/=length;
  const speed=5.25, sin=Math.sin(state.yaw), cos=Math.cos(state.yaw);
  const dx=(side*cos-forward*sin)*speed*dt, dz=(side*sin+forward*cos)*speed*dt;
  if(!collidesAt(camera.position.x+dx,camera.position.z)) camera.position.x+=dx;
  if(!collidesAt(camera.position.x,camera.position.z+dz)) camera.position.z+=dz;
  camera.position.x=THREE.MathUtils.clamp(camera.position.x,-17.4,17.4);
  camera.position.z=THREE.MathUtils.clamp(camera.position.z,-14.4,15.6);
}

function updateRobot(dt) {
  const flatPlayer=new THREE.Vector3(camera.position.x,0,camera.position.z), distance=robot.position.distanceTo(flatPlayer);
  robot.userData.chasing=distance<8.5;
  let target;
  if(robot.userData.chasing) target=flatPlayer;
  else { target=robot.userData.route[robot.userData.routeIndex]; if(robot.position.distanceTo(target)<.45) robot.userData.routeIndex=(robot.userData.routeIndex+1)%robot.userData.route.length; }
  const direction=target.clone().sub(robot.position); direction.y=0;
  if(direction.lengthSq()>.01){direction.normalize();const step=direction.multiplyScalar(robot.userData.speed*(robot.userData.chasing?1.38:1)*dt);robot.position.add(step);robot.rotation.y=Math.atan2(direction.x,direction.z)+Math.PI;}
  ui.danger.classList.toggle('hidden',!robot.userData.chasing);
  if(distance<1.05 && state.elapsed>state.invulnerableUntil) loseLife();
}

function collectKeys(time) {
  keyItems.forEach(item=>{
    if(item.userData.taken)return;
    item.rotation.y=time*1.8; item.position.y=item.userData.baseY+Math.sin(time*3+item.userData.phase)*.14;
    if(item.position.distanceTo(camera.position)<1.25){item.userData.taken=true;item.visible=false;state.keyCount++;updateHud();
      if(state.keyCount===5){exitDoor.material.color.setHex(0x35dc79);exitDoor.userData.light.color.setHex(0x35ff82);showToast('Kaikki avaimet löytyivät! Ulko-ovi on nyt auki!');}
      else showToast(`Avain kerätty! ${state.keyCount} / 5`);
    }
  });
}
function checkCollisions() {
  if(camera.position.z>14.25 && Math.abs(camera.position.x)<1.8){
    if(state.keyCount===5) winGame(); else {camera.position.z=13.75;showToast('Etsi vielä kaikki avaimet!');}
  }
}
function loseLife() {
  state.lives--; state.invulnerableUntil=state.elapsed+2.5; updateHud(); camera.position.copy(START);
  robot.position.set(0,0,-9); robot.userData.routeIndex=0;
  if(state.lives<=0) gameOver(); else showToast(`Robotti sai sinut! Elämiä jäljellä: ${state.lives}`);
}
function updateTimer() { ui.timer.textContent=formatTime(state.elapsed); }
function updateHud() { ui.keys.textContent=`${state.keyCount} / 5`;ui.lives.textContent='♥ '.repeat(state.lives).trim()||'—';updateTimer(); }
function formatTime(seconds){return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
function showToast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2200);}

function resetWorld() {
  state.keyCount=0;state.lives=3;state.elapsed=0;state.invulnerableUntil=2.2;state.yaw=Math.PI;state.pitch=0;
  camera.position.copy(START);camera.rotation.set(0,state.yaw,0);
  keyItems.forEach(item=>{item.visible=true;item.userData.taken=false});
  robot.position.set(0,0,-8);robot.userData.routeIndex=0;robot.userData.chasing=false;
  exitDoor.material.color.setHex(0xef426f);exitDoor.userData.light.color.setHex(0xff557a);pressed.clear();updateHud();
}
function startGame(){resetWorld();state.mode='playing';clock.getDelta();ui.menu.classList.add('hidden');ui.result.classList.add('hidden');ui.result.setAttribute('aria-hidden','true');ui.hud.classList.remove('hidden');ui.crosshair.classList.remove('hidden');canvas.requestPointerLock?.();showToast('Kerää viisi avainta ja pakene vihreästä ovesta!');}
function endGame(won){if(state.mode!=='playing')return;state.mode='ended';pressed.clear();document.exitPointerLock?.();ui.hud.classList.add('hidden');ui.crosshair.classList.add('hidden');ui.danger.classList.add('hidden');ui.result.classList.remove('hidden');ui.result.setAttribute('aria-hidden','false');ui.resultIcon.textContent=won?'★':'🤖';ui.resultTag.textContent=won?'PAKO ONNISTUI!':'ROBOTTI VOITTI';ui.resultTitle.textContent=won?'PÄÄSIT ULOS!':'GAME OVER';ui.resultText.textContent=won?'Loppuaika':'Robottivartija sai sinut. Aikasi';ui.resultTime.textContent=formatTime(state.elapsed);}
function winGame(){endGame(true)}
function gameOver(){endGame(false)}
function restartGame(){startGame()}

function animate(){const dt=Math.min(clock.getDelta(),.05);if(state.mode==='playing'){state.elapsed+=dt;updatePlayer(dt);updateRobot(dt);collectKeys(state.elapsed);checkCollisions();updateTimer();}renderer.render(scene,camera);}

addEventListener('keydown',event=>{if(['KeyW','KeyA','KeyS','KeyD'].includes(event.code)){pressed.add(event.code);event.preventDefault()}});
addEventListener('keyup',event=>pressed.delete(event.code));addEventListener('blur',()=>pressed.clear());
addEventListener('mousemove',event=>{if(state.mode!=='playing'||document.pointerLockElement!==canvas)return;state.yaw-=event.movementX*.0022;state.pitch=THREE.MathUtils.clamp(state.pitch-event.movementY*.0022,-1.35,1.35);camera.rotation.set(state.pitch,state.yaw,0)});
canvas.addEventListener('click',()=>{if(state.mode==='playing'&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.()});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight,false)});
document.querySelector('#start').addEventListener('click',startGame);document.querySelector('#restart').addEventListener('click',restartGame);

// Pieni testirajapinta helpottaa pelimekaniikkojen automaattista savutestausta.
window.__koulupako={state,camera,get robot(){return robot},collectAll(){keyItems.forEach(k=>{k.userData.taken=true;k.visible=false});state.keyCount=5;exitDoor.material.color.setHex(0x35dc79);updateHud()},loseLife,winGame,gameOver,restartGame,collidesAt};
initGame();
