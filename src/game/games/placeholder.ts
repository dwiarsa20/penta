// Stand-in for a game that hasn't been built yet, so a full Penta match can be
// played end to end. Each player plays one card; the hand score is that card's rank.

import type { Card } from '../../shared/cards';
import { dealAll, sortHand } from '../../shared/cards';
import type { GameId, GameModule, HandStateBase } from '../module';

export interface PlaceholderState extends HandStateBase {
  turn: number;
  played: (Card | null)[];
}

export type PlaceholderAction = { type: 'play'; cardId: string };

export function placeholderGame(id: GameId, name: string): GameModule<PlaceholderState, PlaceholderAction> {
  return {
    id,
    name,
    lowerIsBetter: false,

    deal(deck, round) {
      return {
        hands: dealAll(deck).map((h) => sortHand(h)),
        turn: round % 4,
        played: [null, null, null, null],
      };
    },

    activePlayers: (s) => (s.played.every(Boolean) ? [] : [s.turn]),

    apply(s, player, action) {
      if (player !== s.turn) return 'Not your turn.';
      if (action.type !== 'play') return 'Unknown action.';
      const card = s.hands[player].find((c) => c.id === action.cardId);
      if (!card) return 'You do not have that card.';
      s.hands[player] = s.hands[player].filter((c) => c.id !== card.id);
      s.played[player] = card;
      s.turn = (s.turn + 1) % 4;
    },

    isOver: (s) => s.played.every(Boolean),

    handScores: (s) => s.played.map((c) => c?.rank ?? 0),
  };
}
