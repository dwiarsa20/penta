// In development the game server runs on port 8000 next to the Vite dev server;
// in production the same server hosts both, so the page's own origin is used.
export const SERVER_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : window.location.origin;

export const GAME_NAME = 'penta';
