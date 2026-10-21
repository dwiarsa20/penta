# Penta

An online card game for four friends: five classic card games, played back to back over four rounds, with our own house rules.

**Truf → Hearts → Sevens → Trumpon → Capsa**, four times over: 20 hands, one winner.

Built with [boardgame.io](https://boardgame.io) and React, so everyone plays from a browser on their phone or laptop.

> **Status:** the match framework, **Truf**, **Hearts**, **Sevens** and **Trumpon** are done. **Capsa** is still a placeholder (each player plays one card, highest wins) while the real rules are built one game at a time.

---

## How a match works

A Penta match is always **4 players, no partnerships**, and runs **4 rounds** of the same five games in a fixed order:

| # | Game | Based on |
|---|------|----------|
| 1 | Truf | Spades-style trick-taking |
| 2 | Hearts | Standard Hearts (passing changes by round) |
| 3 | Sevens | Sevens / layout building, with wild Aces |
| 4 | Trumpon | Truf with piles on the table instead of bids |
| 5 | Capsa | Big Two / Chinese poker |

Each game decides its own first player.

## Scoring

**Every hand** uses that game's normal scoring. Then:

- Everyone tied for **best** in the hand gets a **square □** (+1).
- Everyone tied for **worst** gets a **triangle △** (−1).

**At the end of the match**, each game's four hands are added up and the players are ranked within that game:

| Place | 1st | 2nd | 3rd | 4th |
|-------|-----|-----|-----|-----|
| Points | 5 | 3 | 1 | 0 |

- Tied players split the points for the place they share: two players tied for 2nd get 1.5 each.
- The player after a tie skips a place: 1st, 2nd, 2nd, **4th**.

**Penta score = placement points from all five games + squares − triangles.** Highest score wins; ties share the win.

## House rules

### Truf

1. **Bid:** after the deal, everyone secretly picks a card from their hand as their bid. **2–10** bid their number, **A** bids 1, **J/Q/K** bid 0. The card stays in your hand.
2. **Trump:** bids are revealed together, and play waits until all four players have confirmed them. The highest bid card's suit is trump, and its owner (the caller) leads first. Ties go to the higher rank (K > Q > J among 0 bids), then suit: ♠ > ♥ > ♦ > ♣.
3. **Bawah or Atas:** if the bids add up to under 13 it's a **Bawah** game, over 13 it's **Atas**. At exactly 13 the caller chooses, and every bid goes down 1 (Bawah, never below 0) or up 1 (Atas).
4. **Play:** follow suit if you can. Trump can't be led until it's been broken. Trumps are always played **face down**, whether leading or following, and are turned over once the trick is complete.
5. **Scoring:** win exactly your bid and you score it. Otherwise, for each trick you're off:

   | | Under your bid | Over your bid |
   |---|---|---|
   | Bawah | −1 each | −2 each |
   | Atas | −2 each | −1 each |

   A **0 bid** (J/Q/K) scores **+5** if made, or **−5** on top of the normal penalty if missed. It keeps the ±5 even when Atas raises it to 1.

### Hearts

Standard Hearts.

1. **Passing:** everyone passes 3 cards at the same time. Round 1 passes left, round 2 right, round 3 across, and round 4 has no passing.
2. **Play:** whoever holds the 2♣ leads it. Follow suit if you can. There's no trump, so the highest card of the suit led wins. No hearts or Q♠ on the first trick unless you have nothing else. Hearts can't be led until one has been played, unless you hold only hearts.
3. **Scoring:** 1 point per heart and 13 for the Q♠. **Lowest is best.**
4. **Shooting the moon:** take all 26 points and you score 0 while everyone else scores 26. So the shooter gets the □ and the other three each get a △.

### Sevens

1. **Start:** round 1 opens with the **7♠**, round 2 the **7♥**, round 3 the **7♦** and round 4 the **7♣**. Whoever holds it plays it first.
2. **Play:** each suit builds up and down from its 7, and any 7 starts its suit. Play goes left. **You must play if you can.**
3. **Closing a card:** if you can't play, you **close** a card: lay any card from your hand face down in front of you. It's out of the hand and counts against you. Others only see how many you've closed until the hand ends. The hand ends when everyone's hand is empty.
4. **Aces are wild:** until the first Ace is played, an Ace can go on its suit's **K** or below its **2**. The first one decides for the whole hand:
   - On a K makes **Aces high**: later Aces only go on Ks.
   - Below a 2 makes **Aces low**: later Aces only go below 2s.
5. **Closed suits:** once Aces are set, a suit closes as soon as either end is finished, and nothing more can be played on it:
   - Aces high: when its A goes on the K, or when its 2 is played.
   - Aces low: when its A goes below the 2, or when its K is played.

   Any suit whose end was already finished when the Aces were set closes right then.
6. **Scoring:** the total of your closed cards. 2–10 count face value, J 11, Q 12, K 13. Aces count **14** if Aces are high, **1** if low, and **7** if no Ace was ever played. **Lowest is best.**

### Trumpon

1. **Deal:** 13 cards each: **4 in your hand** and **3 piles of 3** in front of you, with each pile's top card face up.
2. **Trump:** there's no bidding. The **highest face-up pile card** names trump (A high, then K, Q … 2; ties go ♠ > ♥ > ♦ > ♣), and its owner leads first.
3. **Play:** as in Truf. You can play a card from your hand or the face-up top of any of your piles, and both count when following suit. Trump can't be led until it's been broken.
4. **Face-down cards:** trumps from your hand are played **face down** until the trick is complete. Trumps from a pile stay face up, since everyone has already seen them. When you play from a pile, the card underneath stays face down, even to you, until the trick finishes.
5. **Scoring:** you score the cards in the tricks you win. **Highest is best.** The whole deck adds up to +36.

   | Cards | 2–5 | 6 | 7 | 8 | 9 | 10 | J | Q | K | A |
   |---|---|---|---|---|---|---|---|---|---|---|
   | Points | +1 | −1 | −2 | −3 | −4 | +5 | +1 | +2 | +3 | +4 |

## Features

- **Lobby with share links:** create a match, send the link, friends pick a seat.
- **Hidden hands:** the server never sends other players' cards to your browser.
- **Server-side rules:** every move is checked and shuffling happens on the server, so nobody can cheat from the browser.
- **Saved matches:** matches are stored on disk, so a restart or a dropped connection doesn't lose a three-hour game. Players can rejoin from the same device.
- **Live scoresheet:** every hand's score, the □/△ marks, and running placement points.
- **Mobile-friendly table:** the hand fits on a phone screen, and you always sit at the bottom.

## Getting started

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

- Open **http://localhost:5173** on your computer.
- Create a match. The waiting screen shows a link that works for phones **on the same Wi-Fi**, using your computer's local address instead of `localhost`.

To run it the way it would be hosted, with one server for both the game and the website:

```bash
npm run build
npm start          # http://localhost:8000
```

### Testing on your own

While running `npm run dev`, the home page has a **Test match: play all 4 seats** button. It opens one page with all four players' screens side by side.

The bar along the top deals a fresh hand of any game in any round, so you can test a game without playing up to it. It only works in test matches.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Game server (port 8000) and web app with live reload (port 5173) |
| `npm run build` | Builds the web app into `dist/` |
| `npm start` | Runs the game server and serves the built app on port 8000 |
| `npm test` | Runs the scoring and match-flow tests |
| `npm run typecheck` | TypeScript type check |

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8000` | Server port |
| `DATA_DIR` | `./data` | Where matches are saved |
| `ORIGIN` | *(any)* | Public site URL to allow when hosting online |

## Project structure

```
penta/
├── server/
│   └── index.ts              # boardgame.io server, lobby API, saved matches, serves the app
├── src/
│   ├── shared/
│   │   ├── cards.ts          # 52-card deck, dealing, sorting
│   │   └── scoring.ts        # □/△ per hand, 5/3/1/0 placement, final tally
│   ├── game/
│   │   ├── module.ts         # The interface every card game implements
│   │   ├── penta.ts          # Match flow: 4 rounds × 5 games, summaries, game over
│   │   └── games/
│   │       ├── index.ts      # Game order (swap placeholders for real games here)
│   │       └── placeholder.ts
│   └── client/
│       ├── App.tsx           # Home, create/join, rejoin
│       ├── PentaBoard.tsx    # Table, seats, hand summary, final results
│       ├── components/       # Cards, hand, trick area, scoresheet
│       ├── games/            # One table screen per game
│       └── styles.css
└── test/                     # Vitest: scoring rules and a full simulated match
```

The rules code in `src/game` and `src/shared` has no UI code in it. The same code runs on the server, in the browser and in tests.

## Adding a game

1. Create `src/game/games/<game>.ts` implementing `GameModule`:
   - `deal`: start a hand from a shuffled deck
   - `activePlayers`: who may act right now
   - `apply`: validate and apply an action such as playing a card or bidding
   - `isOver`: whether the hand has ended
   - `handScores`: the hand's scores
   - `lowerIsBetter`: whether a lower score is better
2. Create `src/client/games/<Game>Board.tsx` for the table screen.
3. Replace the placeholder in `src/game/games/index.ts` and `src/client/games/index.ts`.
4. Add tests under `test/`.

## Roadmap

- [x] Match framework, scoring, lobby, saved matches
- [x] Truf
- [x] Hearts
- [x] Sevens
- [x] Trumpon
- [ ] Capsa
- [ ] Free online hosting, so friends can join from anywhere
