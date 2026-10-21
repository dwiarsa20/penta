import { describe, expect, it } from 'vitest';
import { makeCard, newDeck, type Card, type Rank, type Suit } from '../src/shared/cards';
import { viewFor } from '../src/game/module';
import { legalCards, placements, sevens, type Row, type SevensState } from '../src/game/games/sevens';

const c = (id: string): Card => {
  const suit = id.slice(-1) as Suit;
  const r = id.slice(0, -1);
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
  return makeCard(rank as Rank, suit);
};

const ids = (cards: Card[]) => cards.map((x) => x.id);

/** A hand in play: these hands, these rows on the table, player 0 to act. */
function table(hands: string[][], rows: Partial<Record<Suit, Row>>, aces: SevensState['aces'] = null): SevensState {
  const s = sevens.deal(newDeck(), 0);
  return Object.assign(s, {
    hands: hands.map((h) => h.map(c)),
    rows: { C: null, D: null, H: null, S: null, ...rows },
    aces,
    turn: 0,
  });
}

const play = (s: SevensState, p: number, id: string, end?: 'high' | 'low') =>
  sevens.apply(s, p, { type: 'play', cardId: id, end }, 0);

describe('Sevens opening', () => {
  it('opens with the 7♠, then 7♥, 7♦, 7♣ by round, played by whoever holds it', () => {
    ['7S', '7H', '7D', '7C'].forEach((id, round) => {
      const s = sevens.deal(newDeck(), round);
      expect(s.hands[s.turn].some((x) => x.id === id)).toBe(true);
      expect(ids(legalCards(s, s.turn))).toEqual([id]);
    });
  });

  it('lets any 7 start its suit after the opening 7', () => {
    const s = table([['7H', '6S', '8S'], [], [], []], {});
    expect(play(s, 0, '7H')).toBe('The 7♠ opens the hand.');
    s.rows.S = { low: 7, high: 7 };
    expect(ids(legalCards(s, 0))).toEqual(['7H', '6S', '8S']);
  });
});

describe('Sevens play', () => {
  it('builds each suit up and down from its 7', () => {
    const s = table([['8S', '5S'], ['6S'], ['9S'], ['KS']], { S: { low: 7, high: 7 } });
    expect(play(s, 0, '5S')).toBe('That card doesn’t fit on the table yet.');
    expect(play(s, 0, '8S')).toBeUndefined();
    expect(play(s, 1, '6S')).toBeUndefined();
    expect(play(s, 2, '9S')).toBeUndefined();
    expect(s.rows.S).toEqual({ low: 6, high: 9 });
    expect(s.turn).toBe(3);
  });

  it('must play if you can; otherwise closes a card face down', () => {
    const s = table([['8S', 'QD'], ['2C', 'KH'], [], []], { S: { low: 7, high: 7 } });
    expect(sevens.apply(s, 0, { type: 'close', cardId: 'QD' }, 0)).toBe('You can play a card, so you can’t close one.');
    play(s, 0, '8S');
    expect(sevens.apply(s, 1, { type: 'close', cardId: 'KH' }, 0)).toBeUndefined();
    expect(ids(s.closedCards[1] as Card[])).toEqual(['KH']);
    expect(ids(s.hands[1])).toEqual(['2C']);
  });

  it('keeps closed cards face down to the others until the hand ends', () => {
    const s = table([['8S'], ['KH', '2C'], [], []], { S: { low: 7, high: 7 } });
    play(s, 0, '8S');
    sevens.apply(s, 1, { type: 'close', cardId: 'KH' }, 0);
    expect(viewFor(sevens, s, 1).closedCards[1]).toEqual([c('KH')]);
    expect(viewFor(sevens, s, 0).closedCards[1]).toEqual([{ faceDown: true }]);
    expect(viewFor(sevens, s, 0).last?.card).toEqual({ faceDown: true });
    s.hands[1] = [];
    expect(sevens.isOver(s)).toBe(true);
    expect(viewFor(sevens, s, 0).closedCards[1]).toEqual([c('KH')]);
  });
});

