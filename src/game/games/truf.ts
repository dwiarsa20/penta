// Truf: our house version of Spades, one player against three.
//
// Bidding: everyone secretly picks a card from their hand (it stays in the hand).
//   2-10 bid their number, A bids 1, J/Q/K bid 0. The bids are then shown to everyone,
//   and play waits until all four have confirmed. The highest bid card names trump and
//   its owner (the caller) leads. Ties: higher rank wins (so K > Q > J among 0 bids),
//   then suit rank Spades > Hearts > Diamonds > Clubs.
// Bawah / Atas: total of all bids under 13 is Bawah, over 13 is Atas. At exactly 13
//   the caller picks one, and every bid moves down 1 (Bawah, never below 0) or up 1 (Atas).
// Play: follow suit; trump can't be led until it's broken. Trumps are always played
//   face down and only turned over once the trick is complete.
// Scoring: hit your bid exactly to score it. Otherwise lose per trick off:
//   Bawah -1 under / -2 over, Atas -2 under / -1 over.
//   A 0 bid (J/Q/K) scores +5 if made, or -5 on top of the normal penalty if missed.
//   It keeps that +5/-5 even when Atas raises it to 1.

import type { Card, FaceDownCard, Rank, Suit } from '../../shared/cards';
import { dealAll, isFaceDown, sortHand } from '../../shared/cards';
import type { GameModule, HandStateBase, HandView } from '../module';

export type TrufMode = 'bawah' | 'atas';

/** A card on the table. On the server it's always a Card; other players may see it face down. */
export type TableCard = Card | FaceDownCard;

export interface TrufState extends HandStateBase {
  phase: 'bid' | 'reveal' | 'choose' | 'play' | 'done';
  /** The card each player picked to bid with; face down to others until all four have bid. */
  bidCards: (TableCard | null)[];
  /** Who has confirmed seeing the revealed bids. */
  confirmed: boolean[];
  /** Final bids, after any Bawah/Atas adjustment at a total of 13. */
  bids: number[];
  /** Bid with a J/Q/K: scored +5/-5 instead of the bid's value. */
  zeroBid: boolean[];
  caller: number | null;
  trump: Suit | null;
  mode: TrufMode | null;
  trumpBroken: boolean;
  turn: number;
  /** Cards in the current trick, one slot per player; `leader` played first. */
  trick: (TableCard | null)[];
  leader: number;
  lastTrick: { cards: Card[]; winner: number } | null;
  tricks: number[];
}

export type TrufAction =
  | { type: 'bid'; cardId: string }
  | { type: 'confirm' }
  | { type: 'mode'; mode: TrufMode }
  | { type: 'play'; cardId: string };

export const TOTAL_TRICKS = 13;
const SUIT_RANK: Record<Suit, number> = { C: 0, D: 1, H: 2, S: 3 };

/** The number a card bids: 2-10 face value, A = 1, J/Q/K = 0. */
export function bidValue(rank: Rank): number {
  if (rank === 14) return 1;
  return rank > 10 ? 0 : rank;
}

/** Index of the winning bid card: highest bid, then higher rank, then suit rank. */
export function highestBid(cards: Card[]): number {
  const key = (c: Card) => [bidValue(c.rank), c.rank, SUIT_RANK[c.suit]];
  let best = 0;
  cards.forEach((c, i) => {
    const [a, b] = [key(c), key(cards[best])];
    if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) best = i;
  });
  return best;
}

/** Score for one player's hand. */
export function trufScore(bid: number, tricks: number, mode: TrufMode, zeroBid: boolean): number {
  if (tricks === bid) return zeroBid ? 5 : bid;
  const under = Math.max(bid - tricks, 0);
  const over = Math.max(tricks - bid, 0);
  const penalty = mode === 'bawah' ? -under - 2 * over : -2 * under - over;
  return penalty + (zeroBid ? -5 : 0);
}

/** Cards `player` may play to the current trick. */
export function legalCards(s: TrufState, player: number): Card[] {
  const hand = s.hands[player];
  const led = s.trick[s.leader];
  if (!led) {
    if (s.trumpBroken) return hand;
    const nonTrump = hand.filter((c) => c.suit !== s.trump);
    return nonTrump.length ? nonTrump : hand;
  }
  // Only trumps are played face down, so a face-down lead means trump was led.
  const ledSuit = isFaceDown(led) ? s.trump : led.suit;
  const following = hand.filter((c) => c.suit === ledSuit);
  return following.length ? following : hand;
}

/** Winner of a full trick: highest trump, otherwise highest card of the suit led. */
export function trickWinner(trick: Card[], leader: number, trump: Suit): number {
  let best = leader;
  trick.forEach((c, p) => {
    const b = trick[best];
    // The best card so far is always of the suit led or trump, so an off-suit card only wins as trump.
    if (c.suit === b.suit ? c.rank > b.rank : c.suit === trump) best = p;
  });
  return best;
}

