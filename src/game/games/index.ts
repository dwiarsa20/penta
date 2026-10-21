import type { GameModule } from '../module';
import { placeholderGame } from './placeholder';
import { hearts } from './hearts';
import { truf } from './truf';

/** Fixed Penta order. Swap each placeholder for the real module as it gets built. */
export const GAMES: GameModule<any, any>[] = [
  truf,
  hearts,
  placeholderGame('sevens', 'Sevens'),
  placeholderGame('trumpon', 'Trumpon'),
  placeholderGame('capsa', 'Capsa'),
];

export const ROUNDS = 4;
export const PLAYERS = 4;
