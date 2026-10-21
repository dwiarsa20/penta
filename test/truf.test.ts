import { describe, expect, it } from 'vitest';
import { makeCard, newDeck, type Card, type Rank, type Suit } from '../src/shared/cards';
import { viewFor } from '../src/game/module';
import {
  bidValue,
  highestBid,
  legalCards,
  trickWinner,
  truf,
  trufScore,
  type TrufState,
} from '../src/game/games/truf';

const c = (id: string): Card => {
  const suit = id.slice(-1) as Suit;
  const r = id.slice(0, -1);
  const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
  return makeCard(rank as Rank, suit);
};

/** A fresh hand where player p bids with the card `bidIds[p]`, which is put in their hand. */
function bidHand(bidIds: string[], confirm = true): TrufState {
  const s = truf.deal(newDeck(), 0);
  bidIds.forEach((id, p) => {
    const card = c(id);
    s.hands.forEach((h, i) => (s.hands[i] = h.filter((x) => x.id !== card.id)));
    s.hands[p].push(card);
  });
  bidIds.forEach((id, p) => expect(truf.apply(s, p, { type: 'bid', cardId: id }, 0)).toBeUndefined());
  if (confirm) confirmAll(s);
  return s;
}

function confirmAll(s: TrufState) {
  for (let p = 0; p < 4; p++) expect(truf.apply(s, p, { type: 'confirm' }, 0)).toBeUndefined();
}

describe('Truf bidding', () => {
  it('values bid cards: 2-10 their number, A = 1, J/Q/K = 0', () => {
    expect([2, 7, 10, 11, 12, 13, 14].map((r) => bidValue(r as Rank))).toEqual([2, 7, 10, 0, 0, 0, 1]);
  });

  it('breaks ties by suit rank: Spades, Hearts, Diamonds, Clubs', () => {
    expect(highestBid([c('8C'), c('8H'), c('8D'), c('3S')])).toBe(1);
    expect(highestBid([c('8C'), c('8H'), c('8S'), c('8D')])).toBe(2);
  });

  it('ranks 0 bids K > Q > J, and an Ace above all of them', () => {
    expect(highestBid([c('JS'), c('QC'), c('KD'), c('QH')])).toBe(2);
    expect(highestBid([c('KS'), c('AC'), c('QS'), c('JS')])).toBe(1);
  });

  it('keeps bids face down to other players until all four have bid', () => {
    const s = truf.deal(newDeck(), 0);
    const card = s.hands[0][0];
    truf.apply(s, 0, { type: 'bid', cardId: card.id }, 0);
    expect(viewFor(truf, s, 0).bidCards[0]).toEqual(card);
    expect(viewFor(truf, s, 1).bidCards[0]).toEqual({ faceDown: true });
    expect(viewFor(truf, s, 1).bidCards[1]).toBeNull();
    expect(truf.activePlayers(s)).toEqual([1, 2, 3]);
  });

  it('shows everyone the bids, and waits for all four to confirm before play', () => {
    const s = bidHand(['3C', '8H', 'KS', 'AD'], false);
    expect(s.phase).toBe('reveal');
    expect(viewFor(truf, s, 0).bidCards[1]).toEqual(c('8H'));
    expect(truf.apply(s, 1, { type: 'play', cardId: '8H' }, 0)).toBeTruthy();
    truf.apply(s, 2, { type: 'confirm' }, 0);
    expect(truf.activePlayers(s)).toEqual([0, 1, 3]);
    expect(s.mode).toBeNull();
    for (const p of [0, 1, 3]) truf.apply(s, p, { type: 'confirm' }, 0);
    expect(s.phase).toBe('play');
    expect(s.mode).toBe('bawah');
  });

  it('keeps the bid card in the hand', () => {
    const s = bidHand(['9S', '2H', '3D', '4C']);
    expect(s.hands[0].some((x) => x.id === '9S')).toBe(true);
  });

  it('plays Bawah under 13, with the highest bidder calling trump and leading', () => {
    const s = bidHand(['3C', '8H', 'KS', 'AD']); // 3 + 8 + 0 + 1 = 12
    expect(s.mode).toBe('bawah');
    expect(s.trump).toBe('H');
    expect(s.caller).toBe(1);
    expect(truf.activePlayers(s)).toEqual([1]);
    expect(s.zeroBid).toEqual([false, false, true, false]);
  });

  it('plays Atas over 13', () => {
    const s = bidHand(['5C', '9H', '2S', 'AD']); // 5 + 9 + 2 + 1 = 17
    expect(s.mode).toBe('atas');
  });

  it('lets the caller pick at exactly 13: Bawah lowers every bid (not below 0)', () => {
    const s = bidHand(['3C', '9H', 'KS', 'AD']); // 3 + 9 + 0 + 1 = 13, chosen after the reveal
    expect(s.phase).toBe('choose');
    expect(truf.activePlayers(s)).toEqual([1]);
    expect(truf.apply(s, 0, { type: 'mode', mode: 'atas' }, 0)).toBeTruthy();
    truf.apply(s, 1, { type: 'mode', mode: 'bawah' }, 0);
    expect(s.mode).toBe('bawah');
    expect(s.bids).toEqual([2, 8, 0, 0]);
    expect(s.zeroBid).toEqual([false, false, true, false]);
  });

  it('Atas at 13 raises every bid, and a 0 bid keeps its +5/-5', () => {
    const s = bidHand(['3C', '9H', 'KS', 'AD']);
    truf.apply(s, 1, { type: 'mode', mode: 'atas' }, 0);
    expect(s.bids).toEqual([4, 10, 1, 2]);
    expect(s.zeroBid[2]).toBe(true);
    expect(trufScore(1, 1, 'atas', true)).toBe(5);
    expect(trufScore(1, 0, 'atas', true)).toBe(-7);
  });
});

