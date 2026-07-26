const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const PATH = [
  {x:55,y:75},{x:270,y:75},{x:360,y:145},{x:820,y:145},
  {x:965,y:225},{x:880,y:330},{x:420,y:330},
  {x:240,y:430},{x:520,y:530},{x:1025,y:530}
];
const SPOTS = [
  {x:500,y:72},{x:730,y:232},{x:1010,y:340},
  {x:590,y:410},{x:270,y:350},{x:720,y:590}
];
const UNIT = {
  swordsman:{cost:12,hp:55,speed:58,damage:12,size:12},
  shield:{cost:20,hp:120,speed:36,damage:9,size:14},
  runner:{cost:16,hp:38,speed:92,damage:8,size:10},
  brute:{cost:32,hp:180,speed:28,damage:30,size:17}
};
const TOWER = {
  archer:{cost:28,range:150,fireRate:0.85,damage:12},
  cannon:{cost:46,range:165,fireRate:1.6,damage:28}
};

function roomCode(){ return crypto.randomBytes(3).toString('hex').toUpperCase(); }
function freshRoom(code){
  return {
    code, players:{ attacker:null, defender:null }, ready:{attacker:false,defender:false},
    phase:'lobby', winner:null, attackerGold:70, defenderGold:95, castleHp:240,
    units:[], towers:[], projectiles:[], nextUnitId:1, nextTowerId:1,
    startedAt:0, lastTick:Date.now(), goldAcc:0
  };
}
function publicState(r){
  return {
    code:r.code, phase:r.phase, winner:r.winner, ready:r.ready,
    connected:{attacker:!!r.players.attacker, defender:!!r.players.defender},
    attackerGold:Math.floor(r.attackerGold), defenderGold:Math.floor(r.defenderGold),
    castleHp:Math.max(0,Math.ceil(r.castleHp)), units:r.units, towers:r.towers,
    elapsed:r.startedAt ? Math.floor((Date.now()-r.startedAt)/1000) : 0
  };
}
function emitRoom(r){ io.to(r.code).emit('state', publicState(r)); }
function findRole(r, socketId){
  if(r.players.attacker === socketId) return 'attacker';
  if(r.players.defender === socketId) return 'defender';
  return null;
}
function startIfReady(r){
  if(r.phase==='lobby' && r.players.attacker && r.players.defender && r.ready.attacker && r.ready.defender){
    r.phase='playing'; r.startedAt=Date.now(); r.lastTick=Date.now();
  }
}

io.on('connection', socket => {
  socket.on('createRoom', cb => {
    let code; do code = roomCode(); while(rooms.has(code));
    const r=freshRoom(code); rooms.set(code,r); r.players.attacker=socket.id;
    socket.join(code); socket.data.room=code;
    cb?.({ok:true,code,role:'attacker'}); emitRoom(r);
  });
  socket.on('joinRoom', ({code}) => {
    code=String(code||'').trim().toUpperCase(); const r=rooms.get(code);
    if(!r) return socket.emit('joinError','Room not found.');
    let role;
    if(!r.players.attacker) role='attacker';
    else if(!r.players.defender) role='defender';
    else return socket.emit('joinError','Room is already full.');
    r.players[role]=socket.id; socket.join(code); socket.data.room=code;
    socket.emit('joined',{code,role}); emitRoom(r);
  });
  socket.on('ready', () => {
    const r=rooms.get(socket.data.room); if(!r) return;
    const role=findRole(r,socket.id); if(!role) return;
    r.ready[role]=true; startIfReady(r); emitRoom(r);
  });
  socket.on('spawnUnit', type => {
    const r=rooms.get(socket.data.room); if(!r || r.phase!=='playing' || findRole(r,socket.id)!=='attacker') return;
    const s=UNIT[type]; if(!s || r.attackerGold<s.cost) return;
    r.attackerGold-=s.cost;
    r.units.push({id:r.nextUnitId++,type,d:0,hp:s.hp,maxHp:s.hp,speed:s.speed,damage:s.damage,size:s.size,attackCd:0});
  });
  socket.on('placeTower', ({spot,type}) => {
    const r=rooms.get(socket.data.room); if(!r || r.phase!=='playing' || findRole(r,socket.id)!=='defender') return;
    spot=Number(spot); const s=TOWER[type];
    if(!Number.isInteger(spot)||spot<0||spot>=SPOTS.length||!s||r.defenderGold<s.cost||r.towers.some(t=>t.spot===spot)) return;
    r.defenderGold-=s.cost;
    r.towers.push({id:r.nextTowerId++,spot,type,x:SPOTS[spot].x,y:SPOTS[spot].y,range:s.range,fireRate:s.fireRate,damage:s.damage,cd:0});
  });
  socket.on('disconnect', () => {
    const r=rooms.get(socket.data.room); if(!r) return;
    const role=findRole(r,socket.id); if(role){ r.players[role]=null; r.ready[role]=false; }
    if(r.phase==='playing'){ r.phase='ended'; r.winner=role==='attacker'?'defender':'attacker'; }
    emitRoom(r);
    if(!r.players.attacker && !r.players.defender) setTimeout(()=>rooms.delete(r.code),60000);
  });
});

function pathPos(d){
  let remain=d;
  for(let i=0;i<PATH.length-1;i++){
    const a=PATH[i],b=PATH[i+1],len=Math.hypot(b.x-a.x,b.y-a.y);
    if(remain<=len){ const t=remain/len; return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,done:false}; }
    remain-=len;
  }
  const p=PATH[PATH.length-1]; return {x:p.x,y:p.y,done:true};
}
function nearestUnit(r,tower){
  let best=null,bestD=-1;
  for(const u of r.units){
    const p=pathPos(u.d),dist=Math.hypot(p.x-tower.x,p.y-tower.y);
    if(dist<=tower.range && u.d>bestD){best=u;bestD=u.d;}
  }
  return best;
}
function tickRoom(r,dt){
  if(r.phase!=='playing') return;
  r.goldAcc+=dt;
  while(r.goldAcc>=1){r.attackerGold+=4;r.defenderGold+=3;r.goldAcc-=1;}
  for(const t of r.towers){
    t.cd-=dt;
    if(t.cd<=0){ const u=nearestUnit(r,t); if(u){u.hp-=t.damage;t.cd=t.fireRate;} }
  }
  for(const u of r.units){
    if(u.hp<=0) continue;
    u.d+=u.speed*dt;
    const p=pathPos(u.d);
    if(p.done){
      u.attackCd-=dt;
      if(u.attackCd<=0){r.castleHp-=u.damage;u.attackCd=0.75;}
    }
  }
  r.units=r.units.filter(u=>u.hp>0 && !pathPos(u.d).done);
  if(r.castleHp<=0){r.phase='ended';r.winner='attacker';}
  if(Date.now()-r.startedAt>=180000 && r.phase==='playing'){r.phase='ended';r.winner='defender';}
}
setInterval(()=>{
  const now=Date.now();
  for(const r of rooms.values()){
    const dt=Math.min(.1,(now-r.lastTick)/1000); r.lastTick=now; tickRoom(r,dt);
    if(r.players.attacker||r.players.defender) emitRoom(r);
  }
},100);

server.listen(PORT,()=>console.log(`Reverse TD online listening on ${PORT}`));
