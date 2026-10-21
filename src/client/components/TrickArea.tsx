import { useEffect, useState } from 'react';
import type { Card, FaceDownCard } from '../../shared/cards';
import { isFaceDown } from '../../shared/cards';
import { CardBack, CardView } from './CardView';
import type { SeatPosition } from '../games/types';

/** How long a finished trick stays on the table, then how long it takes to slide away. */
export const TRICK_SHOW_MS = 2000;
export const TRICK_SLIDE_MS = 400;

interface TrickAreaProps {
  /** One slot per player index; null = nothing played yet. */
  cards: (Card | FaceDownCard | null)[];
  seat: (player: number) => SeatPosition;
  highlight?: number | null;
  /** Optional caption under each player's card, e.g. their bid. */
  labels?: (string | null)[];
  /** Slide every card off toward this seat (a finished trick going to its winner). */
  slideTo?: SeatPosition | null;
}

/** Cards played to the middle of the table, each placed toward the player who played it. */
export function TrickArea({ cards, seat, highlight, labels, slideTo }: TrickAreaProps) {
  return (
    <div className={`trick${slideTo ? ` slide-${slideTo}` : ''}`}>
      {cards.map((card, p) =>
        card ? (
          <div key={p} className={`trick-slot ${seat(p)}${highlight === p ? ' win' : ''}`}>
            {isFaceDown(card) ? <CardBack small /> : <CardView card={card} small />}
            {labels?.[p] && <span className="trick-label">{labels[p]}</span>}
          </div>
        ) : null,
      )}
    </div>
  );
}

/**
 * Keeps a just-finished trick on the table for a moment before it slides away.
 * `finished` counts completed tricks; returns whether the last one is still showing
 * and whether it's sliding off. Nothing replays when the page is opened mid-hand.
 */
export function useTrickHold(finished: number) {
  const [cleared, setCleared] = useState(finished);
  const [sliding, setSliding] = useState(false);
  useEffect(() => {
    if (cleared >= finished) return;
    setSliding(false);
    const slide = setTimeout(() => setSliding(true), TRICK_SHOW_MS);
    const clear = setTimeout(() => setCleared(finished), TRICK_SHOW_MS + TRICK_SLIDE_MS);
    return () => {
      clearTimeout(slide);
      clearTimeout(clear);
    };
  }, [finished]);
  return { holding: cleared < finished, sliding };
}
