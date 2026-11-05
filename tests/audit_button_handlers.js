// Audita que todos los handlers inline (onclick, onchange, oninput, onkeyup...) apunten a funciones globales definidas.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'apps-script-webapp');
const index = fs.readFileSync(path.join(dir, 'Index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'JavaScript.html'), 'utf8');
const script = (js.match(/<script[^>]*>([\s\S]*?)<\/script>/) || [, js])[1];

// Nombres definidos a nivel global (vía window.X = , function X, o top-level)
const defined = new Set();
for (const m of script.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
for (const m of script.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
for (const m of script.matchAll(/(?:^|\n)\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);

const builtins = new Set(['event', 'this', 'document', 'window', 'alert', 'confirm', 'prompt', 'if', 'return', 'void', 'event.stopPropagation', 'google', 'setTimeout', 'console', 'location', 'navigator', 'Math', 'parseInt', 'parseFloat', 'encodeURIComponent', 'String', 'Number', 'JSON']);
const handlerRe = /\son(?:click|change|input|keyup|keydown|keypress|submit|focus|blur)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function audit(label, text) {
  const missing = new Map();
  let total = 0;
  for (const m of text.matchAll(handlerRe)) {
    const code = m[1] || m[2] || '';
    total++;
    for (const c of code.matchAll(/([A-Za-z_$][\w$.]*)\s*\(/g)) {
      const root = c[1].split('.')[0];
      if (builtins.has(root) || builtins.has(c[1])) continue;
      if (!defined.has(root)) {
        if (!missing.has(root)) missing.set(root, []);
        missing.get(root).push(code.slice(0, 80));
      }
    }
  }
  console.log(`\n[${label}] handlers inline: ${total}`);
  if (!missing.size) console.log('  ✅ Todos los handlers resuelven a funciones definidas');
  for (const [fn, uses] of missing) console.log(`  ❌ ${fn}()  (${uses.length} usos)  ej: ${uses[0]}`);
  return missing.size;
}

const bad = audit('Index.html', index) + audit('JavaScript.html (HTML dinámico)', script);

// Funciones declaradas dentro de bloques/IIFE no son globales: detectar IIFE o DOMContentLoaded que encierran funciones usadas en onclick
console.log(`\nResumen: ${bad} funciones faltantes/no globales`);
process.exit(bad ? 1 : 0);
