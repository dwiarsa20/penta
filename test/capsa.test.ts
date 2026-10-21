import { describe, expect, it } from 'vitest';
import { makeCard, newDeck, type Card, type Rank, type Suit } from '../src/shared/cards';
import { capsa, comboLabel, comboOf, playError, type CapsaState } from '../src/game/games/capsa';

const c = (id: string): Card => {
  const suit = id.slice(-1) as Suit;
  const r = id.slice(0, -1);
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
  return makeCard(rank as Rank, suit);
};

const cards = (s: string) => s.split(' ').map(c);
const combo = (s: string) => comboOf(cards(s));
const beats = (a: string, b: string) => combo(a)!.power > combo(b)!.power;

/** Mid-hand state: these hands, player 0 to lead, past the opening play. */
function table(hands: string[]): CapsaState {
  const s = capsa.deal(newDeck(), 0);
  return Object.assign(s, { hands: hands.map((h) => (h ? cards(h) : [])), turn: 0, opening: false });
}

const play = (s: CapsaState, p: number, h: string) => capsa.apply(s, p, { type: 'play', cardIds: cards(h).map((x) => x.id) }, 0);
const pass = (s: CapsaState, p: number) => capsa.apply(s, p, { type: 'pass' }, 0);

describe('Capsa combinations', () => {
  it('ranks singles 3 low to 2 high, with suits ♦ < ♣ < ♥ < ♠', () => {
    expect(beats('2D', 'AS')).toBe(true);
    expect(beats('3C', '3D')).toBe(true);
    expect(beats('KS', 'KH')).toBe(true);
    expect(beats('4D', '3S')).toBe(true);
  });

  it('compares pairs by rank, then the higher suit', () => {
    expect(beats('9D 9C', '8H 8S')).toBe(true);
    expect(beats('8C 8S', '8D 8H')).toBe(true);
    expect(combo('8C 9C')).toBeNull();
  });

  it('ranks straights by top card, with A-2-3-4-5 lowest and 10-J-Q-K-A highest', () => {
    expect(combo('AS 2D 3C 4H 5D')?.kind).toBe('straight');
    expect(combo('2S 3D 4C 5H 6D')?.kind).toBe('straight');
    expect(combo('JS QD KC AH 2D')).toBeNull();
    expect(beats('2S 3D 4C 5H 6D', 'AS 2D 3C 4H 5S')).toBe(true);
    expect(beats('3S 4D 5C 6H 7D', '2S 3D 4C 5H 6S')).toBe(true);
    expect(beats('10D JC QH KS AD', '9S 10D JC QH KS')).toBe(true);
    // Same top card: its suit decides.
    expect(beats('3D 4D 5C 6H 7S', '3S 4S 5S 6H 7H')).toBe(true);
  });

  it('compares flushes by suit first, then the highest card', () => {
    expect(beats('3S 5S 7S 9S JS', '2H AH 4H 6H 8H')).toBe(true);
    expect(beats('3H 5H 7H 9H 2H', '4H 6H 8H 10H AH')).toBe(true);
  });

  it('orders 5-card hands straight < flush < full house < four of a kind < straight flush', () => {
    const hands = ['10D JC QH KS AD', '3C 5C 7C 9C JC', '3D 3C 3H 4S 4D', '5D 5C 5H 5S 3S', '4H 5H 6H 7H 8H'];
    expect(hands.map((h) => combo(h)?.kind)).toEqual(['straight', 'flush', 'fullHouse', 'four', 'straightFlush']);
    for (let i = 1; i < hands.length; i++) expect(beats(hands[i], hands[i - 1])).toBe(true);
    expect(beats('2D 2C 2H 3S 3D', 'AD AC AH KS KD')).toBe(true);
    expect(combo('5D 5C 5H 5S')).toBeNull();
  });

  it('names plays for the table', () => {
    expect(comboLabel({ cards: cards('3D 3C 3H 4S 4D'), combo: combo('3D 3C 3H 4S 4D')! })).toBe('full house, 3s');
    expect(comboLabel({ cards: cards('AS 2D 3C 4H 5D'), combo: combo('AS 2D 3C 4H 5D')! })).toBe('straight to 5♦');
  });
});

