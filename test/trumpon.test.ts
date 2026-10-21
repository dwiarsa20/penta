import { describe, expect, it } from 'vitest';
import { makeCard, newDeck, type Card, type Rank, type Suit } from '../src/shared/cards';
import { viewFor } from '../src/game/module';
import { cardPoints, legalCards, playable, trumpon, type TrumponState } from '../src/game/games/trumpon';

const c = (id: string): Card => {
  const suit = id.slice(-1) as Suit;
  const r = id.slice(0, -1);
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
  return makeCard(rank as Rank, suit);
};

const ids = (cards: Card[]) => cards.map((x) => x.id);

/** A deal where each player's three pile tops are `tops[p]`; everything else is filled in. */
function dealWithTops(tops: string[][]): TrumponState {
  const rest = newDeck().filter((x) => !tops.flat().includes(x.id));
  // dealAll goes round the table; each player's cards 0-3 are the hand, and 6, 9, 12 the pile tops.
  const mine = tops.map((t) => Array.from({ length: 13 }, (_, i) => ([6, 9, 12].includes(i) ? c(t[(i - 6) / 3]) : rest.pop()!)));
  const deck: Card[] = [];
  for (let i = 0; i < 13; i++) for (let p = 0; p < 4; p++) deck.push(mine[p][i]);
  return trumpon.deal(deck, 0);
}

/** Mid-hand state: these hands and piles (bottom to top), trump spades, player 0 to lead. */
function table(hands: string[][], piles: string[][][], trump: Suit = 'S'): TrumponState {
  const s = trumpon.deal(newDeck(), 0);
  return Object.assign(s, {
    hands: hands.map((h) => h.map(c)),
    piles: piles.map((ps) => ps.map((cards) => ({ cards: cards.map(c), up: cards.length > 0 }))),
    trump,
    caller: 0,
    turn: 0,
    leader: 0,
  });
}

const play = (s: TrumponState, p: number, id: string) => trumpon.apply(s, p, { type: 'play', cardId: id }, 0);

describe('Trumpon deal', () => {
  it('gives each player 4 cards in hand and 3 piles of 3', () => {
    const s = trumpon.deal(newDeck(), 0);
    expect(s.hands.map((h) => h.length)).toEqual([4, 4, 4, 4]);
    expect(s.piles.every((ps) => ps.length === 3 && ps.every((pl) => pl.cards.length === 3 && pl.up))).toBe(true);
  });

  it('names trump from the highest face-up pile card, whose owner leads', () => {
    const s = dealWithTops([['2C', '9D', '3H'], ['KD', '5S', '4C'], ['QS', '6H', '8C'], ['JH', '10S', '7D']]);
    expect(s.trump).toBe('D');
    expect(s.trumpCard).toEqual(c('KD'));
    expect(s.caller).toBe(1);
    expect(trumpon.activePlayers(s)).toEqual([1]);
  });

  it('breaks ties by suit: ♠ > ♥ > ♦ > ♣', () => {
    const s = dealWithTops([['AD', '2C', '3C'], ['AC', '4C', '5C'], ['AH', '6C', '7C'], ['8C', '9C', '10C']]);
    expect(s.trumpCard).toEqual(c('AH'));
    expect(s.caller).toBe(2);
  });

  it('shows everyone the pile tops only, and keeps hands private', () => {
    const s = trumpon.deal(newDeck(), 0);
    const seen = viewFor(trumpon, s, 1);
    expect(seen.piles[0][0].cards).toEqual([{ faceDown: true }, { faceDown: true }, s.piles[0][0].cards[2]]);
    expect(viewFor(trumpon, s, 0).piles[0][0].cards[0]).toEqual({ faceDown: true });
    expect(seen.hands[0]).toEqual([]);
  });
});

describe('Trumpon play', () => {
  it('plays from the hand or a face-up pile top, and both count for following suit', () => {
    const s = table(
      [['5H'], ['9C', 'AS'], ['2D'], ['3D']],
      [[[]], [['4H', 'KH'], ['QD']], [['7D']], [['8D']]],
    );
    expect(ids(playable(s, 1))).toEqual(['9C', 'AS', 'KH', 'QD']);
    play(s, 0, '5H');
    expect(ids(legalCards(s, 1))).toEqual(['KH']);
    expect(play(s, 1, '9C')).toBe('You must follow suit.');
    expect(play(s, 1, '4H')).toBe('You can’t play that card.');
  });

  it('keeps the card under a played pile card face down to everyone until the trick ends', () => {
    const s = table(
      [['5H'], ['9C'], ['2H'], ['3H']],
      [[[]], [['4H', 'KH']], [[]], [[]]],
    );
    play(s, 0, '5H');
    play(s, 1, 'KH');
    expect(viewFor(trumpon, s, 1).piles[1][0].cards).toEqual([{ faceDown: true }]);
    play(s, 2, '2H');
    play(s, 3, '3H');
    expect(viewFor(trumpon, s, 0).piles[1][0].cards).toEqual([c('4H')]);
    expect(s.lastTrick?.winner).toBe(1);
  });

  it('plays trumps from the hand face down, but from a pile face up', () => {
    const s = table(
      [['5H'], ['2S'], ['3H'], ['4H']],
      [[[]], [[]], [['6S']], [[]]],
    );
    play(s, 0, '5H');
    play(s, 1, '2S');
    expect(viewFor(trumpon, s, 0).trick[1]).toEqual({ faceDown: true });
    expect(viewFor(trumpon, s, 1).trick[1]).toEqual(c('2S'));
    s.hands[2] = [];
    play(s, 2, '6S');
    expect(viewFor(trumpon, s, 0).trick[2]).toEqual(c('6S'));
  });

  it("can't lead trump until it's broken, unless that's all you can play", () => {
    const s = table([['2S', '5H'], [], [], []], [[['KS']], [[]], [[]], [[]]]);
    expect(play(s, 0, 'KS')).toBe('Trump has not been broken yet.');
    expect(ids(legalCards(table([['2S']], [[['KS']]]), 0))).toEqual(['2S', 'KS']);
  });
});

describe('Trumpon scoring', () => {
  it('scores 2-5 +1, 6-9 -1 to -4, 10 +5, J-A +1 to +4', () => {
    const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as Rank[];
    expect(ranks.map((r) => cardPoints(makeCard(r, 'S')))).toEqual([1, 1, 1, 1, -1, -2, -3, -4, 5, 1, 2, 3, 4]);
  });

  it('gives the trick winner the points in it', () => {
    const s = table([['10H'], ['9H'], ['AH'], ['2S']], [[[]], [[]], [[]], [[]]]);
    for (const [p, id] of [[0, '10H'], [1, '9H'], [2, 'AH'], [3, '2S']] as const) play(s, p, id);
    expect(s.points).toEqual([0, 0, 0, 5 - 4 + 4 + 1]);
    expect(s.turn).toBe(3);
  });

  it('plays a whole hand with random legal cards, handing out all 36 points', () => {
    const s = trumpon.deal(newDeck(), 0);
    for (let guard = 0; guard < 60 && !trumpon.isOver(s); guard++) {
      const [p] = trumpon.activePlayers(s);
      const options = legalCards(s, p);
      const card = options[Math.floor(Math.random() * options.length)];
      expect(play(s, p, card.id)).toBeUndefined();
    }
    expect(trumpon.isOver(s)).toBe(true);
    expect(s.hands.flat()).toHaveLength(0);
    expect(s.piles.flat().every((pl) => pl.cards.length === 0)).toBe(true);
    expect(s.points.reduce((a, b) => a + b, 0)).toBe(36);
  });
});
