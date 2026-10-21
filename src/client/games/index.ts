import type { GameId } from '../../game/module';
import { CapsaBoard } from './CapsaBoard';
import { HeartsBoard } from './HeartsBoard';
import { SevensBoard } from './SevensBoard';
import { TrufBoard } from './TrufBoard';
import { TrumponBoard } from './TrumponBoard';
import type { GameBoard } from './types';

/** Table component for each game. */
export const GAME_BOARDS: Record<GameId, GameBoard> = {
  truf: TrufBoard,
  hearts: HeartsBoard,
  sevens: SevensBoard,
  trumpon: TrumponBoard,
  capsa: CapsaBoard,
};
