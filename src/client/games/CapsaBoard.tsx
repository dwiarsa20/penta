import { useState } from 'react';
import type { HandView } from '../../game/module';
import { cardPower, comboLabel, comboOf, isBomb, playError, sortCapsa, type CapsaState } from '../../game/games/capsa';
import type { Card, Suit } from '../../shared/cards';
import { CardView, Hand } from '../components/CardView';
import type { GameBoardProps } from './types';

const SUIT_ORDER: Suit[] = ['D', 'C', 'H', 'S'];
const bySuit = (cards: Card[]) =>
  [...cards].sort((a, b) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || cardPower(a) - cardPower(b));

export function CapsaBoard({ view, me, active, names, act }: GameBoardProps<HandView<CapsaState>>) {
  const [selected, setSelected] = useState<string[]>([]);
  const [suitSort, setSuitSort] = useState(false);
  const myTurn = me != null && active.includes(me);
  const myCards = me != null ? view.hands[me] : [];
  const picked = myCards.filter((c) => selected.includes(c.id));
  const error = myTurn && picked.length ? playError(view, me!, picked) : null;
  const combo = picked.length ? comboOf(picked) : null;

  const send = (action: unknown) => {
    act(action);
    setSelected([]);
  };
  const toggle = (c: Card) => setSelected(selected.includes(c.id) ? selected.filter((id) => id !== c.id) : [...selected, c.id]);

  const cur = view.current;
  const who = (p: number) => (p === me ? 'You' : names[p]);
  let message: string;
  if (view.winner != null) message = `${who(view.winner)} went out. Hand over.`;
  else if (!myTurn) message = `${names[view.turn]} to ${cur ? 'play' : 'lead'}.`;
  else if (error) message = error;
  else if (!cur) message = view.opening ? 'Your lead. Include the 3♦.' : 'Your lead. Play anything.';
  else if (view.bombed) message = 'Only a higher bomb can beat this, or pass.';
  else message = `Beat the ${comboLabel(cur)}, or pass.`;

  const last = view.last;
  // Plays show on the table; only a pass needs a note.
  const lastNote = last && !last.play && `${who(last.player)} passed.`;
  const earlier = view.trick.slice(0, -1).slice(-3);

  return (
    <>
      <div className="table-center">
        <p className="truf-info">
          Capsa
          <span className="muted">
            {view.opening ? ' · 3♦ leads' : ''}
            {me != null && view.passed[me] && view.winner == null ? ' · you’ve passed, so no bombs' : ''}
          </span>
        </p>
        <div className="capsa-table">
          {cur ? (
            <>
              <div className="capsa-play">
                {cur.cards.map((c) => (
                  <CardView key={c.id} card={c} small />
                ))}
              </div>
              <span className="capsa-label">
                {who(cur.player)}: {comboLabel(cur)}
                {view.bombed && isBomb(cur.combo) && <strong> · bomb!</strong>}
              </span>
            </>
          ) : (
            <span className="capsa-label muted">{view.winner == null ? 'New lead' : ''}</span>
          )}
        </div>
        {earlier.length > 0 && (
          <p className="note">
            Before: {earlier.map((pl) => `${who(pl.player)} ${comboLabel(pl)}`).join(' · ')}
          </p>
        )}
        {lastNote && <p className="note">{lastNote}</p>}
        <p className="note">{message}</p>
      </div>
      {me != null && (
        <div className="my-area">
          <div className="controls">
            {myTurn && (
              <>
                <button
                  className="primary"
                  disabled={!picked.length || !!error}
                  onClick={() => send({ type: 'play', cardIds: selected })}
                >
                  {combo && !error ? `Play ${comboLabel({ cards: picked, combo })}` : 'Play'}
                </button>
                {cur && <button onClick={() => send({ type: 'pass' })}>Pass</button>}
              </>
            )}
            {!myTurn && <span className="muted">Waiting for others…</span>}
            {selected.length > 0 && <button onClick={() => setSelected([])}>Clear</button>}
            <button onClick={() => setSuitSort(!suitSort)}>{suitSort ? 'Sort by rank' : 'Sort by suit'}</button>
          </div>
          <Hand
            cards={suitSort ? bySuit(myCards) : sortCapsa(myCards)}
            selected={selected}
            onToggle={view.winner == null ? toggle : undefined}
          />
        </div>
      )}
    </>
  );
}

/** Marks a player who has passed in the current trick. */
function CapsaSeat({ view, player }: { view: HandView<CapsaState>; player: number }) {
  return view.current && view.out[player] ? <span className="capsa-passed">passed</span> : null;
}

CapsaBoard.Seat = CapsaSeat;
