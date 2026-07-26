'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(__dirname));

const TROOPS = {
  swordsman:{cost:3,hp:100,speed:60,damage:18},
  shield:{cost:4,hp:215,speed:36,damage:10},
  runner:{cost:2,hp:55,speed:108,damage:8},
  brute:{cost:6,hp:330,speed:28,damage:42},
  archer:{cost:3,hp:70,speed:52,damage:15},
  medic:{cost:4,hp:85,speed:47,damage:5,heal:11},
  saboteur:{cost:4,hp:78,speed:70,damage:30},
  commander:{cost:5,hp:145,speed:44,damage:20}
};

const TOWERS = {
  archerTower:{cost:3,hp:150,damage:12,range:155,rate:.72},
  cannon:{cost:4,hp:190,damage:28,range:138,rate:1.4},
  rapid:{cost:3,hp:120,damage:6,range:128,rate:.30},
  frost:{cost:4,hp:135,damage:7,range:145,rate:.92,slow:.68},
  bomb:{cost:5,hp:175,damage:18,range:125,rate:1.18,splash:52},
  sniper:{cost:5,hp:95,damage:39,range:225,rate:1.85},
  barricade:{cost:2,hp:260,damage:0,range:0,rate:99},
  supply:{cost:4,hp:110,damage:0,range:0,rate:99,income:.13}
};

const PATH = [{x:55,y:75},{x:270,y:75},{x:360,y:145},{x:820,y:145},{x:965,y:225},{x:880,y:330},{x:420,y:330},{x:240,y:430},{x:520,y:530},{x:1025,y:530}];
const SPOTS = [{x:500,y:72},{x:730,y:232},{x:1010,y:340},{x:590,y:410},{x:270,y:350},{x:720,y:585},{x:885,y:455},{x:390,y:230}];
const TOTAL_PATH = PATH.slice(0,-1).reduce((sum,p,i)=>sum+Math.hypot(PATH[i+1].x-p.x,PATH[i+1].y-p.y),0);
const rooms = new Map();

function roomCode(){ return crypto.randomBytes(3).toString('hex').toUpperCase(); }
function positionAt(distance){
  let remaining = distance;
  for(let i=0;i<PATH.length-1;i++){
    const a=PATH[i], b=PATH[i+1], len=Math.hypot(b.x-a.x,b.y-a.y);
    if(remaining<=len){ const t=remaining/len; return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}; }
    remaining-=len;
  }
  return PATH[PATH.length-1];
}
function freshState(){
  return {time:180,castleHp:600,attackerSupply:5,defenderSupply:6,units:[],towers:[],shots:[],ended:false,winner:null,nextUnitId:1};
}
function publicState(state){
  return {
    time:state.time,castleHp:state.castleHp,attackerSupply:state.attackerSupply,defenderSupply:state.defenderSupply,
    units:state.units,towers:state.towers,shots:state.shots,ended:state.ended,winner:state.winner
  };
}
function broadcastRoom(code){
  const room=rooms.get(code); if(!room)return;
  io.to(code).emit('room-update',{players:[...room.players.values()].map(({id,role,ready})=>({id,role,ready})),started:room.started});
}
function stopRoom(room){ if(room.timer){clearInterval(room.timer);room.timer=null;} }
function startGame(code,room){
  stopRoom(room);
  room.state=freshState(); room.started=true; room.lastTick=Date.now(); room.lastSnapshot=0;
  io.to(code).emit('match-start'); broadcastRoom(code);
  room.timer=setInterval(()=>tick(code),50);
}
function endGame(code,room,winner){
  if(room.state.ended)return;
  room.state.ended=true; room.state.winner=winner; room.started=false; stopRoom(room);
  io.to(code).emit('state',publicState(room.state));
  io.to(code).emit('game-over',{winner});
}
function tick(code){
  const room=rooms.get(code); if(!room||!room.started)return;
  const now=Date.now(), dt=Math.min(.1,(now-room.lastTick)/1000); room.lastTick=now;
  const s=room.state; s.time-=dt;
  const regen=s.time<=60?1.30:.72;
  s.attackerSupply=Math.min(10,s.attackerSupply+regen*dt);
  s.defenderSupply=Math.min(10,s.defenderSupply+regen*.94*dt);
  for(const tower of s.towers){ const spec=TOWERS[tower.type]; if(spec.income)s.defenderSupply=Math.min(10,s.defenderSupply+spec.income*dt); }
  for(const unit of s.units){
    const spec=TROOPS[unit.type]; unit.slow=Math.min(1,unit.slow+dt*.28);
    if(unit.d<TOTAL_PATH)unit.d=Math.min(TOTAL_PATH,unit.d+spec.speed*unit.slow*dt);
    else { unit.castleTick-=dt; if(unit.castleTick<=0){unit.castleTick+=1;s.castleHp-=spec.damage*(unit.buff||1);} }
    if(unit.type==='medic'){
      unit.healTick-=dt;
      if(unit.healTick<=0){unit.healTick+=1.15;for(const ally of s.units){if(ally.hp>0&&Math.abs(ally.d-unit.d)<80)ally.hp=Math.min(ally.maxHp,ally.hp+spec.heal);}}
    }
  }
  for(const unit of s.units){ unit.buff=s.units.some(c=>c.type==='commander'&&c.id!==unit.id&&Math.abs(c.d-unit.d)<95)?1.18:1; }
  s.shots=[];
  for(const tower of s.towers){
    const spec=TOWERS[tower.type]; tower.cool-=dt;
    if(spec.damage<=0||tower.cool>0)continue;
    const origin=SPOTS[tower.spot]; let target=null, bestProgress=-1;
    for(const unit of s.units){const p=positionAt(unit.d);if(Math.hypot(p.x-origin.x,p.y-origin.y)<=spec.range&&unit.d>bestProgress){target=unit;bestProgress=unit.d;}}
    if(target){
      tower.cool=spec.rate; const targetPos=positionAt(target.d); target.hp-=spec.damage;
      if(spec.slow)target.slow=Math.min(target.slow,spec.slow);
      if(spec.splash){for(const unit of s.units){if(unit.id!==target.id){const p=positionAt(unit.d);if(Math.hypot(p.x-targetPos.x,p.y-targetPos.y)<spec.splash)unit.hp-=spec.damage*.42;}}}
      s.shots.push({x:origin.x,y:origin.y,tx:targetPos.x,ty:targetPos.y,life:.12});
    }
  }
  s.units=s.units.filter(u=>u.hp>0);
  if(s.castleHp<=0)return endGame(code,room,'attacker');
  if(s.time<=0)return endGame(code,room,'defender');
  if(now-room.lastSnapshot>=80){room.lastSnapshot=now;io.to(code).emit('state',publicState(s));}
}
function roleOf(room,socketId){return room.players.get(socketId)?.role;}
function handleAction(code,room,socketId,action){
  if(!room.started||room.state.ended||!action||typeof action!=='object')return;
  const role=roleOf(room,socketId), s=room.state;
  if(action.type==='spawn'){
    if(role!=='attacker')return; const spec=TROOPS[action.card]; if(!spec||s.attackerSupply<spec.cost)return;
    s.attackerSupply-=spec.cost;s.units.push({id:s.nextUnitId++,type:action.card,hp:spec.hp,maxHp:spec.hp,d:0,slow:1,buff:1,castleTick:1,healTick:1.15});
  } else if(action.type==='tower'){
    if(role!=='defender')return; const spec=TOWERS[action.card]; const spot=Number(action.spot);
    if(!spec||!Number.isInteger(spot)||spot<0||spot>=SPOTS.length||s.defenderSupply<spec.cost||s.towers.some(t=>t.spot===spot))return;
    s.defenderSupply-=spec.cost;s.towers.push({type:action.card,hp:spec.hp,maxHp:spec.hp,spot,cool:Math.random()*spec.rate});
  }
  io.to(code).emit('state',publicState(s));
}

