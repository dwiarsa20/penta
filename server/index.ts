// Penta game server: multiplayer sync, lobby API, and match storage on disk so a
// match survives restarts. In production it also serves the built web app.

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, Origins, FlatFile } from 'boardgame.io/server';
import serve from 'koa-static';
import { Penta } from '../src/game/penta';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8000);

const server = Server({
  games: [Penta],
  db: new FlatFile({ dir: process.env.DATA_DIR ?? path.join(root, '..', 'data'), logging: false }),
  // Set ORIGIN to the public site URL when hosting; locally any origin is allowed so
  // phones on the same Wi-Fi can connect.
  origins: process.env.ORIGIN ? [process.env.ORIGIN, Origins.LOCALHOST] : [/.*/],
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

// Lets a page opened as "localhost" build a share link that phones on the same Wi-Fi can open.
server.app.use(async (ctx, next) => {
  if (ctx.path === '/lan') {
    ctx.body = lanAddresses();
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
