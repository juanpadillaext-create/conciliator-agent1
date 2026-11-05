/**
 * Automated Verification and Clasp Deployment Helper
 * Part of the axteroid-matching-webapp skill.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const APPS_SCRIPT_DIR = path.join(PROJECT_ROOT, 'apps-script-webapp');

console.log('=== [Skill: axteroid-matching-webapp] Validating Codebase ===\n');

// 1. Check all .gs files
const gsFiles = [
  'AutonomousAgents.gs',
  'AxteroidAPI.gs',
  'BigQueryAPI.gs',
  'Codigo.gs',
  'CruceEngine.gs',
  'GenerarSlides.gs',
  'JevTypeSafeAPI.gs',
  'JournalEntryVoucher.gs',
  'SheetsAPI.gs',
  'XmlParser.gs'
];

let hasErrors = false;

gsFiles.forEach(file => {
  const filePath = path.join(APPS_SCRIPT_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing file: ${file}`);
    hasErrors = true;
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    new Function(content);
    console.log(`✅ [Syntax OK] ${file} (${(content.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`❌ [Syntax Error] in ${file}:`, err.message);
    hasErrors = true;
  }
});

// 2. Check HTML templates exist
const htmlFiles = ['Index.html', 'Estilos.html', 'JavaScript.html'];
htmlFiles.forEach(file => {
  const filePath = path.join(APPS_SCRIPT_DIR, file);
  if (fs.existsSync(filePath)) {
    const size = (fs.statSync(filePath).size / 1024).toFixed(1);
    console.log(`✅ [Template OK] ${file} (${size} KB)`);
  } else {
    console.error(`❌ Missing HTML template: ${file}`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.error('\n❌ Verification failed. Resolve syntax errors before deploying.');
  process.exit(1);
}

console.log('\n✅ All 12 files verified cleanly.');

// 3. Optional Clasp Push
const shouldPush = process.argv.includes('--push');
if (shouldPush) {
  console.log('\n🚀 Executing clasp push to Google Apps Script...');
  try {
    const output = execSync('npx clasp push', { cwd: PROJECT_ROOT, encoding: 'utf8' });
    console.log(output);
    console.log('✅ Clasp push completed successfully!');
  } catch (pushErr) {
    console.error('❌ Error executing clasp push:', pushErr.message);
    process.exit(1);
  }
} else {
  console.log('\n💡 Tip: Run `node validate_and_deploy.js --push` or `npm run push` to push directly to Google Apps Script.');
}
