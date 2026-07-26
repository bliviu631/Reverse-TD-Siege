# Reverse TD: Siege — server-authoritative online 1v1

This version keeps the selected Clash Royale-style interface and local two-player mode, while moving online match simulation to the Node.js server.

## What changed

- Private invitation rooms for exactly two players
- Room creator is Attacker; invited player is Defender
- Both players ready before the match begins
- Server controls timer, supply, troop movement, tower targeting, damage, healing, buffs, castle health, and victory
- Clients send only legal actions and render server snapshots
- Server validates card ownership by role, supply cost, tower slot, and room membership
- Rematch and disconnect handling
- Balanced troop and tower values

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browser windows. Create a room in one and open the generated invitation in the other.

## Deploy on Render

Create a Render Web Service from this GitHub repository. Render can read `render.yaml` automatically, or use:

- Build command: `npm install`
- Start command: `npm start`
- Health path: `/health`

Use the Render URL for multiplayer. GitHub Pages cannot execute `server.js`.
