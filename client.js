(()=>{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const troopCards={
 swordsman:{name:'Swordsman',icon:'⚔️',cost:3,hp:100,speed:60,damage:18,size:12,desc:'Balanced fighter'},
 shield:{name:'Shieldbearer',icon:'🛡️',cost:4,hp:215,speed:36,damage:10,size:15,desc:'Absorbs tower fire'},
 runner:{name:'Runner',icon:'🏃',cost:2,hp:55,speed:108,damage:8,size:10,desc:'Fast pressure'},
 brute:{name:'Brute',icon:'🪓',cost:6,hp:330,speed:28,damage:42,size:18,desc:'Castle breaker'},
 archer:{name:'Archer',icon:'🏹',cost:3,hp:70,speed:52,damage:15,size:11,desc:'Efficient raider'},
 medic:{name:'Medic',icon:'✨',cost:4,hp:85,speed:47,damage:5,size:11,heal:11,desc:'Heals nearby allies'},
 saboteur:{name:'Saboteur',icon:'💣',cost:4,hp:78,speed:70,damage:30,size:11,desc:'Burst pressure'},
 commander:{name:'Commander',icon:'👑',cost:5,hp:145,speed:44,damage:20,size:14,desc:'Boosts nearby troops'}
};
const towerCards={
 archerTower:{name:'Archer Tower',icon:'🏹',cost:3,hp:150,damage:12,range:155,rate:.72,desc:'Reliable defense'},
 cannon:{name:'Cannon',icon:'💥',cost:4,hp:190,damage:28,range:138,rate:1.4,desc:'Heavy single hit'},
 rapid:{name:'Rapid Tower',icon:'⚡',cost:3,hp:120,damage:6,range:128,rate:.30,desc:'Stops light troops'},
 frost:{name:'Frost Tower',icon:'❄️',cost:4,hp:135,damage:7,range:145,rate:.92,slow:.68,desc:'Slows troop waves'},
 bomb:{name:'Bomb Tower',icon:'💣',cost:5,hp:175,damage:18,range:125,rate:1.18,splash:52,desc:'Area damage'},
 sniper:{name:'Sniper Tower',icon:'🎯',cost:5,hp:95,damage:39,range:225,rate:1.85,desc:'Long-range finisher'},
 barricade:{name:'Barricade',icon:'🧱',cost:2,hp:260,damage:0,range:0,rate:99,desc:'Cheap distraction'},
 supply:{name:'Supply Post',icon:'📦',cost:4,hp:110,damage:0,range:0,rate:99,income:.13,desc:'Extra defender supply'}
};
let troopDeck=Object.keys(troopCards),towerDeck=Object.keys(towerCards),deckKind='troop',selectedSlot=0;
let socket=null, roomCode=null, onlineRole=null, isHost=false, ready=false, opponentReady=false, online=false;
const cardHTML=(id,d)=>`<button class="game-card" data-card="${id}"><span class="cost">${d.cost}</span><span class="icon">${d.icon}</span><strong>${d.name}</strong><small>${d.desc}</small></button>`;
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}
function renderHomeDeck(){$('#homeDeck').innerHTML=troopDeck.slice(0,4).map(id=>`<div class="mini-card"><b>${troopCards[id].cost}</b>${troopCards[id].icon}</div>`).join('')}
function renderDeck(){const data=deckKind==='troop'?troopCards:towerCards,deck=deckKind==='troop'?troopDeck:towerDeck;$('#deckSlots').innerHTML=deck.map(id=>cardHTML(id,data[id])).join('');$$('#deckSlots .game-card').forEach((b,i)=>{b.classList.toggle('selected',i===selectedSlot);b.onclick=()=>{selectedSlot=i;renderDeck()}});$('#collection').innerHTML=Object.keys(data).map(id=>cardHTML(id,data[id])).join('');$$('#collection .game-card').forEach(b=>b.onclick=()=>{const d=deckKind==='troop'?troopDeck:towerDeck,idx=d.indexOf(b.dataset.card);[d[selectedSlot],d[idx]]=[d[idx],d[selectedSlot]];renderDeck();renderHomeDeck();toast('Deck updated')});$('#averageCost').textContent=(deck.reduce((a,id)=>a+data[id].cost,0)/deck.length).toFixed(1)}
$$('.deck-tab').forEach(b=>b.onclick=()=>{$$('.deck-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');deckKind=b.dataset.kind;selectedSlot=0;renderDeck()});
function showView(id){$$('.view').forEach(v=>v.classList.remove('active'));$('#'+id).classList.add('active');$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$('.navbar').classList.toggle('hidden',id==='matchView')}
$$('.nav-btn').forEach(b=>b.onclick=()=>showView(b.dataset.view));
setTimeout(()=>{$('#loading').classList.add('hidden');$('#app').classList.remove('hidden')},1350);

const canvas=$('#battlefield'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
const path=[{x:55,y:75},{x:270,y:75},{x:360,y:145},{x:820,y:145},{x:965,y:225},{x:880,y:330},{x:420,y:330},{x:240,y:430},{x:520,y:530},{x:1025,y:530}];
const spots=[{x:500,y:72},{x:730,y:232},{x:1010,y:340},{x:590,y:410},{x:270,y:350},{x:720,y:585},{x:885,y:455},{x:390,y:230}];
const totalPath=path.slice(0,-1).reduce((l,a,i)=>l+Math.hypot(path[i+1].x-a.x,path[i+1].y-a.y),0);
function posOnPath(d){let r=d;for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],s=Math.hypot(b.x-a.x,b.y-a.y);if(r<=s){const t=r/s;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)}}r-=s}return {...path.at(-1),angle:0}}
let match=null,raf=0,last=0,snapshotTimer=0;
function freshMatch(role,mode){return{role,mode,time:180,castleHp:600,attackerSupply:5,defenderSupply:6,units:[],towers:[],shots:[],selected:null,ended:false}}
function startMatch(role,mode='local'){showView('matchView');online=mode==='online';match=freshMatch(role,mode);$('#roleBanner').textContent=online?`Online · You are the ${role[0].toUpperCase()+role.slice(1)}`:(role==='local2p'?'Local 2-Player Duel':`You are the ${role}`);$('#leftName').textContent=online?(role==='attacker'?'You · Attacker':'Friend · Attacker'):(role==='local2p'?'Friend 1 · Attacker':'Attacker');$('#rightName').textContent=online?(role==='defender'?'You · Defender':'Friend · Defender'):(role==='local2p'?'Friend 2 · Defender':'Defender');$('#soloControls').classList.toggle('hidden',role==='local2p');$('#twoPlayerControls').classList.toggle('hidden',role!=='local2p');$('#swapRole').classList.toggle('hidden',online||role==='local2p');if(role==='local2p')renderTwoPlayerHands();else renderHand();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)}
function renderHand(){if(!match)return;const role=match.role==='local2p'?'attacker':match.role,deck=role==='attacker'?troopDeck:towerDeck,data=role==='attacker'?troopCards:towerCards;$('#hand').innerHTML=deck.slice(0,4).map(id=>cardHTML(id,data[id])).join('');$$('#hand .game-card').forEach(b=>b.onclick=()=>{if(match.ended)return;if(role==='attacker')doAction({type:'spawn',card:b.dataset.card});else{match.selected=b.dataset.card;$$('#hand .game-card').forEach(x=>x.classList.toggle('selected',x===b));toast('Choose a glowing tower slot')}})}

