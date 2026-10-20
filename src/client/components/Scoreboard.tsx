import { Fragment } from 'react';
import { GAMES, ROUNDS } from '../../game/games';
import { lowerIsBetter } from '../../game/penta';
import { matchStandings, type HandRecord } from '../../shared/scoring';

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function Marks({ record, player }: { record?: HandRecord; player: number }) {
  if (!record) return null;
  return (
    <>
      {record.squares.includes(player) && <span className="mark square" title="Best this hand">□</span>}
      {record.triangles.includes(player) && <span className="mark triangle" title="Worst this hand">△</span>}
    </>
  );
}

/** Full match sheet: every hand's score with □/△, then each game's placement points and the total. */
export function Scoreboard({ history, names }: { history: HandRecord[]; names: string[] }) {
  const standings = matchStandings(history, lowerIsBetter);
  const players = names.map((_, p) => p);

  return (
    <div className="scoreboard">
      <table>
        <thead>
          <tr>
            <th />
            {names.map((n, p) => (
              <th key={p}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GAMES.map((game, g) => {
            const standing = standings.games[g];
            return (
              <Fragment key={game.id}>
                <tr className="game-row">
                  <th colSpan={5}>
                    {game.name} <span className="muted">({game.lowerIsBetter ? 'low' : 'high'} wins)</span>
                  </th>
                </tr>
                {Array.from({ length: ROUNDS }, (_, r) => {
                  const rec = history.find((h) => h.round === r && h.gameIndex === g);
                  return (
                    <tr key={r}>
                      <td className="muted">R{r + 1}</td>
                      {players.map((p) => (
                        <td key={p}>
                          {rec ? rec.scores[p] : '·'} <Marks record={rec} player={p} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="subtotal">
                  <td>Total</td>
                  {players.map((p) => (
                    <td key={p}>
                      {standing.totals[p]} <span className="pts">+{fmt(standing.points[p])}</span>
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
          <tr className="game-row">
            <th colSpan={5}>Match</th>
          </tr>
          <tr>
            <td>Placement</td>
            {players.map((p) => (
              <td key={p}>{fmt(standings.games.reduce((s, g) => s + g.points[p], 0))}</td>
            ))}
          </tr>
          <tr>
            <td>□</td>
            {players.map((p) => (
              <td key={p}>+{standings.squares[p]}</td>
            ))}
          </tr>
          <tr>
            <td>△</td>
            {players.map((p) => (
              <td key={p}>−{standings.triangles[p]}</td>
            ))}
          </tr>
          <tr className="final">
            <td>Penta</td>
            {players.map((p) => (
              <td key={p}>{fmt(standings.final[p])}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="note">Placement per game: 1st 5 · 2nd 3 · 3rd 1 · 4th 0, ties split the place's points.</p>
    </div>
  );
}
