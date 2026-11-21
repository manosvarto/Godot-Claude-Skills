# Ιεραρχία (web prototype)

Greek Army themed 5x4, 1024-ways slot in the "card edition" art style. Demo credits only.

- `engine.js` – game math: symbols, weights, paytable, bonus rules. Edit here.
- `sim.js` – RTP simulator: `node web/sim.js 4000000 400000`
- `cards/*.jpg` – symbol art (cropped from the user's card sheets), embedded at build time.
- `background.jpg` – camp scene behind the page, embedded at build time.
- `logo.jpg` – the game logo, for use outside the game (store page, thumbnail). Not shown in the game.
- `template.html` – page, frames, bonus/wild art and UI. `/*ENGINE*/` and `/*CARDS*/` are filled in by the build.
- `build.js` – `node web/build.js` writes `chain-of-command.html`.

Current tuning: 96.0% RTP, 40% of spins win, bonus 1 in 166 spins, max bonus 1 in 3,285.