function renderTwoPlayerHands(){
 $('#attackerHand').innerHTML=troopDeck.slice(0,4).map(id=>cardHTML(id,troopCards[id])).join('');
 $('#defenderHand').innerHTML=towerDeck.slice(0,4).map(id=>cardHTML(id,towerCards[id])).join('');
 $$('#attackerHand .game-card').forEach(b=>b.onclick=()=>{if(match&&!match.ended)applyAction({type:'spawn',card:b.dataset.card});renderTwoPlayerHands()});
 $$('#defenderHand .game-card').forEach(b=>b.onclick=()=>{if(!match||match.ended)return;match.selected=b.dataset.card;$$('#defenderHand .game-card').forEach(x=>x.classList.toggle('selected',x===b));toast('Defender: choose a glowing tower slot')});
}
function cycle(deck,id){const i=deck.indexOf(id);if(i>=0)deck.push(deck.splice(i,1)[0])}
function applyAction(a){if(!match||match.ended)return;if(a.type==='spawn'){const s=troopCards[a.card];if(!s||match.attackerSupply<s.cost)return;match.attackerSupply-=s.cost;match.units.push({type:a.card,hp:s.hp,maxHp:s.hp,d:0,slow:1,healTick:0,castleTick:0});cycle(troopDeck,a.card);if(match.role==='local2p')renderTwoPlayerHands();else if(match.role==='attacker')renderHand()}else if(a.type==='tower'){const s=towerCards[a.card];if(!s||match.defenderSupply<s.cost||match.towers.some(t=>t.spot===a.spot))return;match.defenderSupply-=s.cost;match.towers.push({type:a.card,hp:s.hp,maxHp:s.hp,spot:a.spot,cool:Math.random()*s.rate});cycle(towerDeck,a.card);match.selected=null;if(match.role==='local2p')renderTwoPlayerHands();else if(match.role==='defender')renderHand()}}
function doAction(a){if(online){socket.emit('game-action',{room:roomCode,action:a});if(isHost)applyAction(a)}else applyAction(a)}
canvas.addEventListener('pointerdown',e=>{if(!match||match.ended)return;const role=match.role==='local2p'?'defender':match.role;if(role!=='defender'||!match.selected)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;let best=-1,dist=55;spots.forEach((p,i)=>{const d=Math.hypot(x-p.x,y-p.y);if(d<dist&&!match.towers.some(t=>t.spot===i)){dist=d;best=i}});if(best<0)return toast('Choose an empty slot');doAction({type:'tower',card:match.selected,spot:best})});
function update(dt){if(!match||match.ended||online&&!isHost)return;match.time-=dt;const regen=match.time<=60?1.30:.72;match.attackerSupply=Math.min(10,match.attackerSupply+regen*dt);match.defenderSupply=Math.min(10,match.defenderSupply+(regen*.94)*dt);for(const t of match.towers){const s=towerCards[t.type];if(s.income)match.defenderSupply=Math.min(10,match.defenderSupply+s.income*dt)}
 for(const u of match.units){const s=troopCards[u.type];u.slow=Math.min(1,u.slow+dt*.28);if(u.d<totalPath)u.d=Math.min(totalPath,u.d+s.speed*u.slow*dt);else{u.castleTick-=dt;if(u.castleTick<=0){u.castleTick=1;match.castleHp-=s.damage*(u.buff||1)}}if(u.type==='medic'){u.healTick-=dt;if(u.healTick<=0){u.healTick=1.15;const p=posOnPath(u.d);match.units.forEach(v=>{const q=posOnPath(v.d);if(v.hp>0&&Math.hypot(p.x-q.x,p.y-q.y)<80)v.hp=Math.min(v.maxHp,v.hp+s.heal)})}}}
 for(const u of match.units){u.buff=1;if(match.units.some(c=>c.type==='commander'&&Math.abs(c.d-u.d)<95))u.buff=1.18}
 for(const t of match.towers){const s=towerCards[t.type];t.cool-=dt;if(s.damage<=0||t.cool>0)continue;const p=spots[t.spot];let target=null,best=-1;for(const u of match.units){const q=posOnPath(u.d),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<=s.range&&u.d>best){best=u.d;target=u}}if(target){t.cool=s.rate;const q=posOnPath(target.d);target.hp-=s.damage;if(s.slow)target.slow=Math.min(target.slow,s.slow);if(s.splash)match.units.forEach(u=>{const z=posOnPath(u.d);if(u!==target&&Math.hypot(z.x-q.x,z.y-q.y)<s.splash)u.hp-=s.damage*.42});match.shots.push({x:p.x,y:p.y,tx:q.x,ty:q.y,life:.12})}}
 match.units=match.units.filter(u=>u.hp>0);match.shots.forEach(s=>s.life-=dt);match.shots=match.shots.filter(s=>s.life>0);if(match.castleHp<=0)finish('attacker');else if(match.time<=0)finish('defender')}
