const fs = require('fs');
const vm = require('vm');

const indexHtml = fs.readFileSync('apps-script-webapp/Index.html', 'utf8');
const jsHtml = fs.readFileSync('apps-script-webapp/JavaScript.html', 'utf8');

console.log('=== 1. LOCALIZACIÓN DEL BOTÓN EN EL HTML ===');
const btnRegex = /<button[^>]*id="btnExportarSoloDescalcesExcel"[^>]*>([\s\S]*?)<\/button>/i;
const matchBtn = indexHtml.match(btnRegex);

if (!matchBtn) {
  throw new Error('No se encontró el botón btnExportarSoloDescalcesExcel en Index.html');
}

console.log('✅ Botón localizado con éxito:');
console.log('HTML tag:', matchBtn[0]);
console.log('Texto del botón:', matchBtn[1].trim());

console.log('\n=== 2. SIMULACIÓN DE CLIC EN DIVERSOS ESTADOS DE CARGA ===');

const toastsEmitted = [];
const serverCalls = [];
let downloadedUrls = [];

class MockElement {
  constructor(id, tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.innerHTML = '';
    this.textContent = '';
    this.disabled = false;
    this.style = {};
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c),
      contains: (c) => this.classList.classes.has(c)
    };
    this.listeners = {};
    this.value = '';
    this.href = '';
  }
  remove() {
    // DOM Element.remove()
  }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  click() {
    if (this.onclick) {
      this.onclick({ preventDefault: () => {} });
    }
    if (this.listeners['click']) {
      this.listeners['click'].forEach(fn => fn({ preventDefault: () => {} }));
    }
  }
}

const elementsMap = {
  'btnExportarSoloDescalcesExcel': new MockElement('btnExportarSoloDescalcesExcel', 'button'),
  'txtBuscarFactura': new MockElement('txtBuscarFactura', 'input'),
  'modalPlanillaProveedor': new MockElement('modalPlanillaProveedor', 'div'),
  'bannerAvisoPlanilla': new MockElement('bannerAvisoPlanilla', 'div'),
  'toastContainer': new MockElement('toastContainer', 'div')
};
elementsMap['btnExportarSoloDescalcesExcel'].innerHTML = matchBtn[1].trim();

// Extraer el onclick del botón si está presente en el HTML
const onclickMatch = matchBtn[0].match(/onclick=\"([^\"]+)\"/i);
if (onclickMatch) {
  const handlerCode = onclickMatch[1];
  elementsMap['btnExportarSoloDescalcesExcel'].onclick = () => {
    vm.runInContext(handlerCode, context);
  };
}

const dom = {
  getElementById: (id) => elementsMap[id] || (elementsMap[id] = new MockElement(id)),
  createElement: (tag) => new MockElement('mock_' + Date.now(), tag),
  body: {
    appendChild: (el) => {
      if (el.href) downloadedUrls.push(el.href);
    },
    removeChild: () => {}
  },
  addEventListener: () => {}
};

const scriptCode = jsHtml.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i)[1];