describe('Truf scoring', () => {
  it.each([
    ['bawah', 4, 4, false, 4],
    ['bawah', 4, 2, false, -2],
    ['bawah', 4, 6, false, -4],
    ['atas', 4, 2, false, -4],
    ['atas', 4, 6, false, -2],
    ['bawah', 0, 0, true, 5],
    ['bawah', 0, 1, true, -7],
    ['atas', 0, 1, true, -6],
  ] as const)('%s: bid %i, won %i, zero bid %s → %i', (mode, bid, tricks, zero, expected) => {
    expect(trufScore(bid, tricks, mode, zero)).toBe(expected);
  });
});

describe('Truf play', () => {
  function playState(hands: string[][], trump: Suit, leader = 0): TrufState {
    const s = truf.deal(newDeck(), 0);
    Object.assign(s, {
      hands: hands.map((h) => h.map(c)),
      phase: 'play',
      trump,
      mode: 'bawah',
      caller: leader,
      turn: leader,
      leader,
    });
    return s;
  }

  it('wins a trick with the highest trump, otherwise the highest card of the suit led', () => {
    expect(trickWinner([c('5H'), c('KH'), c('2S'), c('AD')], 0, 'S')).toBe(2);
    expect(trickWinner([c('5H'), c('KH'), c('AS'), c('2S')], 0, 'D')).toBe(1);
    expect(trickWinner([c('5H'), c('KH'), c('2S'), c('AD')], 3, 'C')).toBe(3);
  });

  it('must follow suit', () => {
    const s = playState([['5H'], ['KH', '2S'], ['3D'], ['4C']], 'S');
    truf.apply(s, 0, { type: 'play', cardId: '5H' }, 0);
    expect(legalCards(s, 1).map((x) => x.id)).toEqual(['KH']);
    expect(truf.apply(s, 1, { type: 'play', cardId: '2S' }, 0)).toBe('You must follow suit.');
  });

  it("can't lead trump until it's broken, unless only trump is left", () => {
    const s = playState([['5H', '2S'], [], [], []], 'S');
    expect(truf.apply(s, 0, { type: 'play', cardId: '2S' }, 0)).toBe('Trump has not been broken yet.');
    expect(legalCards(playState([['2S', '3S'], [], [], []], 'S'), 0)).toHaveLength(2);
  });

  it('breaks trump when someone trumps in, and the winner leads next', () => {
    const s = playState([['5H', '7S'], ['2S', '9C'], ['3H', '4H'], ['6H', '8H']], 'S');
    for (const [p, id] of [[0, '5H'], [1, '2S'], [2, '3H'], [3, '6H']] as const) {
      expect(truf.apply(s, p, { type: 'play', cardId: id }, 0)).toBeUndefined();
    }
    expect(s.tricks).toEqual([0, 1, 0, 0]);
    expect(s.trumpBroken).toBe(true);
    expect(s.turn).toBe(1);
    expect(s.lastTrick?.winner).toBe(1);
  });

  it('plays trumps face down to the others, and turns them over when the trick is done', () => {
    const s = playState([['5H', '7S'], ['2S', '9C'], ['3H', '4H'], ['6H', '8H']], 'S');
    truf.apply(s, 0, { type: 'play', cardId: '5H' }, 0);
    truf.apply(s, 1, { type: 'play', cardId: '2S' }, 0);
    expect(viewFor(truf, s, 1).trick[1]).toEqual(c('2S'));
    expect(viewFor(truf, s, 2).trick[1]).toEqual({ faceDown: true });
    expect(viewFor(truf, s, null).trick[1]).toEqual({ faceDown: true });
    expect(viewFor(truf, s, 2).trick[0]).toEqual(c('5H'));
    truf.apply(s, 2, { type: 'play', cardId: '3H' }, 0);
    truf.apply(s, 3, { type: 'play', cardId: '6H' }, 0);
    expect(viewFor(truf, s, 2).lastTrick?.cards[1]).toEqual(c('2S'));
  });

  it('a face-down lead means trump was led, so others must follow with trump', () => {
    const s = playState([['AS', '5H'], ['9C', '2S'], [], []], 'S');
    s.trumpBroken = true;
    truf.apply(s, 0, { type: 'play', cardId: 'AS' }, 0);
    const seen = viewFor(truf, s, 1);
    expect(seen.trick[0]).toEqual({ faceDown: true });
    expect(legalCards(seen, 1).map((x) => x.id)).toEqual(['2S']);
  });

  it('plays a whole hand of 13 tricks with random legal cards', () => {
    const s = truf.deal(newDeck(), 0);
    for (let p = 0; p < 4; p++) truf.apply(s, p, { type: 'bid', cardId: s.hands[p][0].id }, 0);
    confirmAll(s);
    if (s.phase === 'choose') truf.apply(s, s.caller!, { type: 'mode', mode: 'atas' }, 0);
    for (let guard = 0; guard < 60 && !truf.isOver(s); guard++) {
      const [p] = truf.activePlayers(s);
      const options = legalCards(s, p);
      const card = options[Math.floor(Math.random() * options.length)];
      expect(truf.apply(s, p, { type: 'play', cardId: card.id }, 0)).toBeUndefined();
    }
    expect(truf.isOver(s)).toBe(true);
    expect(s.tricks.reduce((a, b) => a + b, 0)).toBe(13);
    expect(truf.handScores(s)).toHaveLength(4);
  });
});
