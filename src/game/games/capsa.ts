// Capsa: our house version of Big Two.
//
// Ranks: 3 low … K A 2 high. Suits: ♦ < ♣ < ♥ < ♠, only between cards of the same rank.
// Start: whoever holds the 3♦ leads every round, and their first play must include it.
// Play: singles, pairs, triples or 5-card hands. Play the same number of cards as the lead
//   but higher, or pass. Once you pass you're out until the next lead. When everyone else
//   is out, whoever played last leads anything.
// 5-card hands, low to high: straight, flush, full house, four of a kind (+1 card),
//   straight flush. Straights rank by top card: A-2-3-4-5 is lowest (Ace counts 1), then
//   2-3-4-5-6 up to 10-J-Q-K-A; the top card's suit breaks a tie. Flushes compare suit
//   first, then the highest card. Full house and four of a kind compare the set.
// Bombs: four of a kind and straight flushes. If you've never passed this hand, you can
//   play one on your turn on top of anything; after that only a higher bomb, from someone
//   who hasn't passed either, can beat it. Once you've passed, bombs are just the highest
//   5-card hands.
// End: the hand ends as soon as someone runs out of cards. Everyone scores the cards left
//   in their hand, lowest best.

import type { Card, Suit } from '../../shared/cards';
import { cardLabel, dealAll, rankLabel, SUIT_SYMBOL } from '../../shared/cards';
import type { GameModule, HandStateBase } from '../module';

export type ComboKind = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'fullHouse' | 'four' | 'straightFlush';

export interface Combo {
  kind: ComboKind;
  /** Higher beats lower within the same number of cards. */
  power: number;
}

export interface CapsaPlay {
  player: number;
  cards: Card[];
  combo: Combo;
}

export interface CapsaState extends HandStateBase {
  turn: number;
  /** The play on top of the table, or null when `turn` is leading. */
  current: CapsaPlay | null;
  /** Everything played since the last lead, oldest first. */
  trick: CapsaPlay[];
  /** Out of the current trick (passed, or can't beat a bomb). */
  out: boolean[];
  /** Has passed at least once this hand, so can no longer bomb. */
  passed: boolean[];
  /** A bomb was dropped on singles, pairs or triples: only a higher bomb can follow. */
  bombed: boolean;
  /** The first play of the hand must include the 3♦. */
  opening: boolean;
  winner: number | null;
  last: { player: number; play: CapsaPlay | null } | null;
}

export type CapsaAction = { type: 'play'; cardIds: string[] } | { type: 'pass' };

export const OPENING_CARD = '3D';
const SUIT_RANK: Record<Suit, number> = { D: 0, C: 1, H: 2, S: 3 };
const FIVE_ORDER: ComboKind[] = ['straight', 'flush', 'fullHouse', 'four', 'straightFlush'];

/** A rank's strength: 3 lowest, 2 highest. */
export const rankValue = (c: Card) => (c.rank === 2 ? 15 : c.rank);
export const cardPower = (c: Card) => rankValue(c) * 4 + SUIT_RANK[c.suit];

/** Display order: by strength, 3♦ first and 2♠ last. */
export const sortCapsa = (cards: Card[]) => [...cards].sort((a, b) => cardPower(a) - cardPower(b));

export const isBomb = (combo: Combo) => combo.kind === 'four' || combo.kind === 'straightFlush';

/** What `cards` make as a play, or null if they're not a valid combination. */
export function comboOf(cards: Card[]): Combo | null {
  const sorted = sortCapsa(cards);
  const top = sorted[sorted.length - 1];
  const sameRank = (cs: Card[]) => cs.every((c) => c.rank === cs[0].rank);
  if (cards.length === 1) return { kind: 'single', power: cardPower(top) };
  if (cards.length === 2) return sameRank(cards) ? { kind: 'pair', power: cardPower(top) } : null;
  if (cards.length === 3) return sameRank(cards) ? { kind: 'triple', power: rankValue(top) } : null;
  if (cards.length !== 5) return null;

  const five = (kind: ComboKind, power: number): Combo => ({ kind, power: FIVE_ORDER.indexOf(kind) * 1000 + power });
  const counts = new Map<number, Card[]>();
  for (const c of sorted) counts.set(c.rank, [...(counts.get(c.rank) ?? []), c]);
  const groups = [...counts.values()].sort((a, b) => b.length - a.length);
  if (groups[0].length === 4) return five('four', rankValue(groups[0][0]));
  if (groups[0].length === 3 && groups[1].length === 2) return five('fullHouse', rankValue(groups[0][0]));

  const flush = cards.every((c) => c.suit === cards[0].suit);
  const high = straightTop(cards);
  if (high && flush) return five('straightFlush', high.rank * 4 + SUIT_RANK[high.suit]);
  if (high) return five('straight', high.rank * 4 + SUIT_RANK[high.suit]);
  if (flush) return five('flush', SUIT_RANK[top.suit] * 100 + rankValue(top));
  return null;
}

