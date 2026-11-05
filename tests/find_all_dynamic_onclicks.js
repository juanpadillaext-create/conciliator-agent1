const fs = require('fs');

const js = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');
const idx = fs.readFileSync('apps-script-webapp/Index.html', 'utf8');

const combined = js + '\n' + idx;
const regex = /onclick=["']\s*([a-zA-Z0-9_$]+)\s*\(/g;
const fns = new Set();
let match;
while ((match = regex.exec(combined)) !== null) {
  fns.add(match[1]);
}

console.log('--- Funciones invocadas vía onclick ---');
const list = Array.from(fns).sort();
list.forEach(fn => {
  const inJs = js.includes('function ' + fn) || js.includes(fn + ' = function') || js.includes(fn + ' = (') || js.includes('window.' + fn);
  const onWin = js.includes('window.' + fn);
  console.log(`${fn}: definida=${inJs}, en window=${onWin}`);
});
