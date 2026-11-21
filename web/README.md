# Ιεραρχία (web prototype)

Greek Army themed 5x4, 1024-ways slot in the "card edition" art style. Demo credits only.

- `engine.js` – game math: symbols, weights, paytable, bonus rules. Edit here.
- `sim.js` – RTP simulator: `node web/sim.js 3000000 400000` (base rounds, bonuses per type, optional medal chance)
- `cards/*.jpg` – symbol art (cropped from the user's card sheets), embedded at build time.
- `background.jpg` – camp scene behind the page, embedded at build time.
- `logo.jpg` – the game logo, for use outside the game (store page, thumbnail). Not shown in the game.
- `template.html` – page, frames, bonus/wild art and UI. `/*ENGINE*/` and `/*CARDS*/` are filled in by the build.
- `build.js` – `node web/build.js` writes `chain-of-command.html`.
- `players.js` – player simulation (100 players per bet, start 100, no refill): `node web/players.js 100 20000`; `players-report.js` summarises `players-result.json`.

Current tuning: ~96% RTP, medal respin 1 in 60 rounds, bonus 1 in 164 (~21x avg), max bonus 1 in 3,190 (~370x avg). In both bonuses a winning wild steps down one row and a non-winning wild leaves; max bonus wilds gain +1 multiplier per win.