/** The top card of a straight, by natural rank (A-2-3-4-5 tops at the 5), or null. */
function straightTop(cards: Card[]): Card | null {
  const byRank = [...cards].sort((a, b) => a.rank - b.rank);
  const ranks = byRank.map((c) => c.rank);
  if (ranks.join() === '2,3,4,5,14') return byRank[3];
  return ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1) ? byRank[4] : null;
}

const plural = (c: Card) => `${rankLabel(c.rank)}s`;

/** e.g. "pair of 8s", "full house, Ks", "straight to 9♠". */
export function comboLabel(play: { cards: Card[]; combo: Combo }): string {
  const cards = sortCapsa(play.cards);
  const top = cards[cards.length - 1];
  const set = [...cards].sort((a, b) => cards.filter((c) => c.rank === b.rank).length - cards.filter((c) => c.rank === a.rank).length)[0];
  const straightHigh = straightTop(cards);
  switch (play.combo.kind) {
    case 'single': return cardLabel(top);
    case 'pair': return `pair of ${plural(top)}`;
    case 'triple': return `three ${plural(top)}`;
    case 'straight': return `straight to ${cardLabel(straightHigh!)}`;
    case 'flush': return `${SUIT_SYMBOL[top.suit]} flush, ${rankLabel(top.rank)} high`;
    case 'fullHouse': return `full house, ${plural(set)}`;
    case 'four': return `four ${plural(set)}`;
    case 'straightFlush': return `straight flush to ${cardLabel(straightHigh!)}`;
  }
}

/** Why `player` can't play `cards` right now, or null if they can. */
export function playError(s: CapsaState, player: number, cards: Card[]): string | null {
  const combo = comboOf(cards);
  if (!combo) return 'That isn’t a single, pair, triple or 5-card hand.';
  if (s.opening && !cards.some((c) => c.id === OPENING_CARD)) return 'The first play must include the 3♦.';
  const cur = s.current;
  if (!cur) return null;
  const bomb = isBomb(combo);
  if (s.bombed && !bomb) return 'Only a higher bomb can beat a bomb.';
  if (cards.length !== cur.cards.length) {
    if (!bomb) return `Play ${cur.cards.length === 1 ? 'a single card' : `${cur.cards.length} cards`} to match.`;
    if (s.passed[player]) return 'You’ve passed this hand, so you can’t bomb.';
    return null;
  }
  return combo.power > cur.combo.power ? null : `That doesn’t beat the ${comboLabel(cur)}.`;
}

/** Whether `player` could possibly play on the current trick (only matters once it's bombed). */
const canFollow = (s: CapsaState, player: number) => !(s.bombed && s.passed[player]);

/** Move the turn on to the next player still in the trick; if none is left, the top play's owner leads. */
function advance(s: CapsaState) {
  for (let step = 1; step < 4; step++) {
    const p = (s.turn + step) % 4;
    if (p === s.current!.player) break;
    if (s.out[p]) continue;
    if (!canFollow(s, p)) {
      s.out[p] = true;
      continue;
    }
    s.turn = p;
    return;
  }
  // Everyone else is out: the last player to play leads.
  s.turn = s.current!.player;
  s.current = null;
  s.trick = [];
  s.out = [false, false, false, false];
  s.bombed = false;
}

export const capsa: GameModule<CapsaState, CapsaAction> = {
  id: 'capsa',
  name: 'Capsa',
  lowerIsBetter: true,

  deal(deck) {
    const hands = dealAll(deck).map(sortCapsa);
    return {
      hands,
      turn: hands.findIndex((h) => h.some((c) => c.id === OPENING_CARD)),
      current: null,
      trick: [],
      out: [false, false, false, false],
      passed: [false, false, false, false],
      bombed: false,
      opening: true,
      winner: null,
      last: null,
    };
  },

  activePlayers: (s) => (s.winner == null ? [s.turn] : []),

  apply(s, player, action) {
    if (s.winner != null) return 'The hand is over.';
    if (player !== s.turn) return 'Not your turn.';

    if (action.type === 'pass') {
      if (!s.current) return 'You’re leading, so you can’t pass.';
      s.out[player] = true;
      s.passed[player] = true;
      s.last = { player, play: null };
      advance(s);
      return;
    }
    if (action.type !== 'play') return 'Play or pass.';

    const ids = new Set(action.cardIds);
    const cards = s.hands[player].filter((c) => ids.has(c.id));
    if (!ids.size || cards.length !== ids.size || ids.size !== action.cardIds.length) return 'You don’t have those cards.';
    const error = playError(s, player, cards);
    if (error) return error;

    const play: CapsaPlay = { player, cards: sortCapsa(cards), combo: comboOf(cards)! };
    if (s.current && cards.length !== s.current.cards.length) s.bombed = true;
    s.hands[player] = s.hands[player].filter((c) => !ids.has(c.id));
    s.current = play;
    s.trick.push(play);
    s.opening = false;
    s.last = { player, play };
    if (!s.hands[player].length) {
      s.winner = player;
      return;
    }
    advance(s);
  },

  isOver: (s) => s.winner != null,

  handScores: (s) => s.hands.map((h) => h.length),
};