function finish(winner){if(!match||match.ended)return;match.ended=true;$('#resultTitle').textContent=(match.role===winner||match.role==='local2p')?'Victory!':'Defeat';$('#resultText').textContent=winner==='attacker'?'The castle has fallen.':'The fortress survived the siege.';$('#resultModal').classList.remove('hidden');if(online&&isHost)socket.emit('game-over',{room:roomCode,winner})}
function draw(){if(!match)return;ctx.clearRect(0,0,W,H);ctx.fillStyle='#9bbc6a';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#4c3d2c';ctx.lineWidth=72;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);path.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.strokeStyle='#c9a86e';ctx.lineWidth=58;ctx.stroke();spots.forEach((p,i)=>{const occ=match.towers.some(t=>t.spot===i);ctx.beginPath();ctx.arc(p.x,p.y,27,0,Math.PI*2);ctx.fillStyle=!occ&&match.role==='defender'&&match.selected?'#fff3a4':'#d8c79c';ctx.fill();ctx.strokeStyle='#4c4334';ctx.lineWidth=3;ctx.stroke()});ctx.font='72px serif';ctx.fillText('🏰',1015,555);ctx.fillStyle='#231f20';ctx.fillRect(1000,465,125,16);ctx.fillStyle='#68b24b';ctx.fillRect(1003,468,119*Math.max(0,match.castleHp/600),10);ctx.textAlign='center';for(const t of match.towers){const p=spots[t.spot],s=towerCards[t.type];ctx.font='42px serif';ctx.fillText(s.icon,p.x,p.y+14)}for(const u of match.units){const p=posOnPath(u.d),s=troopCards[u.type];ctx.save();ctx.translate(p.x,p.y);ctx.scale(Math.cos(p.angle)<0?-1:1,1);ctx.font=`${30+s.size}px serif`;ctx.fillText(s.icon,0,10);ctx.restore();ctx.fillStyle='#222';ctx.fillRect(p.x-18,p.y-28,36,5);ctx.fillStyle='#5fc65a';ctx.fillRect(p.x-17,p.y-27,34*(u.hp/u.maxHp),3)}ctx.strokeStyle='#fff8d6';ctx.lineWidth=4;for(const s of match.shots){ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.tx,s.ty);ctx.stroke()}ctx.textAlign='start'}
function sync(){if(!match)return;const sec=Math.max(0,Math.ceil(match.time));$('#timer').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;$('#castleHp').textContent=Math.max(0,Math.ceil(match.castleHp));if(match.role==='local2p'){$('#attackerResourceText').textContent=match.attackerSupply.toFixed(1)+' / 10';$('#defenderResourceText').textContent=match.defenderSupply.toFixed(1)+' / 10';$('#attackerResourceFill').style.width=match.attackerSupply*10+'%';$('#defenderResourceFill').style.width=match.defenderSupply*10+'%'}else{const val=match.role==='defender'?match.defenderSupply:match.attackerSupply;$('#resourceText').textContent=`${val.toFixed(1)} / 10`;$('#resourceFill').style.width=val*10+'%'}$('#attackerSupplyTop').textContent='Supply '+match.attackerSupply.toFixed(1)}
function loop(now){const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);if(online&&isHost&&match&&!match.ended){snapshotTimer-=dt;if(snapshotTimer<=0){snapshotTimer=.08;socket.emit('state',{room:roomCode,state:match})}}draw();sync();raf=requestAnimationFrame(loop)}

