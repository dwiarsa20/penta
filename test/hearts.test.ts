import { describe, expect, it } from 'vitest';
import { makeCard, newDeck, type Card, type Rank, type Suit } from '../src/shared/cards';
import { viewFor } from '../src/game/module';
import { hearts, heartsScores, legalCards, passTarget, trickWinner, type HeartsState } from '../src/game/games/hearts';

const c = (id: string): Card => {
  const suit = id.slice(-1) as Suit;
  const r = id.slice(0, -1);
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
  return makeCard(rank as Rank, suit);
};

const ids = (cards: Card[]) => cards.map((x) => x.id);

/** Everyone passes their first three cards. */
function passAll(s: HeartsState) {
  const passed = s.hands.map((h) => ids(h.slice(0, 3)));
  passed.forEach((cardIds, p) => expect(hearts.apply(s, p, { type: 'pass', cardIds }, 0)).toBeUndefined());
  return passed;
}

/** A hand in play with these cards, `tricksPlayed` tricks already done. */
function playState(hands: string[][], leader: number, tricksPlayed = 1): HeartsState {
  const s = hearts.deal(newDeck(), 3);
  return Object.assign(s, { hands: hands.map((h) => h.map(c)), turn: leader, leader, tricksPlayed });
}

describe('Hearts passing', () => {
  it('passes left, right, across, then not at all', () => {
    expect([0, 1, 2, 3].map((r) => hearts.deal(newDeck(), r).passDirection)).toEqual(['left', 'right', 'across', 'none']);
    expect([passTarget(0, 'left'), passTarget(0, 'right'), passTarget(0, 'across')]).toEqual([1, 3, 2]);
    expect(hearts.deal(newDeck(), 3).phase).toBe('play');
  });

  it('moves each player’s three cards to the right seat once all four have chosen', () => {
    const s = hearts.deal(newDeck(), 1); // right
    const passed = passAll(s);
    for (let p = 0; p < 4; p++) {
      const to = passTarget(p, 'right');
      expect(ids(s.received[to])).toEqual(passed[p]);
      expect(ids(s.hands[to])).toEqual(expect.arrayContaining(passed[p]));
      expect(s.hands[p]).toHaveLength(13);
    }
    expect(s.phase).toBe('play');
  });

  it('needs exactly three of your own cards', () => {
    const s = hearts.deal(newDeck(), 0);
    const mine = ids(s.hands[0]);
    expect(hearts.apply(s, 0, { type: 'pass', cardIds: mine.slice(0, 2) }, 0)).toBeTruthy();
    expect(hearts.apply(s, 0, { type: 'pass', cardIds: [mine[0], mine[0], mine[1]] }, 0)).toBeTruthy();
    expect(hearts.apply(s, 0, { type: 'pass', cardIds: [mine[0], mine[1], ids(s.hands[1])[0]] }, 0)).toBeTruthy();
    expect(s.passes[0]).toBeNull();
  });

  it('keeps passed cards hidden from everyone but the passer and receiver', () => {
    const s = hearts.deal(newDeck(), 0);
    hearts.apply(s, 0, { type: 'pass', cardIds: ids(s.hands[0].slice(0, 3)) }, 0);
    expect(viewFor(hearts, s, 0).passes[0]).toHaveLength(3);
    expect(viewFor(hearts, s, 1).passes[0]).toEqual([]);
    expect(viewFor(hearts, s, 1).passes[2]).toBeNull();
    passAll(Object.assign(s, { passes: [null, null, null, null] }));
    expect(viewFor(hearts, s, 1).received[1]).toHaveLength(3);
    expect(viewFor(hearts, s, 2).received[1]).toEqual([]);
  });
});

describe('Hearts play', () => {
  it('starts with whoever holds the 2♣, who must lead it', () => {
    const s = hearts.deal(newDeck(), 3);
    expect(s.hands[s.turn].some((x) => x.id === '2C')).toBe(true);
    expect(ids(legalCards(s, s.turn))).toEqual(['2C']);
  });

  it('allows no points on the first trick unless you have nothing else', () => {
    const s = playState([['2C'], ['QS', '5H', '9D'], ['QS', 'AH'], []], 0, 0);
    hearts.apply(s, 0, { type: 'play', cardId: '2C' }, 0);
    expect(ids(legalCards(s, 1))).toEqual(['9D']);
    expect(hearts.apply(s, 1, { type: 'play', cardId: 'QS' }, 0)).toBe('No points on the first trick.');
    expect(ids(legalCards(s, 2))).toEqual(['QS', 'AH']);
  });

  it("can't lead hearts until they're broken, unless you only have hearts", () => {
    const s = playState([['5H', '3D'], [], [], []], 0);
    expect(hearts.apply(s, 0, { type: 'play', cardId: '5H' }, 0)).toBe('Hearts have not been broken yet.');
    expect(ids(legalCards(playState([['5H', '9H'], [], [], []], 0), 0))).toEqual(['5H', '9H']);
  });

  it('must follow suit; the highest card of the suit led wins', () => {
    const s = playState([['5D', '2H'], ['KD', 'AS'], ['3H', '4C'], ['QS', '8D']], 0);
    hearts.apply(s, 0, { type: 'play', cardId: '5D' }, 0);
    expect(hearts.apply(s, 1, { type: 'play', cardId: 'AS' }, 0)).toBe('You must follow suit.');
    hearts.apply(s, 1, { type: 'play', cardId: 'KD' }, 0);
    hearts.apply(s, 2, { type: 'play', cardId: '3H' }, 0);
    hearts.apply(s, 3, { type: 'play', cardId: '8D' }, 0);
    expect(s.lastTrick?.winner).toBe(1);
    expect(s.points).toEqual([0, 1, 0, 0]);
    expect(s.heartsBroken).toBe(true);
    expect(s.turn).toBe(1);
    expect(trickWinner([c('5D'), c('AS'), c('3D'), c('2D')], 0)).toBe(0);
  });

  it('counts 1 per heart and 13 for the Q♠', () => {
    const s = playState([['5S'], ['QS'], ['AH'], ['2H']], 0);
    for (const [p, id] of [[0, '5S'], [1, 'QS'], [2, 'AH'], [3, '2H']] as const) hearts.apply(s, p, { type: 'play', cardId: id }, 0);
    expect(s.points).toEqual([0, 15, 0, 0]);
  });
});

describe('Hearts scoring', () => {
  it('scores the points taken, lowest best', () => {
    expect(heartsScores([3, 13, 0, 10])).toEqual([3, 13, 0, 10]);
    expect(hearts.lowerIsBetter).toBe(true);
  });

  it('shooting the moon scores 0 for the shooter and 26 for everyone else', () => {
    expect(heartsScores([0, 26, 0, 0])).toEqual([26, 0, 26, 26]);
  });

  it('plays a whole hand with random legal cards, handing out all 26 points', () => {
    for (const round of [0, 3]) {
      const s = hearts.deal(newDeck(), round);
      if (s.phase === 'pass') passAll(s);
      for (let guard = 0; guard < 60 && !hearts.isOver(s); guard++) {
        const [p] = hearts.activePlayers(s);
        const options = legalCards(s, p);
        const card = options[Math.floor(Math.random() * options.length)];
        expect(hearts.apply(s, p, { type: 'play', cardId: card.id }, round)).toBeUndefined();
      }
      expect(hearts.isOver(s)).toBe(true);
      expect(s.points.reduce((a, b) => a + b, 0)).toBe(26);
    }
  });
});
