// Plays a whole Penta match through boardgame.io's local client to check the
// match flow: 20 hands, summaries, and the final standings.

import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { Penta, type PentaView } from '../src/game/penta';

let matchCount = 0;

function setup() {
  // Local matches share storage, so each test needs its own match ID.
  const spec = { game: Penta, numPlayers: 4, multiplayer: Local(), matchID: `test-${++matchCount}` };
  const clients = ['0', '1', '2', '3'].map((playerID) => Client({ ...spec, playerID }));
  clients.forEach((c) => c.start());
  const state = (p: number) => clients[p].getState()!;
  return { clients, state };
}

describe('Penta match flow', () => {
  it('hides other players’ cards', () => {
    const { state } = setup();
    const G = state(0).G as PentaView;
    expect(G.hand.hands[0]).toHaveLength(13);
    expect(G.hand.hands[1]).toHaveLength(0);
    expect(G.hand.handCounts).toEqual([13, 13, 13, 13]);
  });

  it('plays 20 hands and ends with standings', () => {
    const { clients, state } = setup();
    let hands = 0;
    for (let guard = 0; guard < 1000 && !state(0).ctx.gameover; guard++) {
      const { G, ctx } = state(0);
      const active = Object.keys(ctx.activePlayers ?? {}).map(Number);
      const p = active[0];
      const view = state(p).G as PentaView;
      if (view.status === 'playing') {
        clients[p].moves.act({ type: 'play', cardId: view.hand.hands[p][0].id });
      } else if (G.status === 'summary') {
        if (p === 0) hands++;
        clients[p].moves.ready();
      }
    }
    const { G, ctx } = state(0);
    expect(hands).toBe(20);
    expect(G.history).toHaveLength(20);
    expect(G.status).toBe('finished');
    const final: number[] = ctx.gameover.standings.final;
    // 5 games x (5+3+1+0) placement points, plus squares minus triangles.
    const marks = G.history.reduce((n, h) => n + h.squares.length - h.triangles.length, 0);
    expect(final.reduce((a, b) => a + b, 0)).toBeCloseTo(5 * 9 - countTieLoss(G) + marks);
  });

  it('rejects playing out of turn without changing the hand', () => {
    const { clients, state } = setup();
    const active = Object.keys(state(0).ctx.activePlayers ?? {}).map(Number);
    const other = (active[0] + 1) % 4;
    const before = (state(other).G as PentaView).hand.hands[other].length;
    clients[other].moves.act({ type: 'play', cardId: (state(other).G as PentaView).hand.hands[other][0].id });
    expect((state(other).G as PentaView).hand.hands[other]).toHaveLength(before);
  });
});

/** With competition ranking, a tie skips places, so fewer than 9 points get handed out. */
function countTieLoss(G: Pick<PentaView, 'history'>) {
  let lost = 0;
  for (let g = 0; g < 5; g++) {
    const totals = [0, 0, 0, 0];
    G.history.filter((h) => h.gameIndex === g).forEach((h) => h.scores.forEach((s, p) => (totals[p] += s)));
    const sorted = [...totals].sort((a, b) => b - a);
    const table = [5, 3, 1, 0];
    const awarded = sorted.reduce((sum, v, i) => (sorted.indexOf(v) === i ? sum + table[i] : sum), 0);
    lost += 9 - awarded;
  }
  return lost;
}
