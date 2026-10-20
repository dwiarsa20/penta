import type { Card } from '../../shared/cards';
import { rankLabel, SUIT_SYMBOL } from '../../shared/cards';

interface CardProps {
  card: Card;
  selected?: boolean;
  dimmed?: boolean;
  small?: boolean;
  onClick?: () => void;
}

export function CardView({ card, selected, dimmed, small, onClick }: CardProps) {
  const red = card.suit === 'H' || card.suit === 'D';
  const classes = ['card', red ? 'red' : 'black', selected && 'selected', dimmed && 'dimmed', small && 'small']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} onClick={onClick} disabled={!onClick} aria-pressed={selected}>
      <span className="corner">
        {rankLabel(card.rank)}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="pip">{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card back${small ? ' small' : ''}`} aria-hidden />;
}

interface HandProps {
  cards: Card[];
  selected?: string[];
  /** Cards that can't be played right now are greyed out. Omit to allow all. */
  playable?: (card: Card) => boolean;
  onToggle?: (card: Card) => void;
}

/** The player's own hand, overlapped so 13 cards fit on a phone screen. */
export function Hand({ cards, selected = [], playable, onToggle }: HandProps) {
  return (
    <div className="hand" style={{ ['--gaps' as string]: Math.max(cards.length - 1, 1) }}>
      {cards.map((card) => {
        const canPlay = playable ? playable(card) : true;
        return (
          <CardView
            key={card.id}
            card={card}
            selected={selected.includes(card.id)}
            dimmed={!canPlay}
            onClick={onToggle && canPlay ? () => onToggle(card) : undefined}
          />
        );
      })}
    </div>
  );
}
