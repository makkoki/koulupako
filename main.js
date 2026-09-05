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

  const WORLD = { width: 1400, height: 900 };
  const walls = [
    [0,0,1400,32],[0,868,590,32],[810,868,590,32],[0,0,32,900],[1368,0,32,900],
    [250,150,32,250],[250,520,32,220],[520,32,32,180],[520,330,32,290],[520,750,32,118],
    [840,32,32,270],[840,430,32,210],[840,760,32,108],[1110,150,32,250],[1110,520,32,220]
  ];
  const keySpawns = [[135,120],[400,260],[690,140],[1010,270],[1240,720]];
  const held = new Set();
  const state = { mode:'menu', keys:0, lives:3, elapsed:0, lastTime:0, hitAt:-5, toastTimer:0 };
  const player = { x:700,y:790,r:18,speed:255 };
  const guard = { x:700,y:445,r:23,speed:145,target:0,route:[[660,445],[1020,445],[1020,680],[700,680],[380,680],[380,445]] };
  let pickups = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth*dpr); canvas.height = Math.round(innerHeight*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function reset() {
    Object.assign(state,{ keys:0,lives:3,elapsed:0,lastTime:performance.now(),hitAt:-5 });
    Object.assign(player,{x:700,y:790}); Object.assign(guard,{x:700,y:445,target:0});
    pickups = keySpawns.map(([x,y])=>({x,y,taken:false,phase:Math.random()*6}));
    held.clear(); updateHud();
  }
  function start() {
    reset(); state.mode='playing'; ui.menu.classList.add('hidden'); ui.result.classList.add('hidden');
    ui.result.setAttribute('aria-hidden','true'); ui.hud.classList.remove('hidden'); ui.touch.classList.remove('hidden');
    showToast('Kerää kaikki avaimet ja pakene alareunan pääovesta!');
  }
  function finish(won) {
    state.mode='ended'; held.clear(); ui.hud.classList.add('hidden'); ui.touch.classList.add('hidden');
    ui.result.classList.remove('hidden'); ui.result.setAttribute('aria-hidden','false');
    ui.resultIcon.textContent=won?'★':'!'; ui.resultTag.textContent=won?'PAKO ONNISTUI':'JÄIT KIINNI';
    ui.resultTitle.textContent=won?'Vapaus!':'Uusi yritys?'; ui.resultText.textContent=won?'Selvisit koulusta ajassa':'Vahtimestari sai sinut. Aikasi oli';
    ui.resultTime.textContent=formatTime(state.elapsed);
  }
  function updateHud() { ui.keys.textContent=`${state.keys} / 5`; ui.lives.textContent='♥ '.repeat(state.lives).trim() || '—'; ui.timer.textContent=formatTime(state.elapsed); }
  function formatTime(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`; }
  function showToast(text) { ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2100); }
  function hitsWall(x,y,r=player.r) { return walls.some(([wx,wy,ww,wh])=>x+r>wx&&x-r<wx+ww&&y+r>wy&&y-r<wy+wh); }

  function update(dt) {
    let dx=(held.has('KeyD')||held.has('ArrowRight')?1:0)-(held.has('KeyA')||held.has('ArrowLeft')?1:0);
    let dy=(held.has('KeyS')||held.has('ArrowDown')?1:0)-(held.has('KeyW')||held.has('ArrowUp')?1:0);
    if(dx||dy){const len=Math.hypot(dx,dy);dx=dx/len*player.speed*dt;dy=dy/len*player.speed*dt;if(!hitsWall(player.x+dx,player.y))player.x+=dx;if(!hitsWall(player.x,player.y+dy))player.y+=dy;}
    player.x=Math.max(player.r,Math.min(WORLD.width-player.r,player.x)); player.y=Math.max(player.r,Math.min(WORLD.height+player.r,player.y));

    const goal=guard.route[guard.target], gx=goal[0]-guard.x, gy=goal[1]-guard.y, gd=Math.hypot(gx,gy);
    if(gd<5)guard.target=(guard.target+1)%guard.route.length; else {guard.x+=gx/gd*guard.speed*dt;guard.y+=gy/gd*guard.speed*dt;}
    pickups.forEach(k=>{if(!k.taken&&Math.hypot(player.x-k.x,player.y-k.y)<36){k.taken=true;state.keys++;updateHud();showToast(state.keys===5?'Kaikki avaimet löytyivät – pääovi aukesi!':`Avain löydetty! ${state.keys}/5`);}});
    if(Math.hypot(player.x-guard.x,player.y-guard.y)<player.r+guard.r&&state.elapsed-state.hitAt>1.5){state.hitAt=state.elapsed;state.lives--;Object.assign(player,{x:700,y:790});updateHud();canvas.classList.add('hit');setTimeout(()=>canvas.classList.remove('hit'),150);if(state.lives<=0)finish(false);else showToast(`Vahtimestari osui! Elämiä jäljellä ${state.lives}.`);}
    if(player.y>890&&player.x>590&&player.x<810){if(state.keys===5)finish(true);else{player.y=850;showToast(`Pääovi on lukossa. Avaimia puuttuu ${5-state.keys}.`);}}
  }

  function roundedRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawWorld(time) {
    const scale=Math.min(innerWidth/WORLD.width,innerHeight/WORLD.height), ox=(innerWidth-WORLD.width*scale)/2, oy=(innerHeight-WORLD.height*scale)/2;
    ctx.clearRect(0,0,innerWidth,innerHeight);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
    ctx.fillStyle='#d9cda9';ctx.fillRect(0,0,WORLD.width,WORLD.height);
    ctx.strokeStyle='#c8ba94';ctx.lineWidth=2;for(let x=0;x<WORLD.width;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD.height);ctx.stroke();}for(let y=0;y<WORLD.height;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.width,y);ctx.stroke();}
    [[32,32,218,836,'#e67571'],[282,32,238,836,'#efaf5d'],[552,32,288,836,'#55bca7'],[872,32,238,836,'#8182d7'],[1142,32,226,836,'#da7da5']].forEach(([x,y,w,h,c])=>{ctx.globalAlpha=.14;ctx.fillStyle=c;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;});
    walls.forEach(([x,y,w,h],i)=>roundedRect(x,y,w,h,5,i<5?'#263856':'#3d5775'));
    ctx.fillStyle=state.keys===5?'#53dc91':'#f45d82';ctx.fillRect(590,868,220,32);ctx.fillStyle='#fff';ctx.font='bold 22px system-ui';ctx.textAlign='center';ctx.fillText(state.keys===5?'ULOS →':'PÄÄOVI',700,858);
    pickups.forEach(k=>{if(k.taken)return;const bob=Math.sin(time*4+k.phase)*5;ctx.save();ctx.translate(k.x,k.y+bob);ctx.rotate(time*1.5);ctx.strokeStyle='#ffd447';ctx.lineWidth=10;ctx.shadowColor='#ffdf67';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(-8,0,13,0,Math.PI*2);ctx.moveTo(5,0);ctx.lineTo(31,0);ctx.lineTo(31,12);ctx.moveTo(20,0);ctx.lineTo(20,9);ctx.stroke();ctx.restore();});
    ctx.save();ctx.translate(guard.x,guard.y);ctx.shadowColor='#ff315b';ctx.shadowBlur=15;ctx.fillStyle='#5969e8';ctx.beginPath();ctx.arc(0,0,guard.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-8,-5,6,0,7);ctx.arc(8,-5,6,0,7);ctx.fill();ctx.fillStyle='#ff315b';ctx.beginPath();ctx.arc(-8,-5,3,0,7);ctx.arc(8,-5,3,0,7);ctx.fill();ctx.restore();
    ctx.save();ctx.translate(player.x,player.y);ctx.shadowColor='#45e6ee';ctx.shadowBlur=15;ctx.fillStyle='#32bdd0';ctx.beginPath();ctx.arc(0,0,player.r,0,7);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.stroke();ctx.restore();ctx.restore();
  }
  function loop(now) { const dt=Math.min((now-state.lastTime)/1000,.04);state.lastTime=now;if(state.mode==='playing'){state.elapsed+=dt;update(dt);updateHud();}drawWorld(now/1000);requestAnimationFrame(loop); }
  function setKey(code,down){if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)){down?held.add(code):held.delete(code);}}
  addEventListener('keydown',e=>{setKey(e.code,true);if(e.code.startsWith('Arrow'))e.preventDefault();});addEventListener('keyup',e=>setKey(e.code,false));addEventListener('blur',()=>held.clear());addEventListener('resize',resize);
  document.querySelectorAll('#touch-controls button').forEach(button=>{const code=button.dataset.key;['pointerdown','pointerenter'].forEach(type=>button.addEventListener(type,e=>{if(type==='pointerdown')button.setPointerCapture(e.pointerId);setKey(code,true);}));['pointerup','pointercancel','pointerleave'].forEach(type=>button.addEventListener(type,()=>setKey(code,false)));});
  document.querySelector('#start').addEventListener('click',start);document.querySelector('#restart').addEventListener('click',start);
  resize();reset();requestAnimationFrame(loop);
})();
