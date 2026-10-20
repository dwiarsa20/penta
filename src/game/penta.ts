// The boardgame.io definition of a full Penta match: 4 rounds x 5 games.
// All moves run on the server only (client: false), so hidden cards never have to
// reach the browser and shuffling can't be predicted.

import type { Game } from 'boardgame.io';
import { INVALID_MOVE, Stage } from 'boardgame.io/core';
import { newDeck } from '../shared/cards';
import { handMarks, matchStandings, type HandRecord } from '../shared/scoring';
import { GAMES, PLAYERS, ROUNDS } from './games';
import { viewFor, type HandStateBase, type HandView } from './module';

export interface PentaState {
  round: number; // 0-3
  gameIndex: number; // 0-4, index into GAMES
  status: 'playing' | 'summary' | 'finished';
  hand: HandStateBase;
  history: HandRecord[];
  ready: boolean[]; // who has confirmed the hand summary
  lastError: { player: number; message: string } | null;
}

/** What a client receives: the current hand with other players' cards hidden. */
export type PentaView = Omit<PentaState, 'hand'> & { hand: HandView };

export const lowerIsBetter = GAMES.map((g) => g.lowerIsBetter);

type Events = { setActivePlayers: (arg: any) => void };

function setActive(events: Events, players: number[]) {
  events.setActivePlayers({
    value: Object.fromEntries(players.map((p) => [String(p), Stage.NULL])),
  });
}

function activeFor(G: PentaState): number[] {
  if (G.status === 'summary') return G.ready.flatMap((r, p) => (r ? [] : [p]));
  if (G.status === 'finished') return [];
  return GAMES[G.gameIndex].activePlayers(G.hand);
}

export const Penta: Game<PentaState> = {
  name: 'penta',
  minPlayers: PLAYERS,
  maxPlayers: PLAYERS,
  disableUndo: true,

  setup: ({ random }) => ({
    round: 0,
    gameIndex: 0,
    status: 'playing',
    hand: GAMES[0].deal(random.Shuffle(newDeck()), 0),
    history: [],
    ready: Array(PLAYERS).fill(false),
    lastError: null,
  }),

  turn: {
    onBegin: ({ G, events }) => setActive(events, activeFor(G)),
  },

  moves: {
    /** A game action such as playing a card or bidding; its shape is up to the current game. */
    act: {
      client: false,
      move: ({ G, playerID, events }, action: unknown) => {
        if (G.status !== 'playing') return INVALID_MOVE;
        const game = GAMES[G.gameIndex];
        const player = Number(playerID);
        // Work on a plain copy so an illegal action can't leave a half-applied change.
        const hand = JSON.parse(JSON.stringify(G.hand)) as HandStateBase;
        const error = game.apply(hand, player, action, G.round);
        if (error) {
          G.lastError = { player, message: error };
          return;
        }
        G.hand = hand;
        G.lastError = null;
        if (game.isOver(G.hand)) {
          const scores = game.handScores(G.hand);
          G.history.push({
            round: G.round,
            gameIndex: G.gameIndex,
            scores,
            ...handMarks(scores, game.lowerIsBetter),
          });
          G.status = 'summary';
          G.ready = Array(PLAYERS).fill(false);
        }
        setActive(events, activeFor(G));
      },
    },

    /** Confirm the end-of-hand summary; the next hand is dealt once all four are ready. */
    ready: {
      client: false,
      move: ({ G, playerID, events, random }) => {
        if (G.status !== 'summary') return INVALID_MOVE;
        G.ready[Number(playerID)] = true;
        if (G.ready.every(Boolean)) {
          const lastHand = G.round === ROUNDS - 1 && G.gameIndex === GAMES.length - 1;
          if (lastHand) {
            G.status = 'finished';
          } else {
            G.gameIndex = (G.gameIndex + 1) % GAMES.length;
            if (G.gameIndex === 0) G.round++;
            G.status = 'playing';
            G.hand = GAMES[G.gameIndex].deal(random.Shuffle(newDeck()), G.round);
          }
        }
        setActive(events, activeFor(G));
      },
    },
  },

  endIf: ({ G }) =>
    G.status === 'finished' ? { standings: matchStandings(G.history, lowerIsBetter) } : undefined,

  playerView: ({ G, playerID }) => {
    const viewer = playerID == null ? null : Number(playerID);
    return { ...G, hand: viewFor(GAMES[G.gameIndex], G.hand, viewer) };
  },
};
