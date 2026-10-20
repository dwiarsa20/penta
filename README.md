# Penta

Truf → Hearts → Sevens → Trumpon → Capsa, four rounds, four players, online.

## Run it

```
npm run dev      # game server on :8000 + web app on :5173 (auto-reload)
npm test         # rules and scoring tests
npm run build    # build the web app into dist/
npm start        # one server for everything on :8000 (after build)
```

Friends on the same Wi-Fi can open `http://<your-PC's-IP>:5173` during `npm run dev`.

## Layout

- `src/shared/scoring.ts` — squares/triangles, placement points (5/3/1/0, ties split), final tally
- `src/game/module.ts` — the interface every card game implements
- `src/game/games/` — one file per game (currently placeholders)
- `src/game/penta.ts` — the match flow: 20 hands, summaries, game over
- `src/client/games/` — one table component per game
- `server/index.ts` — boardgame.io server; matches are saved in `data/`

## Adding a game

1. Write `src/game/games/<game>.ts` implementing `GameModule` (deal, activePlayers, apply, isOver, handScores).
2. Write `src/client/games/<Game>Board.tsx`.
3. Swap the placeholder in `src/game/games/index.ts` and `src/client/games/index.ts`.
4. Add tests in `test/`.
