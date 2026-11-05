const fs = require('fs');
const XLSX = require('./node_modules/xlsx') || null;

// Si no está local, podemos usar el script del navegador o cargar xlsx
console.log('Verificando exportación de PO524726...');
