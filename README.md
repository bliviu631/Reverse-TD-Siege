# Reverse TD: Siege — Online 1v1

This build keeps the supplied Clash Royale-style interface and adds private online rooms using Node.js and Socket.IO.

## Files

- `index.html` — interface and battlefield
- `client.js` — decks, balanced combat, rooms, synchronization
- `server.js` — room and realtime server
- `package.json` — Node dependencies
- `render.yaml` — Render deployment configuration

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browser windows. Do not open `index.html` directly, because direct files cannot run the Socket.IO server.

## Deploy on Render

1. Upload all files to the root of a GitHub repository.
2. In Render, create a Web Service from the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Health check: `/health`
6. Open the generated Render URL.

## Play by invitation

1. Player 1 opens the Render URL and selects **Play Against a Friend**.
2. Player 1 copies the generated invitation link.
3. Player 2 opens the link on another phone.
4. Both players press **Ready**.
5. Player 1 controls troops as Attacker. Player 2 places towers as Defender.

GitHub Pages cannot host this multiplayer build because it cannot execute `server.js`.
