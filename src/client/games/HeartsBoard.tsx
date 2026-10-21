import { useState } from 'react';
import type { HandView } from '../../game/module';
import { legalCards, PASS_COUNT, passTarget, type HeartsState } from '../../game/games/hearts';
import { cardLabel } from '../../shared/cards';
import { Hand } from '../components/CardView';
import { TrickArea, useTrickHold } from '../components/TrickArea';
import type { GameBoardProps } from './types';

export function HeartsBoard({ view, me, active, names, act, seat }: GameBoardProps<HandView<HeartsState>>) {
  const [selected, setSelected] = useState<string[]>([]);
  const myTurn = me != null && active.includes(me);
  const myCards = me != null ? view.hands[me] : [];
  const dir = view.passDirection;
  const { holding, sliding } = useTrickHold(view.tricksPlayed);

  const send = (action: unknown) => {
    act(action);
    setSelected([]);
  };

  // A finished trick stays a moment before sliding to its winner.
  const table =
    holding && view.lastTrick
      ? { cards: view.lastTrick.cards, highlight: view.lastTrick.winner, slideTo: sliding ? seat(view.lastTrick.winner) : null }
      : { cards: view.trick, highlight: null };

  const canPlay = view.phase === 'play' && myTurn && !holding;
  const legal = canPlay ? legalCards(view, me!).map((c) => c.id) : null;
  const passing = view.phase === 'pass' && myTurn;

  const toggle = (id: string) => {
    if (passing) {
      setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(-PASS_COUNT));
    } else {
      setSelected(selected[0] === id ? [] : [id]);
    }
  };

  let message: string;
  if (view.phase === 'pass') {
    message = passing
      ? `Choose ${PASS_COUNT} cards to pass ${dir} to ${names[passTarget(me!, dir)]}.`
      : 'Waiting for everyone to pass…';
  } else if (holding && view.lastTrick) {
    message = `${names[view.lastTrick.winner]} wins the trick.`;
  } else {
    message = myTurn ? 'Your turn.' : `${names[view.turn]} to play.`;
  }
  // Until the first trick is done, remind you what you were passed.
  const received = me != null && view.tricksPlayed === 0 ? view.received[me] : [];
  const from = names.find((_, p) => me != null && dir !== 'none' && passTarget(p, dir) === me);

  return (
    <>
      <div className="table-center">
        <p className="truf-info">
          {dir === 'none' ? 'No passing this round' : `Passing ${dir}`}
          {view.phase === 'play' && (
            <span className="muted"> · hearts {view.heartsBroken ? 'broken' : 'not broken'}</span>
          )}
        </p>
        <TrickArea seat={seat} {...table} />
        {view.phase === 'play' && (
          <ul className="truf-bids">
            {names.map((n, p) => (
              <li key={p}>
                <span className="name">{n}</span> {view.points[p]}
              </li>
            ))}
          </ul>
        )}
        {received.length > 0 && from && (
          <p className="note">
            From {from}: {received.map(cardLabel).join(' ')}
          </p>
        )}
        <p className="note">{message}</p>
      </div>
      {me != null && (
        <div className="my-area">
          <div className="controls">
            {passing && (
              <button
                className="primary"
                disabled={selected.length !== PASS_COUNT}
                onClick={() => send({ type: 'pass', cardIds: selected })}
              >
                Pass {selected.length}/{PASS_COUNT}
              </button>
            )}
            {view.phase === 'play' && myTurn && (
              <button
                className="primary"
                disabled={!selected.length || !canPlay}
                onClick={() => send({ type: 'play', cardId: selected[0] })}
              >
                Play card
              </button>
            )}
            {!myTurn && <span className="muted">Waiting for others…</span>}
          </div>
          <Hand
            cards={myCards}
            selected={selected.length ? selected : (view.passes[me] ?? []).map((c) => c.id)}
            playable={legal ? (c) => legal.includes(c.id) : undefined}
            onToggle={myTurn ? (c) => toggle(c.id) : undefined}
          />
        </div>
      )}
    </>
  );
}