function setMode(s: TrufState, mode: TrufMode) {
  s.mode = mode;
  s.phase = 'play';
  s.turn = s.leader = s.caller!;
}

export const truf: GameModule<TrufState, TrufAction> = {
  id: 'truf',
  name: 'Truf',
  lowerIsBetter: false,

  deal(deck) {
    return {
      hands: dealAll(deck).map((h) => sortHand(h, ['C', 'D', 'H', 'S'])),
      phase: 'bid',
      bidCards: [null, null, null, null],
      confirmed: [false, false, false, false],
      bids: [0, 0, 0, 0],
      zeroBid: [false, false, false, false],
      caller: null,
      trump: null,
      mode: null,
      trumpBroken: false,
      turn: 0,
      trick: [null, null, null, null],
      leader: 0,
      lastTrick: null,
      tricks: [0, 0, 0, 0],
    };
  },

  activePlayers(s) {
    if (s.phase === 'bid') return s.bidCards.flatMap((c, p) => (c ? [] : [p]));
    if (s.phase === 'reveal') return s.confirmed.flatMap((c, p) => (c ? [] : [p]));
    if (s.phase === 'choose') return [s.caller!];
    if (s.phase === 'play') return [s.turn];
    return [];
  },

  apply(s, player, action) {
    if (s.phase === 'bid') {
      if (action.type !== 'bid') return 'Pick a card to bid with first.';
      if (s.bidCards[player]) return 'You have already bid.';
      const card = s.hands[player].find((c) => c.id === action.cardId);
      if (!card) return 'You do not have that card.';
      s.bidCards[player] = card;
      if (s.bidCards.some((c) => !c)) return;

      const cards = s.bidCards as Card[];
      s.bids = cards.map((c) => bidValue(c.rank));
      s.zeroBid = s.bids.map((b) => b === 0);
      s.caller = highestBid(cards);
      s.trump = cards[s.caller].suit;
      s.phase = 'reveal';
      // Trump goes on the right of each hand.
      const order = (['C', 'D', 'H', 'S'] as Suit[]).filter((x) => x !== s.trump).concat(s.trump);
      s.hands = s.hands.map((h) => sortHand(h, order));
      return;
    }

    if (s.phase === 'reveal') {
      if (action.type !== 'confirm') return 'Waiting for everyone to see the bids.';
      s.confirmed[player] = true;
      if (s.confirmed.some((c) => !c)) return;
      const total = s.bids.reduce((a, b) => a + b, 0);
      if (total === TOTAL_TRICKS) s.phase = 'choose';
      else setMode(s, total < TOTAL_TRICKS ? 'bawah' : 'atas');
      return;
    }

    if (s.phase === 'choose') {
      if (player !== s.caller) return 'The caller is choosing Bawah or Atas.';
      if (action.type !== 'mode' || (action.mode !== 'bawah' && action.mode !== 'atas')) {
        return 'Choose Bawah or Atas.';
      }
      s.bids = s.bids.map((b) => (action.mode === 'bawah' ? Math.max(b - 1, 0) : b + 1));
      setMode(s, action.mode);
      return;
    }

    if (s.phase !== 'play') return 'The hand is over.';
    if (action.type !== 'play') return 'Play a card.';
    if (player !== s.turn) return 'Not your turn.';
    const card = s.hands[player].find((c) => c.id === action.cardId);
    if (!card) return 'You do not have that card.';
    if (!legalCards(s, player).some((c) => c.id === card.id)) {
      const led = s.trick[s.leader];
      return led ? 'You must follow suit.' : 'Trump has not been broken yet.';
    }

    s.hands[player] = s.hands[player].filter((c) => c.id !== card.id);
    s.trick[player] = card;
    if (card.suit === s.trump) s.trumpBroken = true;

    if (s.trick.some((c) => !c)) {
      s.turn = (s.turn + 1) % 4;
      return;
    }
    const cards = s.trick as Card[];
    const winner = trickWinner(cards, s.leader, s.trump!);
    s.tricks[winner]++;
    s.lastTrick = { cards, winner };
    s.trick = [null, null, null, null];
    s.turn = s.leader = winner;
    if (s.hands.every((h) => h.length === 0)) s.phase = 'done';
  },

  isOver: (s) => s.phase === 'done',

  handScores: (s) => s.bids.map((b, p) => trufScore(b, s.tricks[p], s.mode!, s.zeroBid[p])),

  hideSecrets(view: HandView<TrufState>, viewer) {
    const down = (c: TableCard | null, p: number, hide: boolean) => (c && p !== viewer && hide ? { faceDown: true as const } : c);
    return {
      ...view,
      bidCards: view.bidCards.map((c, p) => down(c, p, view.phase === 'bid')),
      trick: view.trick.map((c, p) => down(c, p, !!c && !isFaceDown(c) && c.suit === view.trump)),
    };
  },
};