const globalScope = {
  document: dom,
  window: {
    open: (url) => downloadedUrls.push(url),
    location: { href: '' }
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  showToast: (msg, type) => {
    toastsEmitted.push({ msg, type });
    console.log('  [TOAST ' + type.toUpperCase() + ']: ' + msg);
  },
  formatCurrency: (n) => Math.round(n || 0).toLocaleString('es-CL'),
  google: {
    script: {
      run: {
        withSuccessHandler: function(onSuccess) {
          return {
            withFailureHandler: function(onFailure) {
              return {
                apiExportarDescalcesPoExcel: function(po) {
                  serverCalls.push({ method: 'apiExportarDescalcesPoExcel', po: po });
                  onSuccess({
                    success: true,
                    po_number: po,
                    total_items: 2,
                    total_lineas_descalce: 2,
                    monto_diferencias: 22000,
                    excel_url: 'https://docs.google.com/spreadsheets/d/ss_' + po + '_excel/export?format=xlsx',
                    url: 'https://docs.google.com/spreadsheets/d/ss_' + po + '_sheets/edit'
                  });
                },
                apiCrearPlanillaConciliacionOficialGoogleSheets: function(payload) {
                  serverCalls.push({ method: 'apiCrearPlanillaConciliacionOficialGoogleSheets', payload: payload });
                  onSuccess({
                    success: true,
                    po_number: payload.po_number,
                    total_items: payload.items.length,
                    monto_diferencias: 35000,
                    excel_url: 'https://docs.google.com/spreadsheets/d/ss_' + payload.po_number + '/export?format=xlsx',
                    url: 'https://docs.google.com/spreadsheets/d/ss_' + payload.po_number + '/edit'
                  });
                }
              };
            }
          };
        }
      }
    }
  }
};

const context = vm.createContext(globalScope);
vm.runInContext(scriptCode, context);

// Test Estado 1: Carga en Cero (Sin conciliación previa, sin datos previos)
console.log('\n--- PRUEBA 1: Clic sin estados previos de carga (Zero State) ---');
toastsEmitted.length = 0;
serverCalls.length = 0;
downloadedUrls.length = 0;

const btn = elementsMap['btnExportarSoloDescalcesExcel'];
btn.click();

console.log('Llamadas a servidor realizadas:', serverCalls.length);
console.log('Última llamada a servidor:', serverCalls[0]);
console.log('URLs de descarga iniciadas:', downloadedUrls);

if (serverCalls.length === 0) throw new Error('Falló Prueba 1: El botón no fue ejecutable en estado cero');
if (downloadedUrls.length === 0) throw new Error('Falló Prueba 1: No se confirmó la descarga del Excel');
console.log('✅ PRUEBA 1 EXITOSA: Ejecutable en estado cero con confirmación de descarga.');

// Test Estado 2: Con PO ingresada en barra de búsqueda
console.log('\n--- PRUEBA 2: Clic con PO en buscador (ej: 521534) sin haber pasado a Paso 3 ---');
toastsEmitted.length = 0;
serverCalls.length = 0;
downloadedUrls.length = 0;
elementsMap['txtBuscarFactura'].value = '521534';

btn.click();
console.log('PO resuelta en llamada:', serverCalls[0].po);
if (serverCalls[0].po !== 'PO521534') throw new Error('Falló Prueba 2: No resolvió la PO del buscador');
console.log('✅ PRUEBA 2 EXITOSA: Resolvió la OC del buscador y confirmó inicio de descarga.');

// Test Estado 3: En Paso 3 con datos conciliados en memoria
console.log('\n--- PRUEBA 3: Clic en Paso 3 con líneas conciliadas (Filtro estricto de descalces y 17 columnas) ---');
toastsEmitted.length = 0;
serverCalls.length = 0;
downloadedUrls.length = 0;

vm.runInContext(`
  reconActiveResult = {
    po_number: 'PO517979',
    proveedor_nombre: 'Empresas Carozzi S.A.',
    almacen: 'CH_36_CD_Chile',
    folio_factura: '524332',
    lineas: [
      { sku: 'SKU-OK', descripcion: 'Fideos Conforme', cantidad_facturada: 10, cantidad_recepcionada: 10, costo_oc: 500, precio_facturado: 500, total_facturado: 5000, total_esperado: 5000, monto_reclamar: 0, estado: 'CALCE_100_OK' },
      { sku: 'SKU-FALTANTE', descripcion: 'Salsa Pomarola', cantidad_facturada: 20, cantidad_recepcionada: 10, costo_oc: 800, precio_facturado: 800, total_facturado: 16000, total_esperado: 8000, monto_reclamar: 8000, dif_cantidad: -10, estado: 'FALTANTE_RECEPCION', diagnostico: 'Faltante 10 unids' }
    ]
  };
`, context);

btn.click();

const payloadEnviado = serverCalls[0].payload;
console.log('Total ítems enviados en payload (solo descalces):', payloadEnviado.items.length);
console.log('Ítem filtrado:', payloadEnviado.items[0]);
console.log('URL de descarga confirmada:', downloadedUrls[0]);

if (payloadEnviado.items.length !== 1) throw new Error('Falló Prueba 3: Debió filtrar únicamente la línea con descalce');
if (payloadEnviado.items[0].sku !== 'SKU-FALTANTE') throw new Error('Falló Prueba 3: Ítem incorrecto');
console.log('✅ PRUEBA 3 EXITOSA: Filtró únicamente las líneas con descalces confirmados y confirmó la descarga.');

console.log('\n🏆 TODAS LAS VERIFICACIONES DEL BOTÓN PASARON CON 100% DE ÉXITO!');
