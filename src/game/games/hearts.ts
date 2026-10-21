// Hearts, standard rules.
//
// Passing: everyone passes 3 cards at once. The direction follows the round:
//   left, right, across, then no pass.
// Play: the 2♣ leads the first trick. Follow suit; no trump, highest card of the suit
//   led wins. No hearts or Q♠ on the first trick unless you have nothing else, and
//   hearts can't be led until one has been played (unless you hold only hearts).
// Scoring: 1 point per heart, 13 for the Q♠; lowest wins. Shooting the moon (all 26)
//   scores 0 for the shooter and 26 for everyone else.

import type { Card, Suit } from '../../shared/cards';
import { dealAll, sortHand } from '../../shared/cards';
import type { GameModule, HandStateBase, HandView } from '../module';

export const PASS_DIRECTIONS = ['left', 'right', 'across', 'none'] as const;
export type PassDirection = (typeof PASS_DIRECTIONS)[number];
const PASS_OFFSET: Record<PassDirection, number> = { left: 1, right: 3, across: 2, none: 0 };

export const PASS_COUNT = 3;
export const TWO_CLUBS = '2C';
export const QUEEN_SPADES = 'QS';
export const MOON = 26;
const SUIT_ORDER: Suit[] = ['C', 'D', 'S', 'H'];

export interface HeartsState extends HandStateBase {
  phase: 'pass' | 'play' | 'done';
  passDirection: PassDirection;
  /** Cards each player chose to pass. Others only see [] once someone has chosen. */
  passes: (Card[] | null)[];
  /** Cards each player was passed; only visible to that player. */
  received: Card[][];
  heartsBroken: boolean;
  turn: number;
  /** Cards in the current trick, one slot per player; `leader` played first. */
  trick: (Card | null)[];
  leader: number;
  lastTrick: { cards: Card[]; winner: number } | null;
  tricksPlayed: number;
  /** Points won so far this hand. */
  points: number[];
}

export type HeartsAction = { type: 'pass'; cardIds: string[] } | { type: 'play'; cardId: string };

/** The seat player `p` passes to. Seats go left around the table, as play does. */
export const passTarget = (p: number, dir: PassDirection) => (p + PASS_OFFSET[dir]) % 4;

export const cardPoints = (c: Card) => (c.suit === 'H' ? 1 : c.id === QUEEN_SPADES ? 13 : 0);

/** Final hand scores: points taken, unless someone shot the moon. */
export function heartsScores(points: number[]): number[] {
  const shooter = points.indexOf(MOON);
  return shooter < 0 ? points : points.map((_, p) => (p === shooter ? 0 : MOON));
}

/** Cards `player` may play to the current trick. */
export function legalCards(s: HeartsState, player: number): Card[] {
  const hand = s.hands[player];
  const led = s.trick[s.leader];
  const firstTrick = s.tricksPlayed === 0;
  if (!led) {
    if (firstTrick) return hand.filter((c) => c.id === TWO_CLUBS);
    if (s.heartsBroken) return hand;
    const nonHearts = hand.filter((c) => c.suit !== 'H');
    return nonHearts.length ? nonHearts : hand;
  }
  const following = hand.filter((c) => c.suit === led.suit);
  if (following.length) return following;
  if (firstTrick) {
    const noPoints = hand.filter((c) => cardPoints(c) === 0);
    if (noPoints.length) return noPoints;
  }
  return hand;
}

/** Winner of a full trick: the highest card of the suit led. */
export function trickWinner(trick: Card[], leader: number): number {
  let best = leader;
  trick.forEach((c, p) => {
    if (c.suit === trick[best].suit && c.rank > trick[best].rank) best = p;
  });
  return best;
}

function startPlay(s: HeartsState) {
  s.phase = 'play';
  s.turn = s.leader = s.hands.findIndex((h) => h.some((c) => c.id === TWO_CLUBS));
}

export const hearts: GameModule<HeartsState, HeartsAction> = {
  id: 'hearts',
  name: 'Hearts',
  lowerIsBetter: true,

  deal(deck, round) {
    const passDirection = PASS_DIRECTIONS[round % PASS_DIRECTIONS.length];
    const s: HeartsState = {
      hands: dealAll(deck).map((h) => sortHand(h, SUIT_ORDER)),
      phase: 'pass',
      passDirection,
      passes: [null, null, null, null],
      received: [[], [], [], []],
      heartsBroken: false,
      turn: 0,
      trick: [null, null, null, null],
      leader: 0,
      lastTrick: null,
      tricksPlayed: 0,
      points: [0, 0, 0, 0],
    };
    if (passDirection === 'none') startPlay(s);
    return s;
  },

  activePlayers(s) {
    if (s.phase === 'pass') return s.passes.flatMap((c, p) => (c ? [] : [p]));
    if (s.phase === 'play') return [s.turn];
    return [];
  },

  apply(s, player, action) {
    if (s.phase === 'pass') {
      if (action.type !== 'pass') return `Pass ${PASS_COUNT} cards first.`;
      if (s.passes[player]) return 'You have already passed.';
      const ids = [...new Set(action.cardIds ?? [])];
      if (ids.length !== PASS_COUNT) return `Choose exactly ${PASS_COUNT} cards to pass.`;
      const cards = ids.map((id) => s.hands[player].find((c) => c.id === id));
      if (cards.some((c) => !c)) return 'You do not have that card.';
      s.passes[player] = cards as Card[];
      if (s.passes.some((c) => !c)) return;

      const passes = s.passes as Card[][];
      const hands = s.hands.map((h, p) => h.filter((c) => !passes[p].some((x) => x.id === c.id)));
      passes.forEach((cards, p) => {
        const to = passTarget(p, s.passDirection);
        hands[to].push(...cards);
        s.received[to] = cards;
      });
      s.hands = hands.map((h) => sortHand(h, SUIT_ORDER));
      startPlay(s);
      return;
    }

    if (s.phase !== 'play') return 'The hand is over.';
    if (action.type !== 'play') return 'Play a card.';
    if (player !== s.turn) return 'Not your turn.';
    const card = s.hands[player].find((c) => c.id === action.cardId);
    if (!card) return 'You do not have that card.';
    if (!legalCards(s, player).some((c) => c.id === card.id)) {
      const led = s.trick[s.leader];
      if (!led) return s.tricksPlayed === 0 ? 'The 2♣ leads the first trick.' : 'Hearts have not been broken yet.';
      return s.hands[player].some((c) => c.suit === led.suit) ? 'You must follow suit.' : 'No points on the first trick.';
    }

    s.hands[player] = s.hands[player].filter((c) => c.id !== card.id);
    s.trick[player] = card;
    if (card.suit === 'H') s.heartsBroken = true;

    if (s.trick.some((c) => !c)) {
      s.turn = (s.turn + 1) % 4;
      return;
    }
    const cards = s.trick as Card[];
    const winner = trickWinner(cards, s.leader);
    s.points[winner] += cards.reduce((sum, c) => sum + cardPoints(c), 0);
    s.tricksPlayed++;
    s.lastTrick = { cards, winner };
    s.trick = [null, null, null, null];
    s.turn = s.leader = winner;
    if (s.hands.every((h) => h.length === 0)) s.phase = 'done';
  },

  isOver: (s) => s.phase === 'done',

  handScores: (s) => heartsScores(s.points),

  hideSecrets(view: HandView<HeartsState>, viewer) {
    return {
      ...view,
      passes: view.passes.map((c, p) => (p === viewer || !c ? c : [])),
      received: view.received.map((c, p) => (p === viewer ? c : [])),
    };
  },
};
