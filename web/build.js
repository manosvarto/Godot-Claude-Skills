// Builds chain-of-command.html from template.html + engine.js
const fs = require('fs'), path = require('path');
const eng = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');
const body = eng.slice(eng.indexOf('const REELS'), eng.indexOf('if (typeof module'));
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'chain-of-command.html'), tpl.replace('/*ENGINE*/', () => body));
console.log('built');