app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));

io.on('connection',socket=>{
  socket.on('create-room',()=>{
    let code=roomCode();while(rooms.has(code))code=roomCode();
    const room={players:new Map(),started:false,state:freshState(),timer:null,lastTick:Date.now(),lastSnapshot:0};
    room.players.set(socket.id,{id:socket.id,role:'attacker',ready:false});rooms.set(code,room);socket.join(code);socket.data.room=code;
    socket.emit('room-created',{code,role:'attacker'});broadcastRoom(code);
  });
  socket.on('join-room',({code})=>{
    code=String(code||'').trim().toUpperCase();const room=rooms.get(code);
    if(!room)return socket.emit('room-error','Room not found. Ask your friend for a fresh invitation link.');
    if(room.players.size>=2&&!room.players.has(socket.id))return socket.emit('room-error','Room is full.');
    room.players.set(socket.id,{id:socket.id,role:'defender',ready:false});socket.join(code);socket.data.room=code;
    socket.emit('room-joined',{code,role:'defender'});broadcastRoom(code);
  });
  socket.on('ready',({room:code,ready})=>{
    const room=rooms.get(code);if(!room||!room.players.has(socket.id))return;
    room.players.get(socket.id).ready=Boolean(ready);broadcastRoom(code);
    if(room.players.size===2&&[...room.players.values()].every(p=>p.ready))startGame(code,room);
  });
  socket.on('game-action',({room:code,action})=>{const room=rooms.get(code);if(room)handleAction(code,room,socket.id,action);});
  socket.on('request-rematch',({room:code})=>{
    const room=rooms.get(code);if(!room||!room.players.has(socket.id))return;
    room.players.get(socket.id).ready=true;room.started=false;broadcastRoom(code);
    if(room.players.size===2&&[...room.players.values()].every(p=>p.ready))startGame(code,room);
  });
  function leave(){
    const code=socket.data.room,room=rooms.get(code);if(!room)return;
    room.players.delete(socket.id);socket.leave(code);socket.data.room=null;stopRoom(room);
    if(room.players.size===0)rooms.delete(code);else{room.started=false;for(const p of room.players.values())p.ready=false;io.to(code).emit('peer-left');broadcastRoom(code);}
  }
  socket.on('leave-room',leave);socket.on('disconnect',leave);
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Reverse TD: Siege listening on ${PORT}`));
