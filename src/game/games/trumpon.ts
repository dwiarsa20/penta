// Trumpon: Truf's trick-taking with cards on the table instead of bids.
//
// Deal: 13 cards each: 4 in hand and 3 piles of 3 in front of you, top card face up.
// Trump: the highest face-up pile card (A high, ties ♠ > ♥ > ♦ > ♣) names trump, and
//   its owner leads first.
// Play: as Truf. You may play from your hand or the face-up top of any of your piles, and
//   both count for following suit. Trump can't be led until it's broken. Trumps from your
//   hand are played face down until the trick is complete; trumps from a pile stay face up,
//   since everyone has already seen them. The card under a played pile card stays face
//   down, to everyone, until the trick finishes.
// Scoring: the cards in the tricks you win. 2-5 are +1, 6-9 are -1 to -4, 10 is +5,
//   J-A are +1 to +4. The deck adds up to +36; highest wins.

import type { Card, FaceDownCard, Suit } from '../../shared/cards';
import { dealAll, isFaceDown, sortHand } from '../../shared/cards';
import type { GameModule, HandStateBase, HandView } from '../module';
import { trickWinner, type TableCard } from './truf';

/** A pile in front of a player, bottom card first. Only the top can be face up. */
export interface Pile {
  cards: TableCard[];
  up: boolean;
}

export interface TrumponState extends HandStateBase {
  piles: Pile[][];
  trump: Suit;
  /** The face-up pile card that named trump, and its owner (who led first). */
  trumpCard: Card;
  caller: number;
  trumpBroken: boolean;
  turn: number;
  /** Cards in the current trick, one slot per player; `leader` played first. */
  trick: (TableCard | null)[];
  /** Whether each trick card came from a pile (so a trump stays face up). */
  fromPile: boolean[];
  leader: number;
  lastTrick: { cards: Card[]; winner: number } | null;
  tricksPlayed: number;
  points: number[];
}

export type TrumponAction = { type: 'play'; cardId: string };

export const HAND_SIZE = 4;
export const PILES = 3;
export const TOTAL_TRICKS = 13;
const SUIT_RANK: Record<Suit, number> = { C: 0, D: 1, H: 2, S: 3 };

/** Points for a card won in a trick. */
export function cardPoints(card: Card): number {
  if (card.rank <= 5) return 1;
  if (card.rank <= 9) return 5 - card.rank; // 6 → -1 … 9 → -4
  if (card.rank === 10) return 5;
  return card.rank - 10; // J 1, Q 2, K 3, A 4
}

/** The pile tops you can see and play. */
export function pileTops(s: TrumponState, player: number): Card[] {
  return s.piles[player].flatMap((pile) => {
    const top = pile.cards[pile.cards.length - 1];
    return pile.up && top && !isFaceDown(top) ? [top] : [];
  });
}

/** Every card `player` could play: their hand and their face-up pile tops. */
export const playable = (s: TrumponState, player: number) => [...s.hands[player], ...pileTops(s, player)];

/** Cards `player` may play to the current trick. */
export function legalCards(s: TrumponState, player: number): Card[] {
  const cards = playable(s, player);
  const led = s.trick[s.leader];
  if (!led) {
    if (s.trumpBroken) return cards;
    const nonTrump = cards.filter((c) => c.suit !== s.trump);
    return nonTrump.length ? nonTrump : cards;
  }
  // Only trumps from a hand are face down, so a face-down lead means trump was led.
  const ledSuit = isFaceDown(led) ? s.trump : led.suit;
  const following = cards.filter((c) => c.suit === ledSuit);
  return following.length ? following : cards;
}

export const trumpon: GameModule<TrumponState, TrumponAction> = {
  id: 'trumpon',
  name: 'Trumpon',
  lowerIsBetter: false,

  deal(deck) {
    const dealt = dealAll(deck);
    const piles = dealt.map((cards) =>
      Array.from({ length: PILES }, (_, i) => ({
        cards: cards.slice(HAND_SIZE + i * 3, HAND_SIZE + i * 3 + 3),
        up: true,
      })),
    );
    // The highest face-up pile card names trump.
    let caller = 0;
    let trumpCard = piles[0][0].cards[2] as Card;
    piles.forEach((ps, p) =>
      ps.forEach((pile) => {
        const top = pile.cards[pile.cards.length - 1] as Card;
        if (top.rank > trumpCard.rank || (top.rank === trumpCard.rank && SUIT_RANK[top.suit] > SUIT_RANK[trumpCard.suit])) {
          trumpCard = top;
          caller = p;
        }
      }),
    );
    // Trump goes on the right of each hand.
    const order = (['C', 'D', 'H', 'S'] as Suit[]).filter((x) => x !== trumpCard.suit).concat(trumpCard.suit);
    return {
      hands: dealt.map((cards) => sortHand(cards.slice(0, HAND_SIZE), order)),
      piles,
      trump: trumpCard.suit,
      trumpCard,
      caller,
      trumpBroken: false,
      turn: caller,
      trick: [null, null, null, null],
      fromPile: [false, false, false, false],
      leader: caller,
      lastTrick: null,
      tricksPlayed: 0,
      points: [0, 0, 0, 0],
    };
  },

  activePlayers: (s) => (s.tricksPlayed < TOTAL_TRICKS ? [s.turn] : []),

  apply(s, player, action) {
    if (s.tricksPlayed >= TOTAL_TRICKS) return 'The hand is over.';
    if (action.type !== 'play') return 'Play a card.';
    if (player !== s.turn) return 'Not your turn.';
    const card = playable(s, player).find((c) => c.id === action.cardId);
    if (!card) return 'You can’t play that card.';
    if (!legalCards(s, player).some((c) => c.id === card.id)) {
      return s.trick[s.leader] ? 'You must follow suit.' : 'Trump has not been broken yet.';
    }

    const pile = s.piles[player].find((pl) => pl.up && (pl.cards[pl.cards.length - 1] as Card)?.id === card.id);
    if (pile) {
      pile.cards.pop();
      // The card underneath is turned up once the trick is done.
      pile.up = false;
    } else {
      s.hands[player] = s.hands[player].filter((c) => c.id !== card.id);
    }
    s.trick[player] = card;
    s.fromPile[player] = !!pile;
    if (card.suit === s.trump) s.trumpBroken = true;

    if (s.trick.some((c) => !c)) {
      s.turn = (s.turn + 1) % 4;
      return;
    }
    const cards = s.trick as Card[];
    const winner = trickWinner(cards, s.leader, s.trump);
    s.points[winner] += cards.reduce((sum, c) => sum + cardPoints(c), 0);
    s.tricksPlayed++;
    s.lastTrick = { cards, winner };
    s.trick = [null, null, null, null];
    s.fromPile = [false, false, false, false];
    s.turn = s.leader = winner;
    for (const ps of s.piles) for (const pl of ps) pl.up = pl.cards.length > 0;
  },

  isOver: (s) => s.tricksPlayed >= TOTAL_TRICKS,

  handScores: (s) => s.points,

  hideSecrets(view: HandView<TrumponState>, viewer) {
    const down: FaceDownCard = { faceDown: true };
    return {
      ...view,
      // Everyone, owner included, only sees face-up pile tops.
      piles: view.piles.map((ps) =>
        ps.map((pile) => ({
          ...pile,
          cards: pile.cards.map((c, i) => (pile.up && i === pile.cards.length - 1 ? c : down)),
        })),
      ),
      trick: view.trick.map((c, p) =>
        c && p !== viewer && !view.fromPile[p] && !isFaceDown(c) && c.suit === view.trump ? down : c,
      ),
    };
  },
};
