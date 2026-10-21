(() => {
 'use strict';
 const root=document.getElementById('game3d');if(!root)return;
 root.innerHTML=`<div class="section-heading"><div><p class="section-number">GAME 02 ／ 紅紙鈔・掉面具</p><h2>紅紙鈔<br>掉面具。</h2></div><p class="section-deck">抓一疊道具紙鈔，往前撒！<br>40 秒，看看你能撒出幾連擊。</p></div>
 <div class="g3-arcade"><div class="g3-stage"><canvas id="g3-canvas" tabindex="0" aria-label="紅紙鈔掉面具。方向鍵或 WASD 移動落點，按住空白鍵撒道具紙鈔；滑鼠或觸控移動落點並撒鈔，Esc 暫停。"></canvas>
 <div class="g3-hud" aria-live="off"><div class="g3-scorebox"><small>SCORE</small><strong id="g3-score">000000</strong></div><div class="g3-wavebox"><small id="g3-progress">WAVE 01</small><strong id="g3-combo">READY?</strong></div><div class="g3-timebox"><small>TIME</small><strong id="g3-time">40.0</strong></div></div>
 <div class="g3-livebar"><span>PAPER NOTE ARCADE</span><span id="g3-best">BEST 000000</span></div><div id="g3-overlay"><div class="g3-overlay-inner"><p class="g3-kicker" id="g3-kicker">GRAB A HANDFUL</p><h3 id="g3-overlay-title">笑容滿面。<br><em>撒出問號！</em></h3><p id="g3-overlay-copy">紅紙鈔轉啊轉，面具飛啊飛。<br>按住連撒，讓問號一張張飛到笑容前。</p><div class="g3-intro-keys"><span>← → / WASD 移動落點</span><span>SPACE 撒鈔</span><span>點按／拖曳也能撒</span></div><button id="g3-start" type="button">開始撒鈔 <span>▶</span></button><p class="g3-overlay-note">40 秒一局 · 音效可自由開關</p></div></div>
 <div class="g3-retro-corner" aria-hidden="true">ARCADE / 02</div></div>
 <div class="g3-controlbar"><div class="g3-maincontrols"><button id="g3-toggle" type="button">暫停 ⏸</button><button id="g3-reset" type="button">重新開局 ↻</button><button id="g3-sound" type="button" aria-pressed="false">音效：關</button></div><p>滑鼠移動落點／按住撒鈔 · 方向鍵移動 · 空白鍵撒鈔 · Esc 暫停</p></div>
 <div class="g3-touch"><div class="g3-direction"><button type="button" data-g3-move="left" aria-label="向左移動落點">◀</button><button type="button" data-g3-move="right" aria-label="向右移動落點">▶</button></div><span>拖曳畫面選落點</span><button id="g3-fire" type="button">撒鈔！ <small>HOLD TO TOSS</small></button></div></div>
 <p id="g3-notice" class="small-note">紙鈔與表情為諷刺道具，不代表實際金流或犯罪認定。遊戲角色與命中結果不代表立法資料或原話的查證結論。</p>`;
 const $=id=>document.getElementById('g3-'+id),canvas=$('canvas'),ctx=canvas.getContext('2d');
 if(!ctx){$('overlay-copy').textContent='瀏覽器無法顯示遊戲，請使用支援 Canvas 的瀏覽器。';$('start').disabled=true;return;}
 const TAU=Math.PI*2,DURATION=40,keys=new Set(),enemies=[],particles=[],rings=[],shots=[],floaters=[],stars=Array.from({length:66},()=>({x:Math.random(),y:Math.random()*.55,s:.4+Math.random()*1.3}));
 let w=1000,h=600,dpr=1,last=0,visualTime=0,elapsed=0,spawnClock=0,fireClock=0,score=0,combo=0,maxCombo=0,hits=0,missed=0,best=0,running=false,started=false,finished=false,fireHeld=false,pointerDown=false,sound=false,audio=null,playerX=0,playerY=0,shake=0,flash=0,toss=0,aim={x:.5,y:.56},lastHud=-1;
 try{best=Number(localStorage.getItem('smile-breaker-best')||0)||0;}catch{}
 const RUN_VERSION='red-notes-v2';
 let runId='',runStartedAt=0,totalShots=0,targetSequence=0,pauseCount=0;
 const hitEvents=[],shotEvents=[];
 const dispatch=(name,detail)=>document.dispatchEvent(new CustomEvent(name,{detail:{game:'red-notes',version:RUN_VERSION,...detail}}));
 const rand=(a,b)=>a+Math.random()*(b-a),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function rounded(x,y,width,height,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,width,height,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
 function glowLine(points,color,width=2,blur=10){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();}
 function text(t,x,y,size,color='#fff',align='center'){ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`800 ${size}px ui-sans-serif, system-ui, sans-serif`;ctx.fillText(t,x,y);}
 function beep(freq=300,duration=.08,type='square',volume=.035){if(!sound)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.55,audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
 function updateHud(force=false){if(!force&&Math.floor(elapsed*10)===lastHud)return;lastHud=Math.floor(elapsed*10);$('score').textContent=String(score).padStart(6,'0');$('time').textContent=Math.max(0,DURATION-elapsed).toFixed(1);$('time').classList.toggle('g3-urgent',elapsed>30);$('progress').textContent='WAVE '+String(Math.min(4,Math.floor(elapsed/10)+1)).padStart(2,'0');$('combo').textContent=combo>1?`${combo} COMBO!`:combo===1?'NICE TOSS!':started?'TOSS A QUESTION':'READY?';$('combo').classList.toggle('g3-hot',combo>=5);$('best').textContent='BEST '+String(best).padStart(6,'0');}
 function overlay(mode){$('overlay').hidden=false;const ending=mode==='finish',pause=mode==='pause';$('kicker').textContent=ending?'TIME UP / PLAY AGAIN':pause?'TAKE A BREATH':'GRAB A HANDFUL';$('overlay-title').innerHTML=ending?`<span class="g3-result-score">${score.toLocaleString()}</span><br><em>${maxCombo>=10?'連擊高手！':hits>=15?'面具收割機！':'再來一局？'}</em>`:pause?'暫停一下。<br><em>等等繼續撒鈔。</em>':'笑容滿面。<br><em>撒出問號！</em>';$('overlay-copy').textContent=ending?`命中 ${hits} 個面具 · 最高 ${maxCombo} 連擊 · 擦身而過 ${missed} 次` :pause?'你的位置與分數已保留。': '紅紙鈔轉啊轉，面具飛啊飛。按住連撒，讓問號一張張飛到笑容前。';$('start').innerHTML=ending?'再玩一次 <span>↻</span>':pause?'繼續撒鈔 <span>▶</span>':'開始撒鈔 <span>▶</span>';$('toggle').textContent=pause?'繼續 ▶':'暫停 ⏸';}
 function play(){const fresh=!started||finished;if(fresh){reset();runId=globalThis.crypto?.randomUUID?.()||('run-'+Date.now()+'-'+Math.random().toString(36).slice(2));runStartedAt=Date.now();dispatch('arcade:start',{runId,durationMs:DURATION*1000,startedAt:new Date(runStartedAt).toISOString()});}running=true;started=true;finished=false;$('overlay').hidden=true;$('toggle').textContent='暫停 ⏸';canvas.focus({preventScroll:true});if(sound)beep(600,.15,'triangle');}
 function pause(){if(!running)return;pauseCount++;running=false;keys.clear();fireHeld=false;pointerDown=false;overlay('pause');}
 function reset(){hitEvents.length=shotEvents.length=0;totalShots=targetSequence=pauseCount=0;runId='';runStartedAt=0;enemies.length=particles.length=rings.length=shots.length=floaters.length=0;elapsed=0;spawnClock=.02;fireClock=0;score=combo=maxCombo=hits=missed=0;playerX=playerY=0;shake=flash=toss=0;aim={x:.5,y:.56};running=false;started=false;finished=false;keys.clear();fireHeld=false;pointerDown=false;lastHud=-1;updateHud(true);overlay('intro');}
 function finish(){if(finished)return;elapsed=DURATION;running=false;finished=true;fireHeld=false;pointerDown=false;keys.clear();if(score>best){best=score;try{localStorage.setItem('smile-breaker-best',String(best));}catch{}}updateHud(true);overlay('finish');beep(180,.25,'triangle');dispatch('arcade:finish',{runId,score,hits,shots:totalShots,maxCombo,missed,durationMs:Math.round(elapsed*1000),wallDurationMs:Math.max(0,Date.now()-runStartedAt),pauseCount,startedAt:new Date(runStartedAt).toISOString(),endedAt:new Date().toISOString(),hitEvents:hitEvents.map(e=>({...e})),shotEvents:shotEvents.map(e=>({...e}))});}
 function spawn(){const wave=Math.floor(elapsed/10),initial=hits===0&&elapsed<1.5&&enemies.length===0;enemies.push({id:++targetSequence,lane:initial?0:rand(-.91,.91),z:initial?.53:1.05,phase:rand(0,TAU),speed:rand(.13,.19)+wave*.024,mask:true,hit:0,angle:0,vx:0,variant:Math.random()>.5?0:1,tag:Math.floor(Math.random()*3)});}
 function project(e){const z=clamp(e.z,0,1.15),near=1-clamp(z,0,1),scale=(.18+near*1.5)*Math.min(w/720,h/590);return{x:w*.5+e.lane*w*(.15+near*.42)-playerX*w*.075*(.2+near),y:h*.43+Math.pow(near,1.4)*h*.58+Math.sin(e.phase+visualTime*3)*5*scale,scale};}
 function drawGlasses(y,color='#292c35'){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2.6;
  for(const x of [-34,3]){ctx.beginPath();ctx.roundRect(x,y-11,31,23,7);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(-3,y-3);ctx.quadraticCurveTo(0,y-6,3,y-3);ctx.moveTo(-34,y-4);ctx.lineTo(-40,y-8);ctx.moveTo(34,y-4);ctx.lineTo(40,y-8);ctx.stroke();ctx.restore();
 }
 function drawMask(x,y,scale,rotation=0,opacity=1){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.globalAlpha=opacity;
  ctx.shadowColor='#ffd0a5';ctx.shadowBlur=6;ctx.fillStyle='#f6ccaa';ctx.strokeStyle='#dcaa85';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(0,0,39,46,0,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  drawGlasses(-7);ctx.strokeStyle='#3c3236';ctx.lineWidth=2.5;
  for(const ex of [-18,18]){ctx.beginPath();ctx.arc(ex,-9,5,Math.PI,TAU);ctx.stroke();}
  ctx.fillStyle='#e7a58d';ctx.beginPath();ctx.ellipse(-26,10,6,3.6,0,0,TAU);ctx.ellipse(26,10,6,3.6,0,0,TAU);ctx.fill();
  ctx.fillStyle='#723c3b';ctx.beginPath();ctx.moveTo(-18,15);ctx.quadraticCurveTo(0,43,18,15);ctx.quadraticCurveTo(0,24,-18,15);ctx.fill();
  ctx.fillStyle='#fff9e9';ctx.beginPath();ctx.moveTo(-15,17);ctx.quadraticCurveTo(0,24,15,17);ctx.lineTo(10,24);ctx.quadraticCurveTo(0,28,-10,24);ctx.closePath();ctx.fill();ctx.restore();
 }
 function drawShortHair(){
  ctx.save();ctx.fillStyle='#222632';ctx.strokeStyle='#151c28';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(-43,-179);ctx.quadraticCurveTo(-53,-199,-39,-216);ctx.quadraticCurveTo(-36,-232,-22,-228);ctx.lineTo(-17,-238);ctx.lineTo(-10,-229);ctx.quadraticCurveTo(1,-245,10,-230);ctx.quadraticCurveTo(24,-239,29,-225);ctx.quadraticCurveTo(46,-229,44,-212);ctx.quadraticCurveTo(55,-200,42,-178);ctx.lineTo(36,-190);ctx.quadraticCurveTo(36,-202,23,-207);ctx.quadraticCurveTo(13,-197,1,-196);ctx.quadraticCurveTo(14,-208,10,-214);ctx.quadraticCurveTo(-7,-194,-24,-192);ctx.quadraticCurveTo(-35,-186,-36,-172);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#424956';ctx.lineWidth=1.7;ctx.lineCap='round';
  [[-33,-212],[-17,-221],[0,-226],[18,-220],[33,-208]].forEach(([x,y],i)=>{ctx.beginPath();ctx.moveTo(x-6,y+7);ctx.bezierCurveTo(x-10,y-5,x+9,y-7,x+5,y+3);ctx.stroke();});
  ctx.strokeStyle='#363e4d';ctx.beginPath();ctx.moveTo(-43,-191);ctx.quadraticCurveTo(-45,-211,-30,-219);ctx.moveTo(35,-188);ctx.quadraticCurveTo(44,-198,36,-211);ctx.stroke();ctx.restore();
 }
 function sailorTorso(){
  ctx.beginPath();ctx.moveTo(-34,-127);ctx.quadraticCurveTo(-49,-119,-49,-91);ctx.lineTo(-44,-38);ctx.quadraticCurveTo(0,-29,44,-38);ctx.lineTo(49,-91);ctx.quadraticCurveTo(49,-119,34,-127);ctx.closePath();
 }
 function drawStripedPolo(){
  ctx.save();sailorTorso();ctx.fillStyle='#f5f1e7';ctx.fill();ctx.strokeStyle='#25364a';ctx.lineWidth=1.8;ctx.stroke();ctx.clip();
  ctx.strokeStyle='#24384f';ctx.lineWidth=3.5;
  for(let y=-116;y<-35;y+=9){ctx.beginPath();ctx.moveTo(-57,y);ctx.quadraticCurveTo(0,y+3,57,y);ctx.stroke();}
  ctx.restore();
  // Short sleeves keep the same fine navy stripes as the shirt.
  for(const side of [-1,1]){ctx.save();ctx.scale(side,1);ctx.fillStyle='#f4f0e5';ctx.strokeStyle='#24384f';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(31,-128);ctx.lineTo(49,-128);ctx.quadraticCurveTo(62,-125,69,-105);ctx.lineTo(49,-94);ctx.lineTo(35,-111);ctx.closePath();ctx.fill();ctx.stroke();ctx.clip();ctx.lineWidth=3.2;for(let y=-123;y<-95;y+=8){ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(74,y+3);ctx.stroke();}ctx.restore();}
  // Polo collar, then a tied orange neckerchief with two separate tails.
  ctx.fillStyle='#fff9ee';ctx.strokeStyle='#b4b4a5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-23,-131);ctx.lineTo(-6,-116);ctx.lineTo(-15,-103);ctx.lineTo(-33,-123);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(23,-131);ctx.lineTo(6,-116);ctx.lineTo(15,-103);ctx.lineTo(33,-123);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#f47b31';ctx.beginPath();ctx.moveTo(-27,-134);ctx.lineTo(-10,-122);ctx.lineTo(2,-109);ctx.lineTo(-13,-109);ctx.lineTo(-31,-127);ctx.closePath();ctx.fill();ctx.fillStyle='#ff9840';ctx.beginPath();ctx.moveTo(27,-134);ctx.lineTo(31,-126);ctx.lineTo(12,-109);ctx.lineTo(-1,-109);ctx.lineTo(10,-122);ctx.closePath();ctx.fill();
  ctx.fillStyle='#e75b25';ctx.beginPath();ctx.moveTo(-1,-108);ctx.quadraticCurveTo(-10,-91,-3,-69);ctx.lineTo(8,-82);ctx.lineTo(8,-108);ctx.closePath();ctx.fill();ctx.fillStyle='#ff8c36';ctx.beginPath();ctx.moveTo(5,-108);ctx.quadraticCurveTo(16,-94,21,-85);ctx.lineTo(11,-84);ctx.lineTo(-1,-104);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ff9b47';ctx.beginPath();ctx.ellipse(2,-110,8,7,-.3,0,TAU);ctx.fill();ctx.strokeStyle='#c84d23';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-1,-106);ctx.lineTo(3,-113);ctx.stroke();ctx.fillStyle='#ffe9cf';for(const [x,y]of [[-18,-126],[19,-126],[0,-86]]){ctx.save();ctx.translate(x,y);ctx.rotate(-.4);ctx.fillRect(-2,-2,4,2);ctx.fillRect(-2,1,4,1);ctx.restore();}
 }
 function drawSailorGesture(variant,phase,hit){
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';const wave=Math.sin(visualTime*4+phase),salute=variant===1;
  const elbow={x:80,y:-145},wrist=salute?{x:43,y:-189}:{x:68+wave*3,y:-205};
  ctx.strokeStyle='#b77e62';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(61,-107);ctx.lineTo(elbow.x,elbow.y);ctx.lineTo(wrist.x,wrist.y);ctx.stroke();ctx.strokeStyle='#edbd99';ctx.lineWidth=15;ctx.stroke();
  // A small black wrist strap echoes the photo without competing with the scarf.
  ctx.save();ctx.translate(wrist.x+(salute?5:1),wrist.y+8);ctx.rotate(salute?-.75:.12);rounded(-8,-4,16,8,2,'#1d2d3b');ctx.fillStyle='#334a5b';ctx.fillRect(-3,-4,7,7);ctx.restore();
  ctx.translate(wrist.x,wrist.y);ctx.rotate(salute?-.12:wave*.1-.15);ctx.fillStyle='#efc29e';ctx.strokeStyle='#efc29e';
  if(salute){ctx.beginPath();ctx.moveTo(4,3);ctx.quadraticCurveTo(-12,0,-29,-8);ctx.quadraticCurveTo(-34,-13,-29,-14);ctx.lineTo(-7,-9);ctx.lineTo(4,-6);ctx.closePath();ctx.fill();ctx.strokeStyle='#c69376';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-10,-4);ctx.lineTo(-28,-10);ctx.stroke();}
  else{ctx.beginPath();ctx.ellipse(-2,-7,10,13,-.15,0,TAU);ctx.fill();ctx.lineWidth=4.4;for(const [x1,y1,x2,y2]of [[-8,-13,-15,-26],[-3,-17,-6,-34],[2,-17,3,-35],[7,-14,12,-29],[-10,-3,-22,-12]]){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}}
  ctx.restore();
 }
 function drawCharacter(e,demo=false){
  const p=project(e),s=p.scale,hit=e.hit>0;ctx.save();ctx.translate(p.x,p.y-(hit?e.hit*155*s:0));ctx.rotate(hit?e.angle:Math.sin(visualTime*2+e.phase)*.025);ctx.scale(s,s);if(hit)ctx.globalAlpha=Math.max(0,1-e.hit/1.08);
  const stride=Math.sin(visualTime*9+e.phase)*12;ctx.lineCap='round';ctx.strokeStyle='#253044';ctx.lineWidth=21;ctx.beginPath();ctx.moveTo(-20,-40);ctx.lineTo(-27-stride*.3,-14);ctx.lineTo(-37-stride,8);ctx.moveTo(20,-40);ctx.lineTo(28+stride*.3,-15);ctx.lineTo(35+stride,8);ctx.stroke();ctx.strokeStyle='#f1eee6';ctx.lineWidth=11;ctx.beginPath();ctx.moveTo(-42-stride,9);ctx.lineTo(-26-stride,9);ctx.moveTo(30+stride,9);ctx.lineTo(47+stride,9);ctx.stroke();
  ctx.strokeStyle='#bd896d';ctx.lineWidth=17;ctx.beginPath();ctx.moveTo(-54,-102);ctx.lineTo(-62,-72+stride*.15);ctx.lineTo(-54,-47);ctx.stroke();ctx.strokeStyle='#edbd99';ctx.lineWidth=14;ctx.stroke();ctx.fillStyle='#efc29e';ctx.beginPath();ctx.ellipse(-54,-44,8,10,-.2,0,TAU);ctx.fill();
  ctx.fillStyle='#e7ae8b';ctx.fillRect(-13,-141,26,24);drawStripedPolo();
  // Short tousled hair, rectangular spectacles and striped polo follow the supplied photos.
  ctx.fillStyle='#232937';ctx.beginPath();ctx.ellipse(0,-187,46,46,0,0,TAU);ctx.fill();
  ctx.fillStyle=hit?'#ed997f':'#eabd96';ctx.beginPath();ctx.ellipse(0,-166,39,46,0,0,TAU);ctx.fill();
  ctx.beginPath();ctx.ellipse(-40,-165,6,10,-.1,0,TAU);ctx.ellipse(40,-165,6,10,.1,0,TAU);ctx.fill();
  drawGlasses(-173);ctx.strokeStyle='#342c35';ctx.lineWidth=4;
  if(hit){ctx.fillStyle='#342c35';for(const x of [-18,18]){ctx.beginPath();ctx.ellipse(x,-172,3.8,4.3,0,0,TAU);ctx.fill();}ctx.beginPath();ctx.moveTo(-30,-190);ctx.lineTo(-8,-183);ctx.moveTo(30,-190);ctx.lineTo(8,-183);ctx.stroke();ctx.fillStyle='#482735';ctx.beginPath();ctx.ellipse(0,-142,16,12,0,0,TAU);ctx.fill();ctx.fillStyle='#fff4de';ctx.fillRect(-12,-150,24,6);ctx.strokeStyle='#e34660';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(27,-209);ctx.lineTo(32,-199);ctx.lineTo(42,-204);ctx.stroke();}
  else{ctx.lineWidth=2.5;for(const x of [-18,18]){ctx.beginPath();ctx.arc(x,-175,5,Math.PI,TAU);ctx.stroke();}}
  if(e.mask)drawMask(0,-166,1,Math.sin(visualTime*2+e.phase)*.025);
  drawShortHair();drawSailorGesture(e.variant,e.phase,hit);
  if(hit)text(e.tag===0?'！':e.tag===1?'!!':'?!',54,-222,32,'#ffe278');ctx.restore();
  if(!hit&&!demo){ctx.save();ctx.globalAlpha=.25+Math.sin(visualTime*4+e.phase)*.08;ctx.strokeStyle='#50ffd6';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+14*s,51*s,13*s,0,0,TAU);ctx.stroke();ctx.restore();}
 }
 function hitTarget(e,shotId){
  if(!e||!enemies.includes(e)||!e.mask||e.hit!==0)return;
  const p=project(e);e.mask=false;e.hit=.001;e.vx=(p.x-w/2)*.002+rand(-.5,.5);e.angle=rand(-.14,.14);hits++;combo++;maxCombo=Math.max(maxCombo,combo);
  const multiplier=Math.min(5,1+Math.floor(combo/4)),earned=100*multiplier;score+=earned;hitEvents.push({t:Math.round(elapsed*1000),delta:earned,combo,score,shotId,targetId:e.id});shake=3+Math.min(5,combo*.3);flash=.075;
  floaters.push({x:p.x,y:p.y-215*p.scale,text:`+${earned}`,life:1,color:combo>=5?'#ffe36f':'#ffd9c3'});
  if(combo>1&&combo%5===0)floaters.push({x:w*.5,y:h*.32,text:`${combo} COMBO!`,life:1.3,color:'#ffd075',big:true});
  particles.push({type:'mask',x:p.x,y:p.y-166*p.scale,vx:(Math.random()<.5?-1:1)*rand(250,370),vy:-275,rot:0,spin:rand(-5,5),scale:p.scale,life:1.05});
  for(let i=0;i<12;i++)particles.push({type:'paper',x:p.x,y:p.y-166*p.scale,vx:rand(-190,190),vy:rand(-240,70),life:rand(.6,1.1),rot:rand(-3,3),spin:rand(-6,6),scale:rand(.17,.3)});
  rings.push({x:p.x,y:p.y-166*p.scale,life:.34,color:'#ffc6a2',size:25});beep(200+combo*10,.1,'triangle',.04);updateHud(true);
 }
 function attack(){
  if(!running||fireClock>0)return;fireClock=.18;toss=1;
  const x=aim.x*w,y=aim.y*h;
  const choices=enemies.filter(e=>e.mask&&e.hit===0).map(e=>{const p=project(e),rx=Math.max(34,65*p.scale),ry=Math.max(40,119*p.scale);return{e,d:Math.hypot((x-p.x)/rx,(y-p.y+132*p.scale)/ry)};}).filter(v=>v.d<1.26).sort((a,b)=>a.e.z-b.e.z||a.d-b.d);
  // Real travelling paper replaces the old instant beam. Only the centre note resolves a hit.
  totalShots++;shotEvents.push({id:totalShots,t:Math.round(elapsed*1000),x:Number(aim.x.toFixed(4)),y:Number(aim.y.toFixed(4)),targetId:choices[0]?.e.id||null});
  shots.push({id:totalShots,sx:w*.5+playerX*w*.24,sy:h*.93,x,y,age:0,duration:.3+Math.hypot(x-w*.5,y-h*.93)/Math.max(w,h)*.17,target:choices[0]?.e,seed:rand(0,TAU)});
  beep(340,.045,'triangle',.022);
 }
 function simulation(dt){elapsed+=dt;fireClock=Math.max(0,fireClock-dt);spawnClock-=dt;const wave=Math.floor(elapsed/10);if(spawnClock<=0){spawn();spawnClock=Math.max(.39,.95-wave*.15)+rand(0,.15);}const dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));if(dx||dy){aim.x=clamp(aim.x+dx*dt*.7,.07,.93);aim.y=clamp(aim.y+dy*dt*.6,.23,.86);}playerX+=(clamp((aim.x-.5)*2,-1,1)-playerX)*dt*5;playerY+=(clamp((aim.y-.55)*2,-1,1)-playerY)*dt*4;if(fireHeld||pointerDown||keys.has('Space'))attack();for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.hit>0){e.hit+=dt;e.lane+=e.vx*dt;e.angle+=e.vx*dt*.5;if(e.hit>1.08)enemies.splice(i,1);}else{e.z-=e.speed*dt;if(e.z<-.09){enemies.splice(i,1);missed++;combo=0;floaters.push({x:w*.5,y:h*.4,text:'擦身而過',life:.7,color:'#dfc8ed'});updateHud(true);}}}if(elapsed>=DURATION)finish();updateHud();}
 function effects(dt){
  shake=Math.max(0,shake-dt*40);flash=Math.max(0,flash-dt);toss=Math.max(0,toss-dt*5);
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=350*dt;if(p.type==='mask'||p.type==='paper')p.rot+=p.spin*dt;if(p.life<=0)particles.splice(i,1);}
  for(let i=shots.length-1;i>=0;i--){const p=shots[i];p.age+=dt;if(p.age>=p.duration){if(running)hitTarget(p.target,p.id);for(let j=0;j<3;j++)particles.push({type:'paper',x:p.x+rand(-15,15),y:p.y+rand(-10,10),vx:rand(-55,55),vy:rand(-60,15),rot:rand(-3,3),spin:rand(-4,4),scale:.28,life:.6});shots.splice(i,1);}}
  for(const list of [rings,floaters])for(let i=list.length-1;i>=0;i--){list[i].life-=dt;if(list===floaters)list[i].y-=dt*38;if(list[i].life<=0)list.splice(i,1);}
 }
 function background(){const horizon=h*.39,g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0c1027');g.addColorStop(.42,'#2d1a48');g.addColorStop(.43,'#152139');g.addColorStop(1,'#071e2a');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.save();for(const s of stars){ctx.globalAlpha=.3+.5*(.5+.5*Math.sin(visualTime+s.x*20));ctx.fillStyle='#d2f9ff';ctx.fillRect(s.x*w,s.y*h*.6,s.s,s.s);}ctx.globalAlpha=1;ctx.save();ctx.beginPath();ctx.rect(0,0,w,horizon);ctx.clip();ctx.translate(w*.5-playerX*18,horizon*.79);const sun=ctx.createLinearGradient(0,-h*.2,0,h*.15);sun.addColorStop(0,'#ffce86');sun.addColorStop(1,'#fa6d8f');ctx.fillStyle=sun;ctx.beginPath();ctx.arc(0,0,h*.16,0,TAU);ctx.fill();ctx.fillStyle='#321a48';for(let y=2;y<h*.2;y+=13)ctx.fillRect(-h*.17,y,h*.34,5+y*.025);ctx.restore();
  for(let i=0;i<18;i++){const bw=w/17,bh=(.045+((i*37)%11)/130)*h,x=i*bw-playerX*8,y=horizon-bh;ctx.fillStyle=i%2?'#131f35':'#182039';ctx.fillRect(x,y,bw*.9,bh);ctx.fillStyle='#489b9d66';for(let j=0;j<4;j++)ctx.fillRect(x+7+j*bw*.18,y+10,3,Math.max(3,bh*.4));}glowLine([[0,horizon],[w,horizon]],'#fd87ab',2,12);ctx.save();ctx.beginPath();ctx.rect(0,horizon,w,h-horizon);ctx.clip();const vanish=w*.5-playerX*35;for(let i=-12;i<=12;i++)glowLine([[vanish+i*15,horizon],[w*.5+i*w*.14-playerX*w*.09,h]],i===-3||i===3?'#e8787e55':'#32bda147',1,2);const flow=(visualTime*(running?2.2:.45))%1;for(let i=0;i<18;i++){const n=(i+flow)/18,y=horizon+Math.pow(n,2.7)*(h-horizon);glowLine([[0,y],[w,y]],'#4beac36b',1,3);}ctx.restore();ctx.restore();}
 function drawPaperNote(x,y,scale,rotation=0,fold=1,opacity=1){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(scale*Math.max(.25,fold),scale);ctx.globalAlpha=opacity;
  ctx.shadowColor='#2a101b99';ctx.shadowBlur=7;ctx.shadowOffsetY=3;
  rounded(-41,-21,82,42,3,'#bd3949','#f7b7a0');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle='#f5a68a';ctx.lineWidth=1.2;ctx.strokeRect(-36,-16,72,32);
  ctx.fillStyle='#ef886f';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*33,-13);ctx.lineTo(side*25,-13);ctx.lineTo(side*33,-5);ctx.fill();ctx.beginPath();ctx.moveTo(side*33,13);ctx.lineTo(side*25,13);ctx.lineTo(side*33,5);ctx.fill();}
  ctx.fillStyle='#d5515a';ctx.beginPath();ctx.ellipse(0,0,14,16,0,0,TAU);ctx.fill();
  text('?',0,8,26,'#ffe8c7');text('道具',-25,3,7,'#ffe6cd');text('道具',25,3,7,'#ffe6cd');
  ctx.strokeStyle='#f9b09d66';ctx.beginPath();ctx.moveTo(-5,-19);ctx.quadraticCurveTo(5,0,1,20);ctx.stroke();ctx.restore();
 }
 function drawTossingHand(){
  const x=w*.5+playerX*w*.24,y=h*.99-toss*13,s=Math.min(w/800,h/570)*.9;
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.rotate(playerX*.08-toss*.12);
  // Navy sleeve and an open hand, with a visibly fanned stack of prop notes.
  rounded(-26,30,66,68,10,'#24384f','#56717d');ctx.fillStyle='#e6b08e';ctx.strokeStyle='#b67864';ctx.lineWidth=1.8;
  ctx.beginPath();ctx.moveTo(-23,37);ctx.lineTo(-30,7);ctx.quadraticCurveTo(-41,-5,-32,-12);ctx.quadraticCurveTo(-26,-16,-18,-4);ctx.lineTo(-20,-27);ctx.quadraticCurveTo(-20,-38,-12,-36);ctx.lineTo(-5,-14);ctx.lineTo(0,-35);ctx.quadraticCurveTo(5,-42,10,-34);ctx.lineTo(14,-13);ctx.lineTo(19,-29);ctx.quadraticCurveTo(27,-35,30,-25);ctx.lineTo(31,1);ctx.quadraticCurveTo(48,0,44,13);ctx.lineTo(30,38);ctx.closePath();ctx.fill();ctx.stroke();
  for(let i=-2;i<=2;i++)drawPaperNote(i*13,-27-Math.abs(i)*2,.74,i*.19-toss*.07,1,1);
  ctx.fillStyle='#eac09d';ctx.strokeStyle='#b67864';ctx.beginPath();ctx.moveTo(-19,12);ctx.quadraticCurveTo(-6,-4,10,-2);ctx.quadraticCurveTo(22,3,10,9);ctx.lineTo(-4,18);ctx.quadraticCurveTo(-12,25,-19,12);ctx.fill();ctx.stroke();ctx.restore();
 }
 function drawFlyingNotes(){
  for(const p of shots){
   const t=clamp(p.age/p.duration,0,1),ease=1-Math.pow(1-t,1.4);
   for(let i=-1;i<=1;i++){
    const spread=Math.sin(t*Math.PI)*(i*40+Math.sin(t*9+p.seed)*9);
    const x=p.sx+(p.x-p.sx)*ease+spread,y=p.sy+(p.y-p.sy)*ease-Math.sin(t*Math.PI)*(54+i*9);
    const scale=(.75-t*.4)*Math.min(1,w/620+.25),spin=p.seed+i*.7+t*(i===0?5:-7);
    drawPaperNote(x,y,scale,spin,.3+Math.abs(Math.cos(t*7+i))*.7,1);
   }
  }
 }
 function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));background();if(!started){[{lane:-.7,z:.4,phase:0,mask:true,hit:0,variant:0},{lane:.65,z:.55,phase:2,mask:true,hit:0,variant:1},{lane:0,z:.25,phase:1,mask:true,hit:0,variant:1}].sort((a,b)=>b.z-a.z).forEach(e=>drawCharacter(e,true));}else [...enemies].sort((a,b)=>b.z-a.z).forEach(e=>drawCharacter(e));
  drawFlyingNotes();rings.forEach(r=>{ctx.save();const t=r.life/.34;ctx.globalAlpha=t;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=14;ctx.lineWidth=3*t;ctx.beginPath();ctx.ellipse(r.x,r.y,r.size+(1-t)*60,r.size*.45+(1-t)*28,0,0,TAU);ctx.stroke();ctx.restore();});particles.forEach(p=>{if(p.type==='mask')drawMask(p.x,p.y,p.scale,p.rot,Math.min(1,p.life*2));else if(p.type==='paper')drawPaperNote(p.x,p.y,p.scale,p.rot,.55+Math.abs(Math.cos(p.rot))*.45,Math.min(1,p.life*2));});drawTossingHand();floaters.forEach(f=>{ctx.save();ctx.globalAlpha=Math.min(1,f.life*2);ctx.shadowColor=f.color;ctx.shadowBlur=15;text(f.text,f.x,f.y,f.big?Math.min(w*.07,54):Math.min(w*.035,28),f.color);ctx.restore();});
  if(started&&!finished){const x=aim.x*w,y=aim.y*h;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(visualTime*2)*.05);ctx.strokeStyle='#ffcbb2';ctx.lineWidth=2;ctx.setLineDash([5,5]);rounded(-21,-17,42,34,4,null,'#ffcbb2');ctx.setLineDash([]);text('?',0,7,19,'#ffe1bc');ctx.restore();}if(flash>0){ctx.fillStyle=`rgba(255,220,160,${flash*.65})`;ctx.fillRect(0,0,w,h);}ctx.restore();}
 function resize(){const box=canvas.getBoundingClientRect();w=Math.max(280,box.width);h=Math.max(300,box.height);dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 function pointerAim(e){const b=canvas.getBoundingClientRect();aim.x=clamp((e.clientX-b.left)/b.width,.03,.97);aim.y=clamp((e.clientY-b.top)/b.height,.15,.91);}
 canvas.addEventListener('pointermove',e=>{if(running)pointerAim(e);});canvas.addEventListener('pointerdown',e=>{if(!running)return;e.preventDefault();canvas.focus({preventScroll:true});pointerAim(e);pointerDown=true;canvas.setPointerCapture(e.pointerId);attack();});canvas.addEventListener('pointerup',()=>pointerDown=false);canvas.addEventListener('pointercancel',()=>pointerDown=false);canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')pointerDown=false;});
 $('start').onclick=play;$('toggle').onclick=()=>{if(running)pause();else play();};$('reset').onclick=()=>{reset();play();};$('sound').onclick=()=>{sound=!sound;$('sound').textContent='音效：'+(sound?'開':'關');$('sound').setAttribute('aria-pressed',String(sound));if(sound)beep(700,.12,'triangle');};
 function holdButton(button,on,off){button.addEventListener('pointerdown',e=>{e.preventDefault();if(!running)play();button.setPointerCapture(e.pointerId);on();});button.addEventListener('pointerup',off);button.addEventListener('pointercancel',off);button.addEventListener('lostpointercapture',off);}
 holdButton($('fire'),()=>{fireHeld=true;attack();},()=>fireHeld=false);root.querySelectorAll('[data-g3-move]').forEach(b=>{const key=b.dataset.g3Move==='left'?'ArrowLeft':'ArrowRight';holdButton(b,()=>keys.add(key),()=>keys.delete(key));});
 document.addEventListener('keydown',e=>{if(!root.contains(document.activeElement)||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Escape'].includes(e.code)){e.preventDefault();if(e.code==='Escape'){if(running)pause();return;}if(e.code==='Space'&&!running){play();return;}if(running){keys.add(e.code);if(e.code==='Space')attack();}}});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 new ResizeObserver(resize).observe(canvas);resize();updateHud(true);const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&running)pause();},{threshold:.04});observer.observe(canvas);
 function frame(now){const dt=Math.min(.04,(now-last)/1000||0);last=now;visualTime+=dt;if(running){simulation(dt);effects(dt);}if(!document.hidden)draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
