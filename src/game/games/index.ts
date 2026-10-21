import type { GameModule } from '../module';
import { placeholderGame } from './placeholder';
import { hearts } from './hearts';
import { sevens } from './sevens';
import { truf } from './truf';
import { trumpon } from './trumpon';

/** Fixed Penta order. Swap each placeholder for the real module as it gets built. */
export const GAMES: GameModule<any, any>[] = [
  truf,
  hearts,
  sevens,
  trumpon,
  placeholderGame('capsa', 'Capsa'),
];

export const ROUNDS = 4;
export const PLAYERS = 4;
