import { useEffect, useState } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { LobbyClient } from 'boardgame.io/client';
import { Penta } from '../game/penta';
import { GAME_NAME, SERVER_URL } from './config';
import { PentaBoard } from './PentaBoard';
import * as store from './storage';

const lobby = new LobbyClient({ server: SERVER_URL });

const PentaClient = Client({
  game: Penta,
  board: PentaBoard,
  numPlayers: 4,
  multiplayer: SocketIO({ server: SERVER_URL }),
  debug: false,
  loading: () => <div className="center-msg">Connecting…</div>,
});

const param = (name: string) => new URLSearchParams(window.location.search).get(name);
const currentMatchID = () => param('match');

/** In a test match, which seat this page plays (`?as=0`-`3`). Development only. */
function testSeat(matchID: string) {
  const as = import.meta.env.DEV ? param('as') : null;
  return as == null ? undefined : store.getTestSeats(matchID)[Number(as)];
}

function goTo(matchID: string | null) {
  const url = matchID ? `?match=${encodeURIComponent(matchID)}` : window.location.pathname;
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function App() {
  const [matchID, setMatchID] = useState(currentMatchID);
  useEffect(() => {
    const onPop = () => setMatchID(currentMatchID());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const testID = import.meta.env.DEV ? param('test') : null;
  if (testID) return <TestTable matchID={testID} />;
  return matchID ? <MatchRoom key={matchID} matchID={matchID} /> : <Home />;
}

function NameField({ name, setName }: { name: string; setName: (n: string) => void }) {
  return (
    <label className="field">
      Your name
      <input
        value={name}
        maxLength={20}
        placeholder="e.g. Rain"
        onChange={(e) => {
          setName(e.target.value);
          store.setName(e.target.value);
        }}
      />
    </label>
  );
}

function Home() {
  const [name, setName] = useState(store.getName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seats = store.getSeats();

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const { matchID } = await lobby.createMatch(GAME_NAME, { numPlayers: 4 });
      const { playerCredentials } = await lobby.joinMatch(GAME_NAME, matchID, {
        playerID: '0',
        playerName: name.trim(),
      });
      store.saveSeat({ matchID, playerID: '0', credentials: playerCredentials, joinedAt: Date.now() });
      goTo(matchID);
    } catch {
      setError('Could not reach the game server. Is it running?');
    } finally {
      setBusy(false);
    }
  };

  /** Create a match, take all four seats, and open the four-player test table. */
  const createTest = async () => {
    setBusy(true);
    setError('');
    try {
      const { matchID } = await lobby.createMatch(GAME_NAME, { numPlayers: 4 });
      const seats: store.SavedSeat[] = [];
      for (const playerID of ['0', '1', '2', '3']) {
        const { playerCredentials } = await lobby.joinMatch(GAME_NAME, matchID, {
          playerID,
          playerName: `Player ${Number(playerID) + 1}`,
        });
        seats.push({ matchID, playerID, credentials: playerCredentials, joinedAt: Date.now() });
      }
      store.saveTestSeats(matchID, seats);
      window.location.search = `?test=${encodeURIComponent(matchID)}`;
    } catch {
      setError('Could not reach the game server. Is it running?');
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <h1>Penta</h1>
      <p className="muted">Truf · Hearts · Sevens · Trumpon · Capsa, four rounds.</p>

      <section className="card-panel">
        <NameField name={name} setName={setName} />
        <button className="primary" disabled={!name.trim() || busy} onClick={create}>
          Create new match
        </button>
        {import.meta.env.DEV && (
          <button disabled={busy} onClick={createTest}>
            Test match: play all 4 seats
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card-panel">
        <label className="field">
          Join with a match code
          <input value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="Paste code or link" />
        </label>
        <button
          disabled={!code}
          onClick={() => goTo(code.includes('match=') ? new URL(code).searchParams.get('match') : code)}
        >
          Open match
        </button>
      </section>

      {seats.length > 0 && (
        <section className="card-panel">
          <h2>Your matches</h2>
          <ul className="match-list">
            {seats.map((s) => (
              <li key={s.matchID}>
                <span>
                  {s.matchID} <span className="muted">· {new Date(s.joinedAt).toLocaleDateString()}</span>
                </span>
                <button onClick={() => goTo(s.matchID)}>Resume</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

type MatchInfo = Awaited<ReturnType<LobbyClient['getMatch']>>;

function MatchRoom({ matchID }: { matchID: string }) {
  const [seat, setSeat] = useState(() => testSeat(matchID) ?? store.getSeat(matchID));
  const [spectating, setSpectating] = useState(false);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState(store.getName);

  useEffect(() => {
    if (seat) return;
    lobby
      .getMatch(GAME_NAME, matchID)
      .then(setMatch)
      .catch(() => setError('Match not found. Check the link or code.'));
  }, [matchID, seat]);

  if (seat || spectating) {
    return (
      <PentaClient matchID={matchID} playerID={seat?.playerID} credentials={seat?.credentials} />
    );
  }

  const freeSeat = match?.players.find((p) => !p.name);

  const join = async () => {
    if (!freeSeat) return;
    try {
      const playerID = String(freeSeat.id);
      const { playerCredentials } = await lobby.joinMatch(GAME_NAME, matchID, {
        playerID,
        playerName: name.trim(),
      });
      const saved = { matchID, playerID, credentials: playerCredentials, joinedAt: Date.now() };
      store.saveSeat(saved);
      setSeat(saved);
    } catch {
      setError('That seat was just taken. Try again.');
      lobby.getMatch(GAME_NAME, matchID).then(setMatch).catch(() => {});
    }
  };

  return (
    <main className="page">
      <h1>Penta</h1>
      {error && <p className="error">{error}</p>}
      {match && (
        <section className="card-panel">
          <h2>Match {matchID}</h2>
          <ul className="seat-list">
            {match.players.map((p) => (
              <li key={p.id} className={p.name ? '' : 'muted'}>
                {p.name ?? 'Open seat'}
              </li>
            ))}
          </ul>
          {freeSeat ? (
            <>
              <NameField name={name} setName={setName} />
              <button className="primary" disabled={!name.trim()} onClick={join}>
                Take a seat
              </button>
            </>
          ) : (
            <p className="muted">All four seats are taken.</p>
          )}
          <button onClick={() => setSpectating(true)}>Watch</button>
        </section>
      )}
      <button className="link" onClick={() => goTo(null)}>
        ← Back
      </button>
    </main>
  );
}

/** All four players' screens on one page, each in its own frame. Development only. */
function TestTable({ matchID }: { matchID: string }) {
  return (
    <div className="test-table">
      {[0, 1, 2, 3].map((p) => (
        <iframe key={p} title={`Player ${p + 1}`} src={`?match=${encodeURIComponent(matchID)}&as=${p}`} />
      ))}
    </div>
  );
}
