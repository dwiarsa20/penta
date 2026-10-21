// Standard 52-card deck shared by every Penta game.

export type Suit = 'C' | 'D' | 'H' | 'S';
// 2..10, J=11, Q=12, K=13, A=14
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string; // e.g. "QS", "10H"
  suit: Suit;
  rank: Rank;
}

/** A card someone else played or picked face down: you only see its back. */
export interface FaceDownCard {
  faceDown: true;
}

export const isFaceDown = (c: Card | FaceDownCard): c is FaceDownCard => 'faceDown' in c;

export const SUITS: Suit[] = ['C', 'D', 'H', 'S'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const SUIT_NAME: Record<Suit, string> = { C: 'Clubs', D: 'Diamonds', H: 'Hearts', S: 'Spades' };

export function rankLabel(rank: Rank): string {
  return ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[rank] ?? String(rank);
}

/** Short label for messages, e.g. "Q♠". */
export const cardLabel = (card: Card) => `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;

export function makeCard(rank: Rank, suit: Suit): Card {
  return { id: `${rankLabel(rank)}${suit}`, rank, suit };
}

export function newDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => makeCard(rank, suit)));
}

/** Deal the whole deck round-robin, starting with `first`. */
export function dealAll(deck: Card[], players = 4, first = 0): Card[][] {
  const hands: Card[][] = Array.from({ length: players }, () => []);
  deck.forEach((card, i) => hands[(first + i) % players].push(card));
  return hands;
}

/** Sort for display: grouped by suit, ascending rank. Games may pass their own suit order. */
export function sortHand(hand: Card[], suitOrder: Suit[] = ['C', 'D', 'H', 'S']): Card[] {
  return [...hand].sort(
    (a, b) => suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit) || a.rank - b.rank,
  );
}

export function removeCards(hand: Card[], ids: string[]): Card[] {
  return hand.filter((c) => !ids.includes(c.id));
}
