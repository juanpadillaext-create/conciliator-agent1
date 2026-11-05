const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleGasRpc } = require('./mock_data.js');

const WEBAPP_DIR = path.resolve(__dirname, '../../apps-script-webapp');

function buildHtml() {
  const indexHtml = fs.readFileSync(path.join(WEBAPP_DIR, 'Index.html'), 'utf8');
  const estilosHtml = fs.readFileSync(path.join(WEBAPP_DIR, 'Estilos.html'), 'utf8');
  const jsHtml = fs.readFileSync(path.join(WEBAPP_DIR, 'JavaScript.html'), 'utf8');

  // Shim de google.script.run para interceptar llamadas RPC en entorno local
  const googleScriptShim = `
  <script>
    (function() {
      function createRunner(sH, fH) {
        var base = {
          _sH: sH || null,
          _fH: fH || null,
          withSuccessHandler: function(fn) {
            return createRunner(fn, this._fH);
          },
          withFailureHandler: function(fn) {
            return createRunner(this._sH, fn);
          }
        };

        return new Proxy(base, {
          get: function(target, prop) {
            if (prop in target) return target[prop];
            return function() {
              var args = Array.prototype.slice.call(arguments);
              fetch('/api/gas_rpc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method: prop, args: args })
              })
              .then(function(res) { return res.json(); })
              .then(function(data) {
                if (target._sH) target._sH(data);
              })
              .catch(function(err) {
                console.error('[RPC Error]', err);
                if (target._fH) target._fH(err);
              });
            };
          }
        });
      }

      window.google = window.google || {};
      window.google.script = window.google.script || {};
      window.google.script.run = createRunner();
      console.log('✅ [Local Mock] google.script.run inicializado correctamente.');
    })();
  </script>
  `;

  function resolveIncludes(content) {
    return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (match, filename) => {
      if (filename === 'Estilos') return estilosHtml;
      if (filename === 'JavaScript') return googleScriptShim + '\n' + jsHtml;
      const subPath = path.join(WEBAPP_DIR, filename + '.html');
      if (fs.existsSync(subPath)) {
        return resolveIncludes(fs.readFileSync(subPath, 'utf8'));
      }
      return match;
    });
  }

  return resolveIncludes(indexHtml);
}

function createServer() {
  const htmlContent = buildHtml();

  const server = http.createServer((req, res) => {
    // 1. Endpoint RPC
    if (req.method === 'POST' && req.url === '/api/gas_rpc') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const responseData = handleGasRpc(parsed.method, parsed.args);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(responseData));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // 2. Servir página principal
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(htmlContent);
      return;
    }

    // 404 por defecto
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return server;
}

module.exports = { createServer, buildHtml };
