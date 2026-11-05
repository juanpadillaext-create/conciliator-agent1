const fs = require('fs');

// Check Index.html unclosed tags or syntax
const indexHtml = fs.readFileSync('apps-script-webapp/Index.html', 'utf8');
console.log('Index.html length:', indexHtml.length);

// Check Estilos.html
const estilosHtml = fs.readFileSync('apps-script-webapp/Estilos.html', 'utf8');
console.log('Estilos.html length:', estilosHtml.length);

// Check if all template includes in Index.html exist
const includes = [...indexHtml.matchAll(/<\?!\s*HtmlService\.createHtmlOutputFromFile\(['"]([^'"]+)['"]\)\.getContent\(\);\s*\?>/g)];
console.log('Template includes in Index.html:');
for (const inc of includes) {
  const fileName = inc[1] + '.html';
  const exists = fs.existsSync('apps-script-webapp/' + fileName);
  console.log(` - Include ${inc[1]} (${fileName}): ${exists ? 'EXISTS' : 'MISSING!'}`);
}
