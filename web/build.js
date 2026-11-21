// Builds chain-of-command.html from template.html + engine.js + cards/*.jpg
const fs = require('fs'), path = require('path');
const eng = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const body = eng.slice(eng.indexOf('const REELS'), eng.indexOf('if (typeof module'));
const dir = path.join(__dirname, 'cards');
const cards = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort())
  cards[f.replace('.jpg', '')] = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const logo = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, 'logo.jpg')).toString('base64');
const out = tpl.replace('/*ENGINE*/', () => body).replace('/*CARDS*/', () => 'const CARD_IMG = ' + JSON.stringify(cards) + ';\nconst LOGO_IMG = ' + JSON.stringify(logo) + ';');
fs.writeFileSync(path.join(__dirname, 'chain-of-command.html'), out);
console.log('built', Object.keys(cards).length, 'cards,', (out.length / 1024).toFixed(0), 'KB');
