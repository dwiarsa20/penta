// npm run host: host a game night from this computer.
//
// Builds the app, starts the game server, and opens a free Cloudflare "quick tunnel" so
// friends can join from anywhere with an https:// link. No account or card needed; the
// tunnel program is downloaded the first time. The link changes every time this starts.
// `npm run host -- --no-open` skips opening the browser.

import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { build } from 'vite';
import { bin, install, Tunnel } from 'cloudflared';

const port = Number(process.env.PORT ?? 8000);
const local = `http://localhost:${port}`;

console.log('Building the app…');
await build({ logLevel: 'warn' });

// Starts the game server.
await import('./index');

if (!fs.existsSync(bin)) {
  console.log('Downloading the Cloudflare tunnel program (first time only)…');
  await install(bin);
}

console.log('Opening a public link…');
const tunnel = Tunnel.quick(local);
const url = await new Promise<string>((resolve, reject) => {
  tunnel.once('url', resolve);
  tunnel.once('exit', () => reject(new Error('The tunnel program stopped before giving a link.')));
});
await new Promise((resolve) => tunnel.once('connected', resolve));

// The waiting screen's share link uses this instead of localhost.
process.env.PUBLIC_URL = url;

const line = '='.repeat(Math.max(url.length + 4, 50));
console.log(`
${line}
  Penta is online. Share this link with your friends:

  ${url}

  You can play from ${local}
  Keep this window open while you play. Close it to stop hosting.
${line}
`);

tunnel.on('exit', () => {
  console.log('The public link stopped. Restart hosting to get a new one.');
  process.exit(1);
});
const stop = () => {
  tunnel.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Open the game in this computer's browser.
if (!process.argv.includes('--no-open')) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', local]]
      : [process.platform === 'darwin' ? 'open' : 'xdg-open', [local]];
  spawn(cmd as string, args as string[], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}