describe('Sevens Aces', () => {
  it('can go on the K or below the 2 until the first Ace is played', () => {
    const s = table([['AS'], [], [], []], { S: { low: 2, high: 13 } });
    expect(placements(s, c('AS'))).toEqual(['high', 'low']);
    expect(play(s, 0, 'AS')).toBe('Choose whether the Ace goes on the K or below the 2.');
    expect(placements(table([['AS']], { S: { low: 2, high: 9 } }), c('AS'))).toEqual(['low']);
    expect(placements(table([['AS']], { S: { low: 3, high: 13 } }), c('AS'))).toEqual(['high']);
  });

  it('a first Ace on a K makes Aces high and closes its suit and any suit already at its 2', () => {
    const s = table([['AS'], ['AH', '9D'], [], []], {
      S: { low: 5, high: 13 },
      H: { low: 2, high: 13 },
      D: { low: 2, high: 8 },
      C: { low: 3, high: 12 },
    });
    expect(play(s, 0, 'AS')).toBeUndefined();
    expect(s.aces).toBe('high');
    expect(s.closedSuits).toEqual({ S: true, H: true, D: true, C: false });
    // Hearts closed with it, so the A♥ can't go anywhere.
    expect(ids(legalCards(s, 1))).toEqual([]);
  });

  it('Aces high: a suit closes when its 2 is played, and later Aces only go on Ks', () => {
    const s = table([['2C', 'AD'], [], [], []], { C: { low: 3, high: 10 }, D: { low: 3, high: 13 } }, 'high');
    expect(placements(s, c('AD'))).toEqual(['high']);
    play(s, 0, '2C');
    expect(s.closedSuits.C).toBe(true);
  });

  it('Aces low: Aces go below 2s, and a suit closes when its K is played', () => {
    const s = table([['AD'], ['KC'], ['QC'], []], { S: { low: 7, high: 7 }, D: { low: 2, high: 9 }, C: { low: 7, high: 11 } });
    play(s, 0, 'AD');
    expect(s.aces).toBe('low');
    expect(s.rows.D).toEqual({ low: 1, high: 9 });
    expect(s.closedSuits.D).toBe(true);
    expect(play(s, 1, 'KC')).toBe('That card doesn’t fit on the table yet.');
    s.turn = 2;
    play(s, 2, 'QC');
    s.turn = 1;
    play(s, 1, 'KC');
    expect(s.closedSuits.C).toBe(true);
  });
});

describe('Sevens scoring', () => {
  const scored = (aces: SevensState['aces']) => {
    const s = table([[], [], [], []], {}, aces);
    s.closedCards = [[c('AS'), c('KH')], [c('2C'), c('JD')], [], [c('QS')]];
    return sevens.handScores(s);
  };

  it('scores closed cards at face value, J 11, Q 12, K 13, lowest best', () => {
    expect(scored('high')).toEqual([27, 13, 0, 12]);
    expect(sevens.lowerIsBetter).toBe(true);
  });

  it('counts Aces 1 if low, and 7 if no Ace was ever played', () => {
    expect(scored('low')[0]).toBe(14);
    expect(scored(null)[0]).toBe(20);
  });

  it('plays a whole hand with random legal moves, every card ending on the table or closed', () => {
    for (const round of [0, 1, 2, 3]) {
      const s = sevens.deal(newDeck(), round);
      let turns = 0;
      for (; turns < 60 && !sevens.isOver(s); turns++) {
        const [p] = sevens.activePlayers(s);
        const options = legalCards(s, p);
        const card = options[Math.floor(Math.random() * options.length)];
        const action = card
          ? { type: 'play' as const, cardId: card.id, end: placements(s, card)[0] }
          : { type: 'close' as const, cardId: s.hands[p][0].id };
        expect(sevens.apply(s, p, action, round)).toBeUndefined();
      }
      expect(turns).toBe(52);
      const onTable = Object.values(s.rows).reduce((n, r) => n + (r ? r.high - r.low + 1 : 0), 0);
      // An Ace stored as 1 or 14 sits one step past the 2 or K, so it counts as one card either way.
      expect(onTable + s.closedCards.flat().length).toBe(52);
    }
  });
});
