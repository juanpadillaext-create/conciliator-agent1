const fs = require('fs');

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /onclick=["']([^"']+)["']/g;
  let match;
  const set = new Set();
  while ((match = regex.exec(content)) !== null) {
    // Extract function name
    const fnMatch = match[1].match(/^([a-zA-Z0-9_$]+)\s*\(/);
    if (fnMatch) {
      set.add(fnMatch[1]);
    } else {
      set.add(match[1]);
    }
  }
  return Array.from(set);
}

console.log('Index.html onclicks:', checkFile('apps-script-webapp/Index.html'));
console.log('JavaScript.html generated onclicks:', checkFile('apps-script-webapp/JavaScript.html'));
