import { describe, expect, it } from 'vitest';
import { handMarks, matchStandings, placementPoints } from '../src/shared/scoring';

describe('handMarks', () => {
  it('gives squares to best and triangles to worst (high wins)', () => {
    expect(handMarks([10, 30, 20, 5], false)).toEqual({ squares: [1], triangles: [3] });
  });

  it('respects lower-is-better games', () => {
    expect(handMarks([10, 30, 20, 5], true)).toEqual({ squares: [3], triangles: [1] });
  });

  it('marks everyone tied for best or worst', () => {
    expect(handMarks([0, 0, 13, 13], true)).toEqual({ squares: [0, 1], triangles: [2, 3] });
  });
});

describe('placementPoints', () => {
  it('awards 5/3/1/0 without ties', () => {
    expect(placementPoints([20, 35, 50, 70], true).points).toEqual([5, 3, 1, 0]);
  });

  it('splits only the shared place between tied players', () => {
    // Two players tied for 2nd split the 3 points: 1.5 each.
    const { place, points } = placementPoints([20, 35, 35, 70], true);
    expect(place).toEqual([1, 2, 2, 4]);
    expect(points).toEqual([5, 1.5, 1.5, 0]);
  });

  it('splits 1st between tied leaders', () => {
    expect(placementPoints([40, 40, 10, 0], false).points).toEqual([2.5, 2.5, 1, 0]);
  });

  it('supports dense ranking as an alternative', () => {
    expect(placementPoints([20, 35, 35, 70], true, undefined, 'dense').points).toEqual([5, 1.5, 1.5, 1]);
  });
});

describe('matchStandings', () => {
  it('adds placement points, squares and subtracts triangles', () => {
    const history = [
      { round: 0, gameIndex: 0, scores: [10, 5, 3, 1], squares: [0], triangles: [3] },
      { round: 1, gameIndex: 0, scores: [1, 5, 3, 10], squares: [3], triangles: [0] },
      { round: 0, gameIndex: 1, scores: [0, 26, 0, 0], squares: [0, 2, 3], triangles: [1] },
    ];
    const s = matchStandings(history, [false, true, false, false, false]);
    // Game 0 totals 11,10,6,11 (high wins): players 0 and 3 split 1st -> 2.5 each, player 1 is 3rd.
    expect(s.games[0].points).toEqual([2.5, 1, 0, 2.5]);
    // Game 1 totals 0,26,0,0 (low wins): three tied for 1st split 5.
    expect(s.games[1].points[1]).toBe(0);
    expect(s.squares).toEqual([2, 0, 1, 2]);
    expect(s.triangles).toEqual([1, 1, 0, 1]);
  });
});
