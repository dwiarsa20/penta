// The contract every Penta game (Truf, Hearts, Sevens, Trumpon, Capsa) implements.
// Modules are plain logic with no boardgame.io or React imports, so they run on the
// server, in the browser, and in unit tests alike.

import type { Card } from '../shared/cards';

export type GameId = 'truf' | 'hearts' | 'sevens' | 'trumpon' | 'capsa';

/** Every hand state holds the four players' cards; the rest is up to the game. */
export interface HandStateBase {
  hands: Card[][];
}

/** What a player sees: other players' hands are emptied and only their counts kept. */
export type HandView<S extends HandStateBase = HandStateBase> = S & { handCounts: number[] };

export interface GameModule<S extends HandStateBase = HandStateBase, A = unknown> {
  id: GameId;
  name: string;
  /** Hearts: true (fewest points wins). Used for squares/triangles and placement. */
  lowerIsBetter: boolean;

  /** Start a hand from a shuffled 52-card deck. `round` is 0-3 (only Hearts uses it). */
  deal(deck: Card[], round: number): S;

  /** Players who may act right now (usually one; several during e.g. Hearts passing). */
  activePlayers(state: S): number[];

  /**
   * Apply a player's action by mutating `state`. Return an error message if the action
   * is illegal (the change is then discarded), or nothing if it succeeded.
   */
  apply(state: S, player: number, action: A, round: number): string | void;

  isOver(state: S): boolean;

  /** This hand's scores in the game's own scoring, one per player. */
  handScores(state: S): number[];

  /** Optional extra hiding beyond other players' hands (e.g. cards being passed). */
  hideSecrets?(view: HandView<S>, viewer: number | null): HandView<S>;
}

export function viewFor<S extends HandStateBase>(
  module: GameModule<S, any>,
  state: S,
  viewer: number | null,
): HandView<S> {
  const view: HandView<S> = {
    ...state,
    hands: state.hands.map((h, i) => (i === viewer ? h : [])),
    handCounts: state.hands.map((h) => h.length),
  };
  return module.hideSecrets ? module.hideSecrets(view, viewer) : view;
}
