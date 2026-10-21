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

// Take back my seat: lets a player back into their seat from a new device or link (e.g.
// after the host restarts and the link changes). Only for a seat whose player isn't
// connected right now. Anyone with the match link can do this, so keep links among friends.
server.app.use(async (ctx, next) => {
  if (ctx.path !== '/reclaim' || ctx.method !== 'POST') return next();
  const body = await readJson(ctx.req);
  if (!body) return ctx.throw(400, 'Bad request.');
  const { metadata } = await server.db.fetch(String(body.matchID), { metadata: true });
  const seat = metadata?.players[Number(body.playerID)];
  if (!seat?.name) return ctx.throw(404, 'No one is in that seat.');
  if (seat.isConnected) return ctx.throw(409, `${seat.name} is still connected.`);
  ctx.body = { playerCredentials: seat.credentials };
});

/** A small JSON request body, or null if it's missing, too big or not JSON. */
async function readJson(req: AsyncIterable<Buffer>): Promise<{ matchID?: unknown; playerID?: unknown } | null> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1000) return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Serve the built client (npm run build) from the same server.
server.app.use(serve(path.join(root, '..', 'dist')));

/**
 * Nobody is connected when the server starts, but a crash or restart can leave players
 * marked as connected. Clear that so their seats can be taken back.
 */
async function markEveryoneDisconnected() {
  for (const matchID of await server.db.listMatches()) {
    const { metadata } = await server.db.fetch(matchID, { metadata: true });
    const players = Object.values(metadata?.players ?? {});
    if (!players.some((p) => p.isConnected)) continue;
    for (const p of players) p.isConnected = false;
    await server.db.setMetadata(matchID, metadata);
  }
}

await server.db.connect();
await markEveryoneDisconnected();

server.run(port, () => {
  console.log(`Penta server running on http://localhost:${port}`);
  for (const ip of lanAddresses()) console.log(`  On your Wi-Fi: http://${ip}:${port}`);
});
