import { useState } from 'react';
import type { HandView } from '../../game/module';
import { bidValue, legalCards, TOTAL_TRICKS, type TrufState } from '../../game/games/truf';
import { cardLabel, isFaceDown, SUIT_NAME, SUIT_SYMBOL } from '../../shared/cards';
import { Hand } from '../components/CardView';
import { TrickArea, useTrickHold } from '../components/TrickArea';
import type { GameBoardProps } from './types';

const MODE_LABEL = { bawah: 'Bawah', atas: 'Atas' };

export function TrufBoard({ view, me, active, names, act, seat }: GameBoardProps<HandView<TrufState>>) {
  const [selected, setSelected] = useState<string | null>(null);
  const myTurn = me != null && active.includes(me);
  const caller = view.caller;
  const myCards = me != null ? view.hands[me] : [];
  const selectedCard = myCards.find((c) => c.id === selected);
  const { holding, sliding } = useTrickHold(view.tricks.reduce((a, b) => a + b, 0));

  const send = (action: unknown) => {
    act(action);
    setSelected(null);
  };

  const showingBids = view.phase === 'bid' || view.phase === 'reveal' || view.phase === 'choose';
  const bidLabels = view.bidCards.map((c, p) =>
    view.phase !== 'bid' ? `Bid ${view.bids[p]}` : c && !isFaceDown(c) ? `Bid ${bidValue(c.rank)}` : null,
  );
  // The middle shows bid cards, then each trick; a finished trick stays a moment before sliding to its winner.
  const table = showingBids
    ? { cards: view.bidCards, highlight: view.phase === 'bid' ? null : caller, labels: bidLabels }
    : holding && view.lastTrick
      ? { cards: view.lastTrick.cards, highlight: view.lastTrick.winner, slideTo: sliding ? seat(view.lastTrick.winner) : null }
      : { cards: view.trick, highlight: null };

  const canPlay = view.phase === 'play' && myTurn && !holding;
  const legal = canPlay ? legalCards(view, me!).map((c) => c.id) : null;

  let message: string;
  if (view.phase === 'bid') {
    message = myTurn
      ? 'Pick a card to bid with. 2–10 bid their number, A bids 1, J/Q/K bid 0. It stays in your hand.'
      : 'Waiting for everyone to bid…';
  } else if (view.phase === 'reveal' || view.phase === 'choose') {
    const callCard = view.bidCards[caller!];
    const callLabel = callCard && !isFaceDown(callCard) ? cardLabel(callCard) : '';
    const total = view.bids.reduce((a, b) => a + b, 0);
    const next =
      total < TOTAL_TRICKS
        ? `Bids total ${total}, so it's Bawah.`
        : total > TOTAL_TRICKS
          ? `Bids total ${total}, so it's Atas.`
          : view.phase === 'choose' && myTurn
            ? 'Bids total 13. Choose Bawah (every bid −1) or Atas (every bid +1).'
            : `Bids total 13, so ${names[caller!]} chooses Bawah or Atas.`;
    message = `${names[caller!]}'s ${callLabel} is highest: ${SUIT_NAME[view.trump!]} are trump. ${next}`;
    if (view.phase === 'reveal' && me != null && view.confirmed[me]) {
      message += ` Waiting for ${names.filter((_, p) => !view.confirmed[p]).join(', ')}…`;
    }
  } else if (holding && view.lastTrick) {
    message = `${names[view.lastTrick.winner]} wins the trick.`;
  } else {
    message = myTurn ? 'Your turn. Trumps are played face down.' : `${names[view.turn]} to play.`;
  }

  return (
    <>
      <div className="table-center">
        {view.trump && (
          <p className="truf-info">
            Trump <strong>{SUIT_SYMBOL[view.trump]} {SUIT_NAME[view.trump]}</strong>
            {view.mode && <> · {MODE_LABEL[view.mode]}</>}
            {view.phase === 'play' && !view.trumpBroken && <span className="muted"> · not broken</span>}
          </p>
        )}
        <TrickArea seat={seat} {...table} />
        {view.phase === 'play' && (
          <ul className="truf-bids">
            {names.map((n, p) => (
              <li key={p} className={p === caller ? 'caller' : ''}>
                <span className="name">{n}</span> {view.tricks[p]}/{view.bids[p]}
                {view.zeroBid[p] && <span className="muted"> (0)</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="note">{message}</p>
      </div>
      {me != null && (
        <div className="my-area">
          <div className="controls">
            {view.phase === 'bid' && myTurn && (
              <button
                className="primary"
                disabled={!selectedCard}
                onClick={() => send({ type: 'bid', cardId: selected })}
              >
                {selectedCard ? `Bid ${bidValue(selectedCard.rank)}` : 'Bid'}
              </button>
            )}
            {view.phase === 'reveal' && myTurn && (
              <button className="primary" onClick={() => send({ type: 'confirm' })}>
                Continue
              </button>
            )}
            {view.phase === 'choose' && myTurn && (
              <>
                <button className="primary" onClick={() => send({ type: 'mode', mode: 'bawah' })}>
                  Bawah
                </button>
                <button className="primary" onClick={() => send({ type: 'mode', mode: 'atas' })}>
                  Atas
                </button>
              </>
            )}
            {view.phase === 'play' && myTurn && (
              <button
                className="primary"
                disabled={!selected || !canPlay}
                onClick={() => send({ type: 'play', cardId: selected })}
              >
                Play card
              </button>
            )}
            {!myTurn && <span className="muted">Waiting for others…</span>}
          </div>
          <Hand
            cards={myCards}
            selected={selected ? [selected] : bidSelection(view, me)}
            playable={legal ? (c) => legal.includes(c.id) : undefined}
            onToggle={
              myTurn && (view.phase === 'bid' || view.phase === 'play')
                ? (c) => setSelected(selected === c.id ? null : c.id)
                : undefined
            }
          />
        </div>
      )}
    </>
  );
}

/** While bidding, keep your bid card raised in your hand once you've picked it. */
function bidSelection(view: HandView<TrufState>, me: number): string[] {
  const card = view.bidCards[me];
  return view.phase === 'bid' && card && !isFaceDown(card) ? [card.id] : [];
}
