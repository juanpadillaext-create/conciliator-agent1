const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = path.join(__dirname, '..', 'apps-script-webapp');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs'));

let allOk = true;
for (const f of files) {
  const fullPath = path.join(dir, f);
  const code = fs.readFileSync(fullPath, 'utf8');
  try {
    new vm.Script(code);
    console.log(`[SYNTAX OK] ${f}`);
  } catch (err) {
    console.error(`[SYNTAX ERROR] ${f}:`, err.message);
    allOk = false;
  }
}

if (!allOk) {
  process.exit(1);
} else {
  console.log('All .gs files passed syntax validation!');
}
