import { useState } from 'react';
import type { HandView } from '../../game/module';
import type { PlaceholderState } from '../../game/games/placeholder';
import { Hand } from '../components/CardView';
import { TrickArea } from '../components/TrickArea';
import type { GameBoardProps } from './types';

export function PlaceholderBoard({ view, me, active, act, seat }: GameBoardProps<HandView<PlaceholderState>>) {
  const [selected, setSelected] = useState<string | null>(null);
  const myTurn = me != null && active.includes(me);

  const play = () => {
    if (!selected) return;
    act({ type: 'play', cardId: selected });
    setSelected(null);
  };

  return (
    <>
      <div className="table-center">
        <TrickArea cards={view.played} seat={seat} />
        <p className="note">Placeholder: play one card each. Highest card wins the hand.</p>
      </div>
      {me != null && (
        <div className="my-area">
          <div className="controls">
            {myTurn ? (
              <button className="primary" disabled={!selected} onClick={play}>
                Play card
              </button>
            ) : (
              <span className="muted">Waiting for others…</span>
            )}
          </div>
          <Hand
            cards={view.hands[me]}
            selected={selected ? [selected] : []}
            onToggle={myTurn ? (c) => setSelected(selected === c.id ? null : c.id) : undefined}
          />
        </div>
      )}
    </>
  );
}