describe('Capsa play', () => {
  it('starts with whoever holds the 3♦, whose first play must include it', () => {
    const s = capsa.deal(newDeck(), 2);
    expect(s.hands[s.turn].some((x) => x.id === '3D')).toBe(true);
    const other = s.hands[s.turn].find((x) => x.id !== '3D')!;
    expect(capsa.apply(s, s.turn, { type: 'play', cardIds: [other.id] }, 0)).toBe('The first play must include the 3♦.');
    expect(capsa.apply(s, s.turn, { type: 'pass' }, 0)).toBe('You’re leading, so you can’t pass.');
    expect(capsa.apply(s, s.turn, { type: 'play', cardIds: ['3D'] }, 0)).toBeUndefined();
  });

  it('needs the same number of cards, higher', () => {
    const s = table(['5D 5C 9S', '6D 6C 7S 3H', '', '']);
    expect(play(s, 0, '5D 5C')).toBeUndefined();
    expect(play(s, 1, '7S')).toBe('Play 2 cards to match.');
    expect(play(s, 1, '6D 6C')).toBeUndefined();
  });

  it('keeps a player who passed out until the next lead, which goes to the last player', () => {
    const s = table(['5D 9S', '6D 7D', '8D 3S', 'KD 4S']);
    play(s, 0, '5D');
    pass(s, 1);
    play(s, 2, '8D');
    pass(s, 3);
    // Player 1 passed, so it's back to player 0.
    expect(s.turn).toBe(0);
    pass(s, 0);
    expect([s.turn, s.current]).toEqual([2, null]);
    expect(s.out).toEqual([false, false, false, false]);
  });

  it('lets a player who has never passed bomb anything, and then only a higher bomb follows', () => {
    const s = table(['2S 3D', '5D 5C 5H 5S 3S 4D', '4H 5H 6H 7H 8H 9D', '9H 9C 9S 9D 3C KS']);
    play(s, 0, '2S');
    expect(play(s, 1, '5D 5C 5H 5S 3S')).toBeUndefined();
    expect(play(s, 2, '9D')).toBe('Only a higher bomb can beat a bomb.');
    expect(play(s, 2, '4H 5H 6H 7H 8H')).toBeUndefined();
    expect(play(s, 3, '9H 9C 9S 9D 3C')).toBe('That doesn’t beat the straight flush to 8♥.');
  });

  it('turns bombs into ordinary 5-card hands once you have passed', () => {
    const s = table(['3D 4D 6C', '6D 5S 5C 5H 5D 3C', '9D 3S', '10D 3H 4C']);
    play(s, 0, '3D');
    pass(s, 1);
    play(s, 2, '9D');
    play(s, 3, '10D');
    pass(s, 0);
    pass(s, 2);
    // Player 3 leads a single; player 1 has passed before, so can't bomb it.
    play(s, 3, '3H');
    expect(play(s, 0, '4D')).toBeUndefined();
    expect(play(s, 1, '5S 5C 5H 5D 3C')).toBe('You’ve passed this hand, so you can’t bomb.');
  });

  it('skips players who have passed once a trick is bombed', () => {
    const s = table(['3D 4D 6C', '5D 5C 5H 5S 3S 6D', 'QD 3C', 'KD 3H 4C']);
    play(s, 0, '3D');
    pass(s, 1);
    play(s, 2, 'QD');
    play(s, 3, 'KD');
    pass(s, 0);
    pass(s, 2);
    // Player 3 leads; player 0 has passed before, player 1 too.
    play(s, 3, '3H');
    expect(play(s, 0, '4D')).toBeUndefined();
    s.passed[1] = false; // pretend player 1 never passed, so they can bomb
    expect(play(s, 1, '5D 5C 5H 5S 3S')).toBeUndefined();
    // Player 2 has passed this hand, so is skipped; player 3 hasn't, so gets a chance to bomb back.
    expect(s.turn).toBe(3);
    expect(s.out[2]).toBe(true);
    pass(s, 3);
    // Player 0 has passed this hand too, so the lead goes straight back to the bomber.
    expect([s.turn, s.current]).toEqual([1, null]);
  });

  it('ends when someone goes out, scoring the cards left', () => {
    const s = table(['4S', '3D 5C', '6H 7H 8H', '']);
    s.hands[3] = cards('9H 10H JH QH');
    play(s, 0, '4S');
    expect(capsa.isOver(s)).toBe(true);
    expect(capsa.activePlayers(s)).toEqual([]);
    expect(capsa.handScores(s)).toEqual([0, 2, 3, 4]);
  });

  it('plays a whole hand with simple legal plays until someone goes out', () => {
    const s = capsa.deal(newDeck(), 0);
    for (let guard = 0; guard < 300 && !capsa.isOver(s); guard++) {
      const p = s.turn;
      const single = s.hands[p].find((x) => !playError(s, p, [x]));
      const action = single ? { type: 'play' as const, cardIds: [single.id] } : { type: 'pass' as const };
      expect(capsa.apply(s, p, action, 0)).toBeUndefined();
    }
    expect(capsa.isOver(s)).toBe(true);
    expect(capsa.handScores(s)).toContain(0);
  });
});
