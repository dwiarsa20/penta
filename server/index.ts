// Penta game server: multiplayer sync, lobby API, and match storage so a match survives
// restarts (Postgres when DATABASE_URL is set, otherwise files on disk). In production it
// also serves the built web app.

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, Origins, FlatFile } from 'boardgame.io/server';
import serve from 'koa-static';
import { Penta } from '../src/game/penta';
import { PostgresStore } from './postgres';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8000);
// Render sets RENDER_EXTERNAL_URL to the site's public address.
const origin = process.env.ORIGIN ?? process.env.RENDER_EXTERNAL_URL;

const server = Server({
  games: [Penta],
  db: process.env.DATABASE_URL
    ? new PostgresStore(process.env.DATABASE_URL)
    : new FlatFile({ dir: process.env.DATA_DIR ?? path.join(root, '..', 'data'), logging: false }),
  // When hosted, only the public site may connect; locally any origin is allowed so
  // phones on the same Wi-Fi can connect.
  origins: origin ? [origin, Origins.LOCALHOST] : [/.*/],
});

/** This PC's addresses on the local network, home Wi-Fi first, virtual adapters skipped. */
function lanAddresses(): string[] {
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
  return Object.entries(os.networkInterfaces())
    .filter(([name]) => !/vEthernet|WSL|VirtualBox|VMware|Loopback/i.test(name))
    .flatMap(([, addrs]) => addrs ?? [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address)
    .sort((a, b) => rank(a) - rank(b));
}

// Lets a page opened as "localhost" build a share link others can open: the public link
// when hosting with `npm run host`, otherwise this PC's address on the Wi-Fi.
server.app.use(async (ctx, next) => {
  if (ctx.path === '/share') {
    ctx.body = { public: process.env.PUBLIC_URL ?? null, lan: lanAddresses() };
    return;
  }
  await next();
});

// Serve the built client (npm run build) from the same server.
server.app.use(serve(path.join(root, '..', 'dist')));

server.run(port, () => {
  console.log(`Penta server running on http://localhost:${port}`);
  for (const ip of lanAddresses()) console.log(`  On your Wi-Fi: http://${ip}:${port}`);
});
