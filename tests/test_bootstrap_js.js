const fs = require('fs');
const vm = require('vm');

let html = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8').trim();
if (html.startsWith('<script>')) html = html.slice(8);
if (html.endsWith('</script>')) html = html.slice(0, -9);

const topListenerRegex = /document\.addEventListener\('DOMContentLoaded', \(\) => {[\s\S]*?initWizardFlow\(\);[\s\S]*?\}\);/;
html = html.replace(topListenerRegex, '// Listener moved to end');

html += `
function bootApplication() {
  try { initThemeSystem(); } catch (e) { console.warn(e); }
  try { initSettingsModal(); } catch (e) { console.warn(e); }
  try { loadSystemSettings(); } catch (e) { console.warn(e); }
  try { initWizardFlow(); console.log('initWizardFlow SUCCESSFUL!'); } catch (e) { console.error('CRASH in initWizardFlow:', e); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApplication);
} else {
  bootApplication();
}
`;

const mockWindow = {
  document: {
    readyState: 'complete',
    addEventListener: (evt, fn) => fn(),
    getElementById: (id) => ({
      id,
      value: '',
      style: {},
      classList: { add: () => {}, remove: () => {} },
      addEventListener: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      children: []
    }),
    querySelectorAll: () => [],
    documentElement: { setAttribute: () => {} },
    body: { classList: { add: () => {}, remove: () => {} } }
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Proxy: Proxy,
  google: { script: { run: {} } }
};
mockWindow.window = mockWindow;

try {
  vm.runInNewContext(html, mockWindow);
  console.log('Top level execution finished successfully!');
} catch(e) {
  console.error('CRASH in script:', e);
}
