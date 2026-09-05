(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const ui = {
    menu: document.querySelector('#menu'), result: document.querySelector('#result'), hud: document.querySelector('#hud'),
    touch: document.querySelector('#touch-controls'), keys: document.querySelector('#key-count'), lives: document.querySelector('#lives'),
    timer: document.querySelector('#timer'), toast: document.querySelector('#toast'), resultIcon: document.querySelector('#result-icon'),
    resultTag: document.querySelector('#result-tag'), resultTitle: document.querySelector('#result-title'),
    resultText: document.querySelector('#result-text'), resultTime: document.querySelector('#result-time')
  };

  // Oma pieni raycasting-moottori pitää pelin aidosti 3D:nä ilman CDN- tai WebGL-riippuvuuksia.
  const MAP = [
    '11111111111111111','10000010000000001','10111010101110101','10001000001000101',
    '10101011101010101','10000010000010101','10111010111010101','10100010001000101',
    '10101111101011101','10000000000000001','10111101111101101','10000000000000001',
    '111111110E1111111'
  ];
  const FOV = Math.PI / 3;
  const held = new Set();
  const player = { x:8.5, y:11.35, angle:-Math.PI/2, radius:.2, speed:2.8 };
  const guard = { x:8.5, y:5.5, radius:.25, phase:0 };
  const keyStarts = [[1.6,1.5],[8.5,1.5],[15.4,1.5],[3.5,5.5],[13.5,9.5]];
  const state = { mode:'menu',keys:0,lives:3,elapsed:0,lastTime:0,hitAt:-5,toastTimer:0,flash:0 };
  let keys = [];

  function resize() {
    const dpr=Math.min(devicePixelRatio||1,2); canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function blocked(x,y,r=player.radius) {
    return [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].some(([px,py])=>MAP[Math.floor(py)]?.[Math.floor(px)]==='1');
  }
  function reset() {
    Object.assign(state,{keys:0,lives:3,elapsed:0,lastTime:performance.now(),hitAt:-5,flash:0});
    Object.assign(player,{x:8.5,y:11.35,angle:-Math.PI/2});Object.assign(guard,{x:8.5,y:5.5,phase:0});
    keys=keyStarts.map(([x,y],i)=>({x,y,taken:false,phase:i*1.2}));held.clear();updateHud();
  }
  function start() {
    reset();state.mode='playing';ui.menu.classList.add('hidden');ui.result.classList.add('hidden');ui.result.setAttribute('aria-hidden','true');
    ui.hud.classList.remove('hidden');ui.touch.classList.remove('hidden');showToast('Löydä viisi avainta ja palaa pääovelle!');
    canvas.requestPointerLock?.();
  }
  function finish(won) {
    state.mode='ended';held.clear();document.exitPointerLock?.();ui.hud.classList.add('hidden');ui.touch.classList.add('hidden');
    ui.result.classList.remove('hidden');ui.result.setAttribute('aria-hidden','false');ui.resultIcon.textContent=won?'★':'!';
    ui.resultTag.textContent=won?'PAKO ONNISTUI':'JÄIT KIINNI';ui.resultTitle.textContent=won?'Vapaus!':'Uusi yritys?';
    ui.resultText.textContent=won?'Selvisit koulusta ajassa':'Vahtimestari sai sinut. Aikasi oli';ui.resultTime.textContent=formatTime(state.elapsed);
  }
  function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
  function updateHud(){ui.keys.textContent=`${state.keys} / 5`;ui.lives.textContent='♥ '.repeat(state.lives).trim()||'—';ui.timer.textContent=formatTime(state.elapsed);}
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2100);}

  function move(dx,dy) {
    if(!blocked(player.x+dx,player.y))player.x+=dx;
    if(!blocked(player.x,player.y+dy))player.y+=dy;
  }
  function update(dt) {
    const forward=(held.has('KeyW')||held.has('ArrowUp')?1:0)-(held.has('KeyS')||held.has('ArrowDown')?1:0);
    const strafe=(held.has('KeyD')?1:0)-(held.has('KeyA')?1:0);
    const turn=(held.has('ArrowRight')?1:0)-(held.has('ArrowLeft')?1:0);
    player.angle+=turn*2.15*dt;
    if(forward||strafe){const length=Math.hypot(forward,strafe);const amount=player.speed*dt/length;move((Math.cos(player.angle)*forward-Math.sin(player.angle)*strafe)*amount,(Math.sin(player.angle)*forward+Math.cos(player.angle)*strafe)*amount);}

    guard.phase+=dt*.72;guard.x=8.5+Math.sin(guard.phase)*3.6;guard.y=5.5+Math.sin(guard.phase*2)*.32;
    keys.forEach(key=>{if(!key.taken&&Math.hypot(player.x-key.x,player.y-key.y)<.48){key.taken=true;state.keys++;updateHud();showToast(state.keys===5?'Kaikki avaimet löytyivät – pääovi aukesi!':`Avain löydetty! ${state.keys}/5`);}});
    if(Math.hypot(player.x-guard.x,player.y-guard.y)<.55&&state.elapsed-state.hitAt>1.6){state.hitAt=state.elapsed;state.lives--;state.flash=.3;Object.assign(player,{x:8.5,y:11.35,angle:-Math.PI/2});updateHud();if(state.lives<=0)finish(false);else showToast(`Vahtimestari osui! Elämiä jäljellä ${state.lives}.`);}
    if(player.y>11.65&&player.x>8.05&&player.x<8.95){if(state.keys===5)finish(true);else{player.y=11.45;showToast(`Pääovi on lukossa. Avaimia puuttuu ${5-state.keys}.`);}}
    state.flash=Math.max(0,state.flash-dt);
  }

  function wallRay(angle) {
    const dirX=Math.cos(angle),dirY=Math.sin(angle);let mapX=Math.floor(player.x),mapY=Math.floor(player.y);
    const deltaX=Math.abs(1/(dirX||.00001)),deltaY=Math.abs(1/(dirY||.00001));const stepX=dirX<0?-1:1,stepY=dirY<0?-1:1;
    let sideX=(dirX<0?player.x-mapX:mapX+1-player.x)*deltaX,sideY=(dirY<0?player.y-mapY:mapY+1-player.y)*deltaY,side=0;
    for(let guardLoop=0;guardLoop<64;guardLoop++){if(sideX<sideY){sideX+=deltaX;mapX+=stepX;side=0;}else{sideY+=deltaY;mapY+=stepY;side=1;}if(MAP[mapY]?.[mapX]==='1')break;}
    const distance=side===0?(mapX-player.x+(1-stepX)/2)/(dirX||.00001):(mapY-player.y+(1-stepY)/2)/(dirY||.00001);
    return {distance:Math.max(.001,distance),side,mapX,mapY};
  }
  function drawSprite(sprite,type,zBuffer,time) {
    const dx=sprite.x-player.x,dy=sprite.y-player.y,dist=Math.hypot(dx,dy);let relative=Math.atan2(dy,dx)-player.angle;
    while(relative>Math.PI)relative-=Math.PI*2;while(relative<-Math.PI)relative+=Math.PI*2;
    if(Math.abs(relative)>FOV*.72)return;const screenX=innerWidth*(.5+relative/FOV);const size=Math.min(innerHeight*1.25,innerHeight/dist*(type==='guard'?.9:.55));
    const rayIndex=Math.max(0,Math.min(zBuffer.length-1,Math.floor(screenX/innerWidth*zBuffer.length)));if(dist>zBuffer[rayIndex]+.3)return;
    const y=innerHeight/2-size/2+(type==='key'?Math.sin(time*4+sprite.phase)*7:0);ctx.save();ctx.translate(screenX,y);
    if(type==='key'){ctx.strokeStyle='#ffd447';ctx.lineWidth=Math.max(4,size*.1);ctx.shadowColor='#ffe889';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(-size*.1,size*.35,size*.16,0,7);ctx.moveTo(size*.05,size*.35);ctx.lineTo(size*.38,size*.35);ctx.lineTo(size*.38,size*.52);ctx.moveTo(size*.25,size*.35);ctx.lineTo(size*.25,size*.47);ctx.stroke();}
    else{ctx.shadowColor='#ff315b';ctx.shadowBlur=24;ctx.fillStyle='#5969e8';ctx.beginPath();ctx.roundRect(-size*.28,size*.22,size*.56,size*.65,size*.15);ctx.fill();ctx.fillStyle='#edf5ff';ctx.fillRect(-size*.34,0,size*.68,size*.35);ctx.fillStyle='#ff315b';ctx.beginPath();ctx.arc(-size*.13,size*.15,size*.045,0,7);ctx.arc(size*.13,size*.15,size*.045,0,7);ctx.fill();}
    ctx.restore();
  }
  function render(time) {
    const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);const sky=ctx.createLinearGradient(0,0,0,h/2);sky.addColorStop(0,'#72bfe1');sky.addColorStop(1,'#d8eff5');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h/2);
    const floor=ctx.createLinearGradient(0,h/2,0,h);floor.addColorStop(0,'#847b69');floor.addColorStop(1,'#292d35');ctx.fillStyle=floor;ctx.fillRect(0,h/2,w,h/2);
    const columns=Math.min(600,Math.ceil(w/2)),columnWidth=w/columns,zBuffer=[];
    for(let i=0;i<columns;i++){const cameraX=i/columns-.5,ray=wallRay(player.angle+cameraX*FOV),corrected=ray.distance*Math.cos(cameraX*FOV);zBuffer.push(corrected);const wallH=Math.min(h*2,h/corrected);const shade=Math.max(.2,1-corrected/15)*(ray.side?.76:1);const hue=(ray.mapX+ray.mapY)%3;const base=hue===0?[76,132,166]:hue===1?[92,151,139]:[118,113,166];ctx.fillStyle=`rgb(${base.map(v=>Math.round(v*shade)).join(',')})`;ctx.fillRect(i*columnWidth,(h-wallH)/2,columnWidth+1,wallH);ctx.fillStyle=`rgba(255,255,255,${.08*shade})`;ctx.fillRect(i*columnWidth,(h-wallH)/2,columnWidth+1,2);}
    const sprites=[...keys.filter(k=>!k.taken).map(k=>({...k,type:'key'})),{...guard,type:'guard'}].sort((a,b)=>Math.hypot(b.x-player.x,b.y-player.y)-Math.hypot(a.x-player.x,a.y-player.y));sprites.forEach(s=>drawSprite(s,s.type,zBuffer,time));
    ctx.fillStyle=state.keys===5?'#58e395':'#ff5e87';ctx.fillRect(w/2-42,h-8,84,8);if(state.flash){ctx.fillStyle=`rgba(255,25,70,${state.flash})`;ctx.fillRect(0,0,w,h);}
  }
  function loop(now){const dt=Math.min((now-state.lastTime)/1000,.04);state.lastTime=now;if(state.mode==='playing'){state.elapsed+=dt;update(dt);updateHud();}render(now/1000);requestAnimationFrame(loop);}
  function setKey(code,down){if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))down?held.add(code):held.delete(code);}
  addEventListener('keydown',e=>{setKey(e.code,true);if(e.code.startsWith('Arrow'))e.preventDefault();});addEventListener('keyup',e=>setKey(e.code,false));addEventListener('blur',()=>held.clear());addEventListener('resize',resize);
  document.addEventListener('mousemove',e=>{if(state.mode==='playing'&&document.pointerLockElement===canvas)player.angle+=e.movementX*.0025;});canvas.addEventListener('click',()=>{if(state.mode==='playing')canvas.requestPointerLock?.();});
  document.querySelectorAll('#touch-controls button').forEach(button=>{const code=button.dataset.key;button.addEventListener('pointerdown',e=>{button.setPointerCapture(e.pointerId);setKey(code,true);});['pointerup','pointercancel','pointerleave'].forEach(type=>button.addEventListener(type,()=>setKey(code,false)));});
  document.querySelector('#start').addEventListener('click',start);document.querySelector('#restart').addEventListener('click',start);
  resize();reset();requestAnimationFrame(loop);
})();
