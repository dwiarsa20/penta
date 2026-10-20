import type { ComponentType } from 'react';
import type { GameId } from '../../game/module';
import { PlaceholderBoard } from './PlaceholderBoard';
import type { GameBoardProps } from './types';

/** Table component for each game. Replace placeholders as the real games are built. */
export const GAME_BOARDS: Record<GameId, ComponentType<GameBoardProps>> = {
  truf: PlaceholderBoard,
  hearts: PlaceholderBoard,
  sevens: PlaceholderBoard,
  trumpon: PlaceholderBoard,
  capsa: PlaceholderBoard,
};
