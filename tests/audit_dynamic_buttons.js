const fs = require('fs');
const path = require('path');

const js = fs.readFileSync(path.join(__dirname, '..', 'apps-script-webapp', 'JavaScript.html'), 'utf8');

console.log('=== AUDITORÍA DE BOTONES GENERADOS DINÁMICAMENTE EN JAVASCRIPT.HTML ===');

// Buscar todos los `<button` o `<a` dentro de strings en JS
const btnRegex = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
let m;
const dynamicButtons = [];

while ((m = btnRegex.exec(js)) !== null) {
  const tag = m[1];
  const attrs = m[2];
  const text = m[3].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const onclickMatch = attrs.match(/onclick=["']([^"']+)["']/i);
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  
  dynamicButtons.push({
    tag,
    id: idMatch ? idMatch[1] : null,
    className: classMatch ? classMatch[1] : null,
    onclick: onclickMatch ? onclickMatch[1] : null,
    text
  });
}

console.log(`Total de botones/links dinámicos encontrados: ${dynamicButtons.length}`);
dynamicButtons.forEach((b, i) => {
  console.log(`${i + 1}. [${b.tag}] text="${b.text}" onclick="${b.onclick || 'none'}" class="${b.className || 'none'}" id="${b.id || 'none'}"`);
});
