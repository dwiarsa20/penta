import type { Card } from '../../shared/cards';
import { CardView } from './CardView';
import type { SeatPosition } from '../games/types';

interface TrickAreaProps {
  /** One slot per player index; null = nothing played yet. */
  cards: (Card | null)[];
  seat: (player: number) => SeatPosition;
  highlight?: number | null;
}

/** Cards played to the middle of the table, each placed toward the player who played it. */
export function TrickArea({ cards, seat, highlight }: TrickAreaProps) {
  return (
    <div className="trick">
      {cards.map((card, p) =>
        card ? (
          <div key={p} className={`trick-slot ${seat(p)}${highlight === p ? ' win' : ''}`}>
            <CardView card={card} small />
          </div>
        ) : null,
      )}
    </div>
  );
}
