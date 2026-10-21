import type { ComponentType } from 'react';
import type { GameId } from '../../game/module';
import { HeartsBoard } from './HeartsBoard';
import { PlaceholderBoard } from './PlaceholderBoard';
import { SevensBoard } from './SevensBoard';
import { TrufBoard } from './TrufBoard';
import type { GameBoardProps } from './types';

/** Table component for each game. Replace placeholders as the real games are built. */
export const GAME_BOARDS: Record<GameId, ComponentType<GameBoardProps>> = {
  truf: TrufBoard,
  hearts: HeartsBoard,
  sevens: SevensBoard,
  trumpon: PlaceholderBoard,
  capsa: PlaceholderBoard,
};
