// Sevens: our house version of the layout game.
//
// Start: round 1 opens with the 7♠, then the 7♥, 7♦ and 7♣. Whoever holds it plays it first.
// Play: each suit builds up and down from its 7, and any 7 starts its suit. You must play
//   if you can. If you can't, close a card: lay it face down in front of you. It's out of
//   the hand and counts against you. The hand ends when everyone's hand is empty.
// Aces: until the first Ace is played, an Ace can go on its suit's K or below its 2. The
//   first one decides for the hand: on a K makes Aces high (later Aces only go on Ks),
//   below a 2 makes them low (later Aces only go below 2s).
// Closed suits: once Aces are set, a suit closes as soon as either end is finished (Aces
//   high: its A or its 2; Aces low: its A or its K) and nothing more goes on it. A suit
//   whose end was already finished when the Aces were set closes right then.
// Scoring: the total of your closed cards, lowest best. 2-10 face value, J 11, Q 12, K 13;
//   Aces 14 if high, 1 if low, 7 if no Ace was ever played.

import type { Card, FaceDownCard, Suit } from '../../shared/cards';
import { cardLabel, dealAll, isFaceDown, makeCard, SUIT_NAME, SUITS, sortHand } from '../../shared/cards';
import type { GameModule, HandStateBase, HandView } from '../module';

export type AceMode = 'high' | 'low';
export type End = 'high' | 'low';

/** The cards of a suit on the table run from `low` to `high`; an Ace is 1 below the 2, 14 above the K. */
export interface Row {
  low: number;
  high: number;
}

export interface SevensState extends HandStateBase {
  /** The suit whose 7 opens this hand. */
  start: Suit;
  turn: number;
  rows: Record<Suit, Row | null>;
  aces: AceMode | null;
  closedSuits: Record<Suit, boolean>;
  /** Cards each player closed; face down to the others until the hand ends. */
  closedCards: (Card | FaceDownCard)[][];
  last: { player: number; card: Card | FaceDownCard; closed: boolean } | null;
}

export type SevensAction = { type: 'play'; cardId: string; end?: End } | { type: 'close'; cardId: string };

/** Starting suit by round, and the order suits are shown in. */
export const SUIT_ORDER: Suit[] = ['S', 'H', 'D', 'C'];
export const UNSET_ACE = 7;

export const startSuit = (round: number) => SUIT_ORDER[round % SUIT_ORDER.length];

/** Where `card` can go on the table: an end of its suit's row (both for an Ace before Aces are set). */
export function placements(s: SevensState, card: Card): End[] {
  const row = s.rows[card.suit];
  // A 7 starts its row, but nothing goes down before the opening 7.
  if (!row) return card.rank === 7 && (s.rows[s.start] || card.suit === s.start) ? ['high'] : [];
  if (s.closedSuits[card.suit]) return [];
  if (card.rank === 14) {
    const ends: End[] = [];
    if (row.high === 13 && s.aces !== 'low') ends.push('high');
    if (row.low === 2 && s.aces !== 'high') ends.push('low');
    return ends;
  }
  if (card.rank === row.high + 1) return ['high'];
  if (card.rank === row.low - 1) return ['low'];
  return [];
}

/** Cards `player` can play right now. If there are none, they must close a card. */
export const legalCards = (s: SevensState, player: number) => s.hands[player].filter((c) => placements(s, c).length);

export function cardValue(card: Card, aces: AceMode | null): number {
  if (card.rank !== 14) return card.rank;
  return aces === 'high' ? 14 : aces === 'low' ? 1 : UNSET_ACE;
}

/** Points for the closed cards you can see (face-down ones count 0). */
export const closedPoints = (cards: (Card | FaceDownCard)[], aces: AceMode | null) =>
  cards.reduce((sum, c) => sum + (isFaceDown(c) ? 0 : cardValue(c, aces)), 0);

/** Whether a row's end is finished, so the suit closes. Only once Aces are set. */
function finished(row: Row, aces: AceMode | null) {
  if (aces === 'high') return row.high === 14 || row.low === 2;
  if (aces === 'low') return row.low === 1 || row.high === 13;
  return false;
}

function place(s: SevensState, card: Card, end: End) {
  const row = s.rows[card.suit];
  if (!row) {
    s.rows[card.suit] = { low: 7, high: 7 };
    return;
  }
  if (card.rank === 14) {
    if (!s.aces) s.aces = end;
    row[end] = end === 'high' ? 14 : 1;
  } else {
    row[end] = card.rank;
  }
  for (const suit of SUITS) {
    const r = s.rows[suit];
    if (r && finished(r, s.aces)) s.closedSuits[suit] = true;
  }
}

function whyNot(s: SevensState, card: Card): string {
  if (!s.rows[s.start]) return `The ${cardLabel(makeCard(7, s.start))} opens the hand.`;
  if (s.closedSuits[card.suit]) return `${SUIT_NAME[card.suit]} are closed.`;
  return 'That card doesn’t fit on the table yet.';
}

const isDone = (s: { hands: Card[][] }) => s.hands.every((h) => h.length === 0);

export const sevens: GameModule<SevensState, SevensAction> = {
  id: 'sevens',
  name: 'Sevens',
  lowerIsBetter: true,

  deal(deck, round) {
    const start = startSuit(round);
    const hands = dealAll(deck).map((h) => sortHand(h, SUIT_ORDER));
    return {
      hands,
      start,
      turn: hands.findIndex((h) => h.some((c) => c.rank === 7 && c.suit === start)),
      rows: { C: null, D: null, H: null, S: null },
      aces: null,
      closedSuits: { C: false, D: false, H: false, S: false },
      closedCards: [[], [], [], []],
      last: null,
    };
  },

  activePlayers: (s) => (isDone(s) ? [] : [s.turn]),

  apply(s, player, action) {
    if (isDone(s)) return 'The hand is over.';
    if (player !== s.turn) return 'Not your turn.';
    const card = s.hands[player].find((c) => c.id === action.cardId);
    if (!card) return 'You do not have that card.';

    if (action.type === 'close') {
      if (legalCards(s, player).length) return 'You can play a card, so you can’t close one.';
      s.closedCards[player].push(card);
    } else if (action.type === 'play') {
      const ends = placements(s, card);
      if (!ends.length) return whyNot(s, card);
      if (action.end && !ends.includes(action.end)) return 'That card can’t go there.';
      const end = action.end ?? (ends.length === 1 ? ends[0] : null);
      if (!end) return 'Choose whether the Ace goes on the K or below the 2.';
      place(s, card, end);
    } else {
      return 'Play or close a card.';
    }

    s.hands[player] = s.hands[player].filter((c) => c.id !== card.id);
    s.last = { player, card, closed: action.type === 'close' };
    s.turn = (s.turn + 1) % 4;
  },

  isOver: isDone,

  handScores: (s) => s.closedCards.map((cards) => closedPoints(cards, s.aces)),

  hideSecrets(view: HandView<SevensState>, viewer) {
    // Everyone's closed cards are turned over once the hand ends.
    if (view.handCounts.every((n) => n === 0)) return view;
    const down = { faceDown: true as const };
    return {
      ...view,
      closedCards: view.closedCards.map((cards, p) => (p === viewer ? cards : cards.map(() => down))),
      last: view.last?.closed && view.last.player !== viewer ? { ...view.last, card: down } : view.last,
    };
  },
};
