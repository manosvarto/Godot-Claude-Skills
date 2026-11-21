# Ιεραρχία (web prototype)

Greek Army themed 5x4, 1024-ways slot in the "card edition" art style. Demo credits only.

- `engine.js` – game math: symbols, weights, paytable, bonus rules. Edit here.
- `sim.js` – RTP simulator: `node web/sim.js 3000000 400000` (base rounds, bonuses per type, optional medal chance)
- `cards/*.jpg` – symbol art (cropped from the user's card sheets), embedded at build time.
- `background.jpg` – camp scene behind the page, embedded at build time.
- `logo.jpg` – the game logo, for use outside the game (store page, thumbnail). Not shown in the game.
- `template.html` – page, frames, bonus/wild art and UI. `/*ENGINE*/` and `/*CARDS*/` are filled in by the build.
- `build.js` – `node web/build.js` writes `chain-of-command.html`.

Current tuning: ~96% RTP, 40% of rounds win, medal respin 1 in 60 rounds, bonus 1 in 164, max bonus 1 in 3,190 (wilds that win lock for the rest of the max bonus).
