// Plays a whole Penta match through boardgame.io's local client to check the
// match flow: 20 hands, summaries, and the final standings.

import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { lowerIsBetter, Penta, type PentaView } from '../src/game/penta';
import { GAMES } from '../src/game/games';
import { legalCards, type TrufState } from '../src/game/games/truf';
import { legalCards as heartsLegal, type HeartsState } from '../src/game/games/hearts';
import type { HandView } from '../src/game/module';

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
        clients[p].moves.act(autoAction(view, p));
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

  it('rejects an illegal action without changing the hand', () => {
    const { clients, state } = setup();
    // Truf starts with bidding, so playing a card is illegal.
    clients[0].moves.act({ type: 'play', cardId: (state(0).G as PentaView).hand.hands[0][0].id });
    const G = state(0).G as PentaView;
    expect(G.hand.hands[0]).toHaveLength(13);
    expect(G.lastError).toEqual({ player: 0, message: 'Pick a card to bid with first.' });
  });
});

/** The simplest legal action for player `p` in the current game. */
function autoAction(G: PentaView, p: number): unknown {
  if (GAMES[G.gameIndex].id === 'truf') {
    const s = G.hand as HandView<TrufState>;
    if (s.phase === 'bid') return { type: 'bid', cardId: s.hands[p][0].id };
    if (s.phase === 'reveal') return { type: 'confirm' };
    if (s.phase === 'choose') return { type: 'mode', mode: 'bawah' };
    return { type: 'play', cardId: legalCards(s, p)[0].id };
  }
  if (GAMES[G.gameIndex].id === 'hearts') {
    const s = G.hand as HandView<HeartsState>;
    if (s.phase === 'pass') return { type: 'pass', cardIds: s.hands[p].slice(0, 3).map((c) => c.id) };
    return { type: 'play', cardId: heartsLegal(s, p)[0].id };
  }
  return { type: 'play', cardId: G.hand.hands[p][0].id };
}

/** With competition ranking, a tie skips places, so fewer than 9 points get handed out. */
function countTieLoss(G: Pick<PentaView, 'history'>) {
  let lost = 0;
  for (let g = 0; g < 5; g++) {
    const totals = [0, 0, 0, 0];
    G.history.filter((h) => h.gameIndex === g).forEach((h) => h.scores.forEach((s, p) => (totals[p] += s)));
    const sorted = [...totals].sort((a, b) => (lowerIsBetter[g] ? a - b : b - a));
    const table = [5, 3, 1, 0];
    const awarded = sorted.reduce((sum, v, i) => (sorted.indexOf(v) === i ? sum + table[i] : sum), 0);
    lost += 9 - awarded;
  }
  return lost;
}
