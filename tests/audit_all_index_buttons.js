const fs = require('fs');
const path = require('path');

const idx = fs.readFileSync(path.join(__dirname, '..', 'apps-script-webapp', 'Index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'apps-script-webapp', 'JavaScript.html'), 'utf8');

console.log('=== AUDITORÍA COMPLETA DE BOTONES, MODALES Y ACCIONES ===');

// 1. Modales
const modalRegex = /class=["'][^"']*modal-overlay[^"']*["'][^>]*id=["']([^"']+)["']/gi;
let m;
console.log('\n--- Modales encontrados en Index.html ---');
while ((m = modalRegex.exec(idx)) !== null) {
  const modalId = m[1];
  console.log(`Modal: #${modalId} -> Presente en JS: ${js.includes(modalId)}`);
}

// 2. Botones y enlaces
const btnRegex = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const unhandled = [];
let total = 0;

while ((m = btnRegex.exec(idx)) !== null) {
  total++;
  const tag = m[1];
  const attrs = m[2];
  const text = m[3].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const onclickMatch = attrs.match(/onclick=["']([^"']+)["']/i);
  const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
  const id = idMatch ? idMatch[1] : null;
  const onclick = onclickMatch ? onclickMatch[1] : null;
  const href = hrefMatch ? hrefMatch[1] : null;

  if (onclick) continue;
  if (href && !href.startsWith('#') && !href.startsWith('javascript:void')) continue;
  if (id && js.includes(id)) continue;

  unhandled.push({ tag, id, text, attrs });
}

console.log(`\n--- Botones / Enlaces sin handler (${unhandled.length} de ${total}) ---`);
unhandled.forEach(u => console.log(`- <${u.tag} id="${u.id}"> "${u.text}"`));

// 3. Inputs de archivo o acciones
const inputFiles = idx.match(/<input\b[^>]*type=["']file["'][^>]*>/gi) || [];
console.log(`\n--- Inputs de archivo (${inputFiles.length}) ---`);
inputFiles.forEach(inp => {
  const id = (inp.match(/id=["']([^"']+)["']/) || [])[1];
  console.log(`Input file id="${id}" -> en JS: ${js.includes(id)}`);
});

// 4. Verificación de funciones en onclick de Index.html
const onclickRegex = /onclick=["']([^"']+)["']/gi;
const onclickFns = new Set();
while ((m = onclickRegex.exec(idx)) !== null) {
  const call = m[1].trim();
  const fnMatch = call.match(/^([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch) onclickFns.add(fnMatch[1]);
}
console.log(`\n--- Funciones llamadas en onclick (${onclickFns.size}) ---`);
let fnsMissing = 0;
for (const fn of onclickFns) {
  const exists = js.includes('function ' + fn) || js.includes('window.' + fn) || js.includes(fn + ' =');
  if (!exists) {
    console.log(`❌ Función faltante: ${fn}()`);
    fnsMissing++;
  } else {
    console.log(`✅ ${fn}()`);
  }
}
console.log(`\nFunciones faltantes en onclick: ${fnsMissing}`);
