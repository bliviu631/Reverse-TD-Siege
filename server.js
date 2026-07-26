const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const crypto=require('crypto');
const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:'*'}});
const rooms=new Map();
app.use(express.static(__dirname));
app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));
function code(){return crypto.randomBytes(3).toString('hex').toUpperCase()}
function updateRoom(c){const r=rooms.get(c);if(!r)return;io.to(c).emit('room-update',{players:[...r.players.values()],started:r.started})}
io.on('connection',socket=>{
 socket.on('create-room',()=>{let c=code();while(rooms.has(c))c=code();rooms.set(c,{players:new Map([[socket.id,{id:socket.id,role:'attacker',ready:false}]]),started:false,host:socket.id});socket.join(c);socket.data.room=c;socket.emit('room-created',{code:c});updateRoom(c)});
 socket.on('join-room',({code:c})=>{c=String(c||'').toUpperCase();const r=rooms.get(c);if(!r)return socket.emit('room-error','Room not found');if(r.players.size>=2&&!r.players.has(socket.id))return socket.emit('room-error','Room is full');r.players.set(socket.id,{id:socket.id,role:'defender',ready:false});socket.join(c);socket.data.room=c;socket.emit('room-joined',{code:c,role:'defender'});updateRoom(c)});
 socket.on('ready',({room:c,ready})=>{const r=rooms.get(c);if(!r||!r.players.has(socket.id))return;r.players.get(socket.id).ready=!!ready;if(r.players.size===2&&[...r.players.values()].every(p=>p.ready))r.started=true;updateRoom(c)});
 socket.on('game-action',({room:c,action})=>{const r=rooms.get(c);if(!r||!r.started)return;const p=r.players.get(socket.id);if(!p)return;if(action.type==='spawn'&&p.role!=='attacker')return;if(action.type==='tower'&&p.role!=='defender')return;socket.to(c).emit('game-action',action)});
 socket.on('state',({room:c,state})=>{const r=rooms.get(c);if(r&&r.host===socket.id&&r.started)socket.to(c).emit('state',state)});
 socket.on('game-over',({room:c,winner})=>{const r=rooms.get(c);if(r&&r.host===socket.id)socket.to(c).emit('game-over',{winner})});
 function leave(){const c=socket.data.room,r=rooms.get(c);if(!r)return;r.players.delete(socket.id);socket.leave(c);socket.data.room=null;if(r.players.size===0)rooms.delete(c);else{r.started=false;io.to(c).emit('peer-left');updateRoom(c)}}
 socket.on('leave-room',leave);socket.on('disconnect',leave);
});
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`Reverse TD server on ${PORT}`));
