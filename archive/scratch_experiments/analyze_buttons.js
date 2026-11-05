const fs = require('fs');

const indexHtml = fs.readFileSync('apps-script-webapp/Index.html', 'utf8');
const jsHtml = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');

// Find all buttons in Index.html
const btnRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
let match;
const buttons = [];

while ((match = btnRegex.exec(indexHtml)) !== null) {
  const fullTag = match[0];
  const innerText = match[1].replace(/<[^>]+>/g, '').trim();
  const idMatch = fullTag.match(/id=["']([^"']+)["']/i);
  const onclickMatch = fullTag.match(/onclick=["']([^"']+)["']/i);
  const id = idMatch ? idMatch[1] : null;
  const onclick = onclickMatch ? onclickMatch[1] : null;

  let hasListener = false;
  if (id) {
    if (jsHtml.includes(`'${id}'`) || jsHtml.includes(`"${id}"`)) {
      hasListener = true;
    }
  }

  buttons.push({
    id,
    onclick,
    text: innerText.slice(0, 35),
    hasListener,
    isWired: !!(onclick || hasListener)
  });
}

console.log('Total buttons found in Index.html:', buttons.length);
const unwired = buttons.filter(b => !b.isWired);
console.log('Unwired buttons (NO id listener AND NO onclick):', unwired);
console.log('\nAll wired buttons:', buttons.map(b => `${b.id || 'NO-ID'} | onclick: ${b.onclick || 'none'} | text: "${b.text}"`));
