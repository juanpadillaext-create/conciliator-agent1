const fs = require('fs');
const vm = require('vm');

const idx = fs.readFileSync('apps-script-webapp/Index.html', 'utf8');
const js = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');
const est = fs.readFileSync('apps-script-webapp/Estilos.html', 'utf8');

const scriptMatch = js.match(/<script[^>]*>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('ERROR: No script tag found in JavaScript.html');
  process.exit(1);
}

try {
  new vm.Script(scriptMatch[1], { filename: 'JavaScript.html' });
  console.log('✅ JavaScript.html se compila como script sin errores de sintaxis');
} catch (e) {
  console.error('❌ Error de compilación en JavaScript.html:', e);
}
