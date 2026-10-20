// Penta's match-level scoring. Each game keeps its own hand scoring; this file
// turns those hand scores into squares/triangles and the final standings.

export const PLACEMENT_POINTS = [5, 3, 1, 0];

/**
 * How places are counted after a tie, e.g. scores 10, 20, 20, 30.
 * - 'competition': 1st, 2nd, 2nd, 4th  (the player after the tie skips 3rd)
 * - 'dense':       1st, 2nd, 2nd, 3rd
 * Either way, tied players split only the points of the place they share.
 */
export type TieRanking = 'competition' | 'dense';
export const TIE_RANKING: TieRanking = 'competition';

export interface HandMarks {
  squares: number[]; // player indexes tied for best
  triangles: number[]; // player indexes tied for worst
}

/** Every player tied for best gets a square; every player tied for worst gets a triangle. */
export function handMarks(scores: number[], lowerIsBetter: boolean): HandMarks {
  const best = lowerIsBetter ? Math.min(...scores) : Math.max(...scores);
  const worst = lowerIsBetter ? Math.max(...scores) : Math.min(...scores);
  return {
    squares: scores.flatMap((s, i) => (s === best ? [i] : [])),
    triangles: scores.flatMap((s, i) => (s === worst ? [i] : [])),
  };
}

/** Placement points for one game's totals (1st 5, 2nd 3, 3rd 1, 4th 0, ties split their place's points). */
export function placementPoints(
  totals: number[],
  lowerIsBetter: boolean,
  table = PLACEMENT_POINTS,
  ranking: TieRanking = TIE_RANKING,
): { place: number[]; points: number[] } {
  const distinct = [...new Set(totals)].sort((a, b) => (lowerIsBetter ? a - b : b - a));
  const place: number[] = [];
  const points: number[] = [];
  let placeIndex = 0;
  for (const value of distinct) {
    const tied = totals.flatMap((t, i) => (t === value ? [i] : []));
    const share = (table[placeIndex] ?? 0) / tied.length;
    for (const i of tied) {
      place[i] = placeIndex + 1;
      points[i] = share;
    }
    placeIndex += ranking === 'competition' ? tied.length : 1;
  }
  return { place, points };
}

export interface HandRecord {
  round: number; // 0-3
  gameIndex: number; // 0-4
  scores: number[];
  squares: number[];
  triangles: number[];
}

export interface GameStanding {
  gameIndex: number;
  totals: number[];
  place: number[];
  points: number[];
}

export interface MatchStandings {
  games: GameStanding[];
  squares: number[];
  triangles: number[];
  final: number[];
}

/** Tally the match so far from the hand history. `lowerIsBetter[g]` is per game index. */
export function matchStandings(
  history: HandRecord[],
  lowerIsBetter: boolean[],
  players = 4,
): MatchStandings {
  const zero = () => Array<number>(players).fill(0);
  const squares = zero();
  const triangles = zero();
  for (const h of history) {
    h.squares.forEach((p) => squares[p]++);
    h.triangles.forEach((p) => triangles[p]++);
  }
  const games: GameStanding[] = lowerIsBetter.map((lower, gameIndex) => {
    const totals = zero();
    history
      .filter((h) => h.gameIndex === gameIndex)
      .forEach((h) => h.scores.forEach((s, p) => (totals[p] += s)));
    return { gameIndex, totals, ...placementPoints(totals, lower) };
  });
  const final = zero().map(
    (_, p) => games.reduce((sum, g) => sum + g.points[p], 0) + squares[p] - triangles[p],
  );
  return { games, squares, triangles, final };
}
