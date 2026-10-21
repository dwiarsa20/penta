import { useState } from 'react';
import type { HandView } from '../../game/module';
import { closedPoints, legalCards, placements, SUIT_ORDER, type SevensState } from '../../game/games/sevens';
import { cardLabel, isFaceDown, makeCard, SUIT_SYMBOL, type Rank, type Suit } from '../../shared/cards';
import { CardView, Hand } from '../components/CardView';
import type { GameBoardProps } from './types';

export function SevensBoard({ view, me, active, names, act }: GameBoardProps<HandView<SevensState>>) {
  const [selected, setSelected] = useState<string | null>(null);
  const myTurn = me != null && active.includes(me);
  const myCards = me != null ? view.hands[me] : [];
  const legal = myTurn ? legalCards(view, me!).map((c) => c.id) : [];
  const mustClose = myTurn && legal.length === 0;
  const card = myCards.find((c) => c.id === selected);
  const ends = card && !mustClose ? placements(view, card) : [];

  const send = (action: unknown) => {
    act(action);
    setSelected(null);
  };

  const over = view.handCounts.every((n) => n === 0);
  let message: string;
  if (over) message = 'Hand over.';
  else if (mustClose) message = 'You can’t play. Close a card face down.';
  else message = myTurn ? 'Your turn.' : `${names[view.turn]} to play.`;

  const last = view.last;
  const lastNote =
    last &&
    `${last.player === me ? 'You' : names[last.player]} ${last.closed ? 'closed' : 'played'} ${
      isFaceDown(last.card) ? 'a card' : cardLabel(last.card)
    }.`;
  const lastPlayed = last && !last.closed && !isFaceDown(last.card) ? last.card.id : null;
  const myClosed = me != null ? view.closedCards[me] : [];

  return (
    <>
      <div className="table-center">
        <p className="truf-info">Aces {view.aces ?? 'not set yet'}</p>
        <div className="sevens-layout">
          {SUIT_ORDER.map((suit) => (
            <SuitRow key={suit} suit={suit} view={view} lastPlayed={lastPlayed} />
          ))}
        </div>
        <ul className="truf-bids">
          {names.map((n, p) => (
            <li key={p}>
              <span className="name">{n}</span> {view.closedCards[p].length} closed
              {(p === me || over) && ` (${closedPoints(view.closedCards[p], view.aces)})`}
            </li>
          ))}
        </ul>
        {myClosed.length > 0 && !over && (
          <p className="note">You closed {myClosed.map((c) => (isFaceDown(c) ? '?' : cardLabel(c))).join(' ')}</p>
        )}
        {lastNote && <p className="note">{lastNote}</p>}
        <p className="note">{message}</p>
      </div>
      {me != null && (
        <div className="my-area">
          <div className="controls">
            {mustClose && (
              <button className="primary" disabled={!selected} onClick={() => send({ type: 'close', cardId: selected })}>
                Close card
              </button>
            )}
            {myTurn && !mustClose && ends.length === 2 ? (
              <>
                <button className="primary" onClick={() => send({ type: 'play', cardId: selected, end: 'high' })}>
                  Ace on the K
                </button>
                <button className="primary" onClick={() => send({ type: 'play', cardId: selected, end: 'low' })}>
                  Ace below the 2
                </button>
              </>
            ) : (
              myTurn &&
              !mustClose && (
                <button className="primary" disabled={!ends.length} onClick={() => send({ type: 'play', cardId: selected })}>
                  Play card
                </button>
              )
            )}
            {!myTurn && <span className="muted">Waiting for others…</span>}
          </div>
          <Hand
            cards={myCards}
            selected={selected ? [selected] : []}
            playable={myTurn && !mustClose ? (c) => legal.includes(c.id) : undefined}
            onToggle={myTurn ? (c) => setSelected(selected === c.id ? null : c.id) : undefined}
          />
        </div>
      )}
    </>
  );
}

/** One suit on the table: its 7 in the middle, the high end above and the low end below. */
function SuitRow({ suit, view, lastPlayed }: { suit: Suit; view: SevensState; lastPlayed: string | null }) {
  const row = view.rows[suit];
  const slot = (rank: number | null) => {
    if (rank == null) return <div className="sevens-slot spacer" />;
    // An Ace below the 2 is stored as 1.
    const card = makeCard((rank === 1 ? 14 : rank) as Rank, suit);
    return (
      <div className={`sevens-slot${card.id === lastPlayed ? ' last' : ''}`}>
        <CardView card={card} small />
      </div>
    );
  };
  return (
    <div className={`sevens-suit${view.closedSuits[suit] ? ' closed' : ''}`}>
      {row ? (
        <>
          {slot(row.high > 7 ? row.high : null)}
          {slot(7)}
          {slot(row.low < 7 ? row.low : null)}
        </>
      ) : (
        <>
          {slot(null)}
          <div className="sevens-slot empty">{SUIT_SYMBOL[suit]}</div>
          {slot(null)}
        </>
      )}
      <span className="sevens-tag">{view.closedSuits[suit] ? 'closed' : ' '}</span>
    </div>
  );
}
