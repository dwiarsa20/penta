import { useEffect, useState } from 'react';
import type { BoardProps } from 'boardgame.io/react';
import { SERVER_URL } from './config';
import { GAMES, ROUNDS } from '../game/games';
import type { PentaView } from '../game/penta';
import type { MatchStandings } from '../shared/scoring';
import { fmt, Marks, Scoreboard } from './components/Scoreboard';
import { TRICK_SHOW_MS, TRICK_SLIDE_MS } from './components/TrickArea';
import { GAME_BOARDS } from './games';
import type { SeatPosition } from './games/types';

const POSITIONS: SeatPosition[] = ['bottom', 'left', 'top', 'right'];

export function PentaBoard({ G, ctx, moves, playerID, matchData }: BoardProps<PentaView>) {
  const [showScores, setShowScores] = useState(false);
  const me = playerID == null ? null : Number(playerID);
  const names = [0, 1, 2, 3].map((p) => matchData?.[p]?.name ?? `Seat ${p + 1}`);
  const joined = matchData?.filter((m) => m.name).length ?? 0;
  const active = Object.keys(ctx.activePlayers ?? {}).map(Number);
  // Rotate the table so you always sit at the bottom.
  const seat = (p: number) => POSITIONS[(p - (me ?? 0) + 4) % 4];

  const game = GAMES[G.gameIndex];
  const GameBoard = GAME_BOARDS[game.id];
  const lastHand = G.history[G.history.length - 1];
  const gameover = ctx.gameover as { standings: MatchStandings } | undefined;
  // Let the last trick of the hand finish on the table before the summary covers it.
  const showSummary = useDelayed(G.status === 'summary', TRICK_SHOW_MS + TRICK_SLIDE_MS);

  return (
    <div className="board">
      <header className="topbar">
        <div>
          <strong>{game.name}</strong>
          <span className="muted">
            {' '}
            · Round {G.round + 1}/{ROUNDS} · Game {G.gameIndex + 1}/{GAMES.length}
          </span>
        </div>
        <button onClick={() => setShowScores(true)}>Scores</button>
      </header>

      <div className="felt">
        {[0, 1, 2, 3]
          .filter((p) => p !== me)
          .map((p) => (
            <div key={p} className={`seat ${seat(p)}${active.includes(p) ? ' active' : ''}`}>
              <span className={`dot${matchData?.[p]?.isConnected ? ' on' : ''}`} />
              <span className="name">{names[p]}</span>
              <span className="count">{G.hand.handCounts[p]} cards</span>
              {GameBoard.Seat && <GameBoard.Seat view={G.hand} player={p} />}
            </div>
          ))}

        <GameBoard
          key={`${G.round}-${G.gameIndex}-${G.jumps}`}
          view={G.hand}
          me={me}
          round={G.round}
          active={G.status === 'playing' ? active : []}
          names={names}
          seat={seat}
          act={(action) => moves.act(action)}
        />
      </div>

      {G.lastError && G.lastError.player === me && G.status === 'playing' && (
        <div className="toast">{G.lastError.message}</div>
      )}

      {joined < 4 && !gameover && (
        <div className="overlay">
          <div className="panel">
            <h2>Waiting for players ({joined}/4)</h2>
            <p>Send this link to your friends:</p>
            <ShareLink />
            <ul className="seat-list">
              {names.map((n, p) => (
                <li key={p} className={matchData?.[p]?.name ? '' : 'muted'}>
                  {matchData?.[p]?.name ? n : 'Open seat'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showSummary && lastHand && (
        <div className="overlay">
          <div className="panel">
            <h2>{game.name} finished</h2>
            <table className="summary">
              <tbody>
                {names.map((n, p) => (
                  <tr key={p}>
                    <td>{n}</td>
                    <td>
                      {lastHand.scores[p]} <Marks record={lastHand} player={p} />
                    </td>
                    <td className="muted">{G.ready[p] ? 'ready' : '…'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {me != null && !G.ready[me] ? (
              <button className="primary" onClick={() => moves.ready()}>
                Next hand
              </button>
            ) : (
              <p className="muted">Waiting for everyone to continue…</p>
            )}
            <button onClick={() => setShowScores(true)}>Full scoresheet</button>
          </div>
        </div>
      )}

      {gameover && (
        <div className="overlay">
          <div className="panel">
            <h2>Penta complete</h2>
            <FinalRanking standings={gameover.standings} names={names} />
            <button onClick={() => setShowScores(true)}>Full scoresheet</button>
          </div>
        </div>
      )}

      {showScores && (
        <div className="overlay top" onClick={() => setShowScores(false)}>
          <div className="panel wide" onClick={(e) => e.stopPropagation()}>
            <Scoreboard history={G.history} names={names} />
            <button className="primary" onClick={() => setShowScores(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** True once `on` has stayed true for `ms`; false again as soon as it turns off. */
function useDelayed(on: boolean, ms: number) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    if (!on) return;
    const timer = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return on && done;
}

function FinalRanking({ standings, names }: { standings: MatchStandings; names: string[] }) {
  const order = names.map((_, p) => p).sort((a, b) => standings.final[b] - standings.final[a]);
  const top = standings.final[order[0]];
  return (
    <ol className="ranking">
      {order.map((p) => (
        <li key={p} className={standings.final[p] === top ? 'winner' : ''}>
          <span>{names[p]}</span>
          <strong>{fmt(standings.final[p])}</strong>
        </li>
      ))}
    </ol>
  );
}

function ShareLink() {
  const { url, lanOnly } = useShareUrl();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <div className="share">
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
        <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      {lanOnly && <p className="note">Friends need to be on the same Wi-Fi as this computer.</p>}
    </>
  );
}

const isLocalhost = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

/**
 * "localhost" only works on this computer, so when the page was opened that way, swap in
 * the public link (when hosting with `npm run host`) or else the computer's Wi-Fi address.
 */
function useShareUrl() {
  const [share, setShare] = useState({ url: window.location.href, lanOnly: false });
  useEffect(() => {
    if (!isLocalhost()) return;
    fetch(`${SERVER_URL}/share`)
      .then((r) => r.json() as Promise<{ public: string | null; lan: string[] }>)
      .then(({ public: online, lan: [ip] }) => {
        const here = new URL(window.location.href);
        if (online) {
          const u = new URL(here.pathname + here.search, online);
          setShare({ url: u.toString(), lanOnly: false });
        } else if (ip) {
          here.hostname = ip;
          setShare({ url: here.toString(), lanOnly: true });
        }
      })
      .catch(() => {});
  }, []);
  return share;
}
