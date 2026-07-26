# Reverse TD: Siege Online

Two-player mobile web game using private invitation links.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Put it online with Render

1. Upload all files in this folder to the GitHub repository.
2. In Render, create a **Web Service** from that repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy.

The resulting Render URL is the game link. Player 1 taps **Create private match**, then shares the generated invitation link with Player 2.

## Important

GitHub Pages cannot run `server.js`. It can host static pages only. Use Render, Railway, Fly.io, or another Node.js host.