function ensureSocket(){
 if(socket)return true;
 if(typeof io!=='function'){
  $('#roomStatus').textContent='Online server unavailable. Open the deployed Render URL, not the HTML file or GitHub Pages.';
  return false;
 }
 socket=io({transports:['websocket','polling']});
 socket.on('connect',()=>{$('#roomStatus').textContent='Connected. Creating room…'});
 socket.on('connect_error',()=>{$('#roomStatus').textContent='Could not reach the game server. Check that the Render service is running.'});
 socket.on('room-created',d=>{roomCode=d.code;onlineRole='attacker';isHost=true;ready=false;openRoom(d.code)});
 socket.on('room-joined',d=>{roomCode=d.code;onlineRole=d.role;isHost=d.role==='attacker';ready=false;openRoom(d.code)});
 socket.on('room-update',d=>{
  opponentReady=d.players.some(p=>p.role!==onlineRole&&p.ready);
  $('#roomStatus').textContent=`${d.players.length}/2 players · ${d.players.filter(p=>p.ready).length}/2 ready`;
  if(d.started&&(!match||match.mode!=='online')){
   $('#roomModal').classList.add('hidden');
   startMatch(onlineRole,'online');
  }
 });
 socket.on('game-action',a=>{if(isHost)applyAction(a)});
 socket.on('state',state=>{
  if(isHost)return;
  const localRole=onlineRole;
  const wasActive=$('#matchView').classList.contains('active');
  match={...state,role:localRole,mode:'online'};
  online=true;
  if(!wasActive){
   showView('matchView');
   $('#roleBanner').textContent=`Online · You are the ${localRole[0].toUpperCase()+localRole.slice(1)}`;
   $('#leftName').textContent=localRole==='attacker'?'You · Attacker':'Friend · Attacker';
   $('#rightName').textContent=localRole==='defender'?'You · Defender':'Friend · Defender';
   $('#soloControls').classList.remove('hidden');
   $('#twoPlayerControls').classList.add('hidden');
   $('#swapRole').classList.add('hidden');
   renderHand();
   last=performance.now();
   cancelAnimationFrame(raf);
   raf=requestAnimationFrame(loop);
  }
 });
 socket.on('game-over',d=>{if(match&&!match.ended)finish(d.winner)});
 socket.on('peer-left',()=>{toast('Opponent disconnected');if(match&&!match.ended)finish(onlineRole)});
 socket.on('room-error',m=>{toast(m);$('#roomStatus').textContent=m});
 return true;
}
function openRoom(code){
 const url=`${location.origin}${location.pathname}?room=${code}`;
 $('#roomCode').textContent=code;
 $('#roomUrl').textContent=url;
 $('#roomModal').classList.remove('hidden');
 $('#roomStatus').textContent='Waiting for opponent…';
}
function beginPrivateRoom(){
 $('#roomModal').classList.remove('hidden');
 $('#roomCode').textContent='------';
 $('#roomUrl').textContent='The invitation link will appear here.';
 $('#roomStatus').textContent='Connecting to the multiplayer server…';
 if(ensureSocket())socket.emit('create-room');
}
$('#friendBtn').onclick=beginPrivateRoom;
$('#onlineBtn').onclick=beginPrivateRoom;
$('#copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText($('#roomUrl').textContent);toast('Invitation link copied')}catch{toast('Copy the URL manually')}};
$('#readyRoom').onclick=()=>{if(!roomCode)return;ready=!ready;$('#readyRoom').textContent=ready?'Ready ✓':'Ready';socket.emit('ready',{room:roomCode,ready})};
$('#closeRoom').onclick=()=>{if(socket&&roomCode)socket.emit('leave-room',{room:roomCode});roomCode=null;$('#roomModal').classList.add('hidden')};
$('#localBtn').onclick=()=>$('#choiceModal').classList.remove('hidden');$('#closeChoice').onclick=()=>$('#choiceModal').classList.add('hidden');$('#startLocalTwoPlayer').onclick=()=>{$('#choiceModal').classList.add('hidden');startMatch('local2p')};
$('#leaveMatch').onclick=()=>{cancelAnimationFrame(raf);if(online&&socket)socket.emit('leave-room',{room:roomCode});match=null;online=false;showView('battleView')};
$('#swapRole').onclick=()=>{};
$('#rematchBtn').onclick=()=>{$('#resultModal').classList.add('hidden');if(online){ready=false;socket.emit('ready',{room:roomCode,ready:true})}else startMatch(match.role)};
$('#resultHome').onclick=()=>{$('#resultModal').classList.add('hidden');cancelAnimationFrame(raf);match=null;showView('battleView')};
const incoming=new URLSearchParams(location.search).get('room');if(incoming){$('#roomModal').classList.remove('hidden');$('#roomCode').textContent=incoming.toUpperCase();$('#roomUrl').textContent=location.href;$('#roomStatus').textContent='Joining private room…';if(ensureSocket())socket.emit('join-room',{code:incoming.toUpperCase()})}
renderHomeDeck();renderDeck();
})();
