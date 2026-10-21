import type { GameModule } from '../module';
import { capsa } from './capsa';
import { hearts } from './hearts';
import { sevens } from './sevens';
import { truf } from './truf';
import { trumpon } from './trumpon';

/** Fixed Penta order. */
export const GAMES: GameModule<any, any>[] = [
  truf,
  hearts,
  sevens,
  trumpon,
  capsa,
];

export const ROUNDS = 4;
export const PLAYERS = 4;
