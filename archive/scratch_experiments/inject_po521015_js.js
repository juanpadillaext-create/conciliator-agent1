const fs = require('fs');

const filePath = 'apps-script-webapp/JavaScript.html';
let content = fs.readFileSync(filePath, 'utf8');

const snippet = fs.readFileSync('po521015_code_snippet.txt', 'utf8').trim();

// Target before PO517979_AUDIT_DATA
const target = 'const PO517979_AUDIT_DATA =';
if (!content.includes(target)) {
  console.error('Target not found in JavaScript.html!');
  process.exit(1);
}

if (!content.includes('PO521015_AUDIT_DATA')) {
  content = content.replace(target, snippet + '\n  ' + target);
}

// Also update line 3606
const checkTarget = "if ((!invItems || invItems.length === 0) && typeof PO517979_AUDIT_DATA !== 'undefined' && PO517979_AUDIT_DATA.facturas && PO517979_AUDIT_DATA.facturas[inv.folio]) {";
const checkReplacement = `if ((!invItems || invItems.length === 0) && typeof PO521015_AUDIT_DATA !== 'undefined' && PO521015_AUDIT_DATA.facturas && PO521015_AUDIT_DATA.facturas[inv.folio]) {
          invItems = PO521015_AUDIT_DATA.facturas[inv.folio].items;
        } else if ((!invItems || invItems.length === 0) && typeof PO517979_AUDIT_DATA !== 'undefined' && PO517979_AUDIT_DATA.facturas && PO517979_AUDIT_DATA.facturas[inv.folio]) {`;

content = content.replace(checkTarget, checkReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('JavaScript.html updated successfully. New size:', fs.statSync(filePath).size);
