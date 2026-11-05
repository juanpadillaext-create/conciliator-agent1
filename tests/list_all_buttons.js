const fs = require('fs');
const path = require('path');

const idx = fs.readFileSync(path.join(__dirname, '..', 'apps-script-webapp', 'Index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'apps-script-webapp', 'JavaScript.html'), 'utf8');

const btnRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
let m;
const buttons = [];

while ((m = btnRegex.exec(idx)) !== null) {
  const attrs = m[1];
  const text = m[2].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const onclickMatch = attrs.match(/onclick=["']([^"']+)["']/i);
  const id = idMatch ? idMatch[1] : null;
  const onclick = onclickMatch ? onclickMatch[1] : null;

  let status = 'UNKNOWN';
  if (onclick) {
    status = 'ONCLICK: ' + onclick;
  } else if (id) {
    if (js.includes(`getElementById('${id}')`) || js.includes(`getElementById("${id}")`)) {
      status = 'JS getElementById OK';
    } else if (js.includes(id)) {
      status = 'JS mentions ID';
    } else {
      status = '❌ UNHANDLED';
    }
  } else {
    status = '❌ NO ID NO ONCLICK';
  }
  buttons.push({ id, text, status });
}

console.log(`Total <button> en Index.html: ${buttons.length}`);
buttons.forEach((b, i) => {
  console.log(`${(i+1).toString().padStart(2, '0')}. id="${b.id || '---'}" text="${b.text.slice(0, 35).padEnd(35)}" -> ${b.status}`);
});
