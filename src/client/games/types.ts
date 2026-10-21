import type { ComponentType } from 'react';

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right';

/** Props every game's table component receives from the shared Penta board. */
export interface GameBoardProps<V = any> {
  view: V; // the current hand, with other players' cards hidden
  me: number | null; // null when spectating
  round: number;
  active: number[]; // players who may act now
  names: string[];
  seat: (player: number) => SeatPosition;
  act: (action: unknown) => void;
}

/** A game's table component, optionally with extra content for the other players' seats (e.g. their piles). */
export type GameBoard = ComponentType<GameBoardProps> & {
  Seat?: ComponentType<{ view: any; player: number }>;
};
