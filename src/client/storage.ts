// Remembers the player's name and seats on this device so they can rejoin a match.
// Storage can be unavailable (private mode), so every access is guarded.

export interface SavedSeat {
  matchID: string;
  playerID: string;
  credentials: string;
  joinedAt: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisted; the player can still play this session.
  }
}

export const getName = () => read<string>('penta.name', '');
export const setName = (name: string) => write('penta.name', name);

export const getSeats = () => read<SavedSeat[]>('penta.seats', []);
export const getSeat = (matchID: string) => getSeats().find((s) => s.matchID === matchID);

export function saveSeat(seat: SavedSeat) {
  write('penta.seats', [seat, ...getSeats().filter((s) => s.matchID !== seat.matchID)].slice(0, 20));
}

export function forgetSeat(matchID: string) {
  write('penta.seats', getSeats().filter((s) => s.matchID !== matchID));
}
