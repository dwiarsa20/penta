import { useState } from 'react';
import type { HandView } from '../../game/module';
import { legalCards, type Pile, type TrumponState } from '../../game/games/trumpon';
import { cardLabel, isFaceDown, rankLabel, SUIT_NAME, SUIT_SYMBOL } from '../../shared/cards';
import { CardBack, CardView, Hand } from '../components/CardView';
import { TrickArea, useTrickHold } from '../components/TrickArea';
import type { GameBoardProps } from './types';

export function TrumponBoard({ view, me, active, names, act, seat }: GameBoardProps<HandView<TrumponState>>) {
  const [selected, setSelected] = useState<string | null>(null);
  const myTurn = me != null && active.includes(me);
  const { holding, sliding } = useTrickHold(view.tricksPlayed);

  // A finished trick stays a moment before sliding to its winner.
  const table =
    holding && view.lastTrick
      ? { cards: view.lastTrick.cards, highlight: view.lastTrick.winner, slideTo: sliding ? seat(view.lastTrick.winner) : null }
      : { cards: view.trick, highlight: null };

  const canPlay = myTurn && !holding;
  const legal = canPlay ? legalCards(view, me!).map((c) => c.id) : null;
  const isPlayable = legal ? (id: string) => legal.includes(id) : () => true;
  const toggle = myTurn ? (id: string) => setSelected(selected === id ? null : id) : undefined;

  const play = () => {
    act({ type: 'play', cardId: selected });
    setSelected(null);
  };

  let message: string;
  if (holding && view.lastTrick) message = `${names[view.lastTrick.winner]} wins the trick.`;
  else if (view.tricksPlayed >= 13) message = 'Hand over.';
  else message = myTurn ? 'Your turn.' : `${names[view.turn]} to play.`;

  return (
    <>
      <div className="table-center">
        <p className="truf-info">
          Trump {SUIT_SYMBOL[view.trump]} {SUIT_NAME[view.trump]}
          <span className="muted">
            {' '}
            · {cardLabel(view.trumpCard)} from {names[view.caller]}
            {view.trumpBroken ? ' · broken' : ''}
          </span>
        </p>
        <TrickArea seat={seat} {...table} />
        <ul className="truf-bids">
          {names.map((n, p) => (
            <li key={p} className={p === view.caller ? 'caller' : ''}>
              <span className="name">{n}</span> {view.points[p]}
            </li>
          ))}
        </ul>
        <p className="note">{message}</p>
      </div>
      {me != null && (
        <div className="my-area">
          <div className="controls">
            {myTurn ? (
              <button className="primary" disabled={!selected || !canPlay} onClick={play}>
                Play card
              </button>
            ) : (
              <span className="muted">Waiting for others…</span>
            )}
          </div>
          <div className="trumpon-mine">
            <div className="trumpon-piles">
              {view.piles[me].map((pile, i) => (
                <PileView
                  key={i}
                  pile={pile}
                  selected={selected}
                  playable={canPlay ? isPlayable : undefined}
                  onToggle={toggle}
                />
              ))}
            </div>
            <Hand
              cards={view.hands[me]}
              selected={selected ? [selected] : []}
              playable={legal ? (c) => legal.includes(c.id) : undefined}
              onToggle={toggle && ((c) => toggle(c.id))}
            />
          </div>
        </div>
      )}
    </>
  );
}

/** One of your piles: its face-up top card, a card back, or an empty spot. */
function PileView({
  pile,
  selected,
  playable,
  onToggle,
}: {
  pile: Pile;
  selected: string | null;
  playable?: (id: string) => boolean;
  onToggle?: (id: string) => void;
}) {
  const top = pile.cards[pile.cards.length - 1];
  const depth = `pile depth-${pile.cards.length}`;
  if (!top) return <div className={`${depth} card empty`} />;
  if (isFaceDown(top) || !pile.up) {
    return (
      <div className={depth}>
        <CardBack />
      </div>
    );
  }
  const canPlay = playable ? playable(top.id) : true;
  return (
    <div className={depth}>
      <CardView
        card={top}
        selected={selected === top.id}
        dimmed={!canPlay}
        onClick={onToggle && canPlay ? () => onToggle(top.id) : undefined}
      />
    </div>
  );
}

/** Another player's piles, shown small in their seat. */
function TrumponSeat({ view, player }: { view: HandView<TrumponState>; player: number }) {
  return (
    <div className="mini-piles">
      {view.piles[player].map((pile, i) => {
        const top = pile.cards[pile.cards.length - 1];
        const depth = `mini-card depth-${pile.cards.length}`;
        if (!top) return <span key={i} className={`${depth} empty`} />;
        if (isFaceDown(top)) return <span key={i} className={`${depth} back`} />;
        const red = top.suit === 'H' || top.suit === 'D';
        return (
          <span key={i} className={`${depth}${red ? ' red' : ''}`}>
            {rankLabel(top.rank)}
            <br />
            {SUIT_SYMBOL[top.suit]}
          </span>
        );
      })}
    </div>
  );
}

TrumponBoard.Seat = TrumponSeat;
