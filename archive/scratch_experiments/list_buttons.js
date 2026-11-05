const fs = require('fs');
const content = fs.readFileSync('./apps-script-webapp/Index.html', 'utf8');
const buttonRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
let m;
const buttons = [];
while ((m = buttonRegex.exec(content)) !== null) {
  const full = m[0];
  const idMatch = full.match(/id=['"]([^'"]+)['"]/i);
  const onclickMatch = full.match(/onclick=['"]([^'"]+)['"]/i);
  const text = m[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
  buttons.push({ id: idMatch ? idMatch[1] : null, onclick: onclickMatch ? onclickMatch[1] : null, text });
}
console.log('Total buttons in Index.html:', buttons.length);
console.log(JSON.stringify(buttons, null, 2));
