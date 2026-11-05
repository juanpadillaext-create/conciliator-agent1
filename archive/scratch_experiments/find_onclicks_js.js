const fs = require('fs');
const content = fs.readFileSync('./apps-script-webapp/JavaScript.html', 'utf8');
const regex = /onclick=['"]([^'"]+)['"]/gi;
let m;
const onClicks = new Set();
while ((m = regex.exec(content)) !== null) {
  onClicks.add(m[1].trim());
}
console.log('Unique onclick attributes in JavaScript.html:');
Array.from(onClicks).forEach(c => console.log(' - ' + c));
