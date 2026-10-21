import type { GameId } from '../../game/module';
import { HeartsBoard } from './HeartsBoard';
import { PlaceholderBoard } from './PlaceholderBoard';
import { SevensBoard } from './SevensBoard';
import { TrufBoard } from './TrufBoard';
import { TrumponBoard } from './TrumponBoard';
import type { GameBoard } from './types';

/** Table component for each game. Replace placeholders as the real games are built. */
export const GAME_BOARDS: Record<GameId, GameBoard> = {
  truf: TrufBoard,
  hearts: HeartsBoard,
  sevens: SevensBoard,
  trumpon: TrumponBoard,
  capsa: PlaceholderBoard,
};
