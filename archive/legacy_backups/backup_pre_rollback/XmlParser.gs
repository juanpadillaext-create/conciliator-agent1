/**
 * XmlParser.gs
 * Módulo para parsear documentos tributarios electrónicos (DTE) chilenos en formato XML.
 * Utiliza XmlService de Google Apps Script con soporte para namespaces del SII.
 */

function parseDteXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') {
    throw new Error('Contenido XML inválido o vacío.');
  }

  // Limpieza básica de cabeceras o BOM si fuera necesario
  const cleanXml = xmlText.trim().replace(/^\uFEFF/, '');
  const document = XmlService.parse(cleanXml);
  const root = document.getRootElement();

  // Buscar elemento DTE
  const dteElement = findElementRecursive(root, 'DTE');
  if (!dteElement) {
    throw new Error('No se encontró el nodo <DTE> en el documento XML.');
  }

  // Buscar Documento
  const docElement = findElementRecursive(dteElement, 'Documento') || dteElement;
  const encabezado = findElementRecursive(docElement, 'Encabezado');

  const parsedData = {
    folio: null,
    tipo_dte: null,
    fecha_emision: null,
    emisor: { rut: '', razon_social: '', giro: '' },
    receptor: { rut: '', razon_social: '', direccion: '', comuna: '' },
    totales: { neto: 0, iva: 0, total: 0 },
    referencias: [],
    items: []
  };

  if (encabezado) {
    // IdDoc
    const idDoc = findElementRecursive(encabezado, 'IdDoc');
    if (idDoc) {
      parsedData.folio = getElementText(idDoc, 'Folio');
      parsedData.tipo_dte = getElementText(idDoc, 'TipoDTE');
      parsedData.fecha_emision = getElementText(idDoc, 'FchEmis');
    }

    // Emisor
    const emisor = findElementRecursive(encabezado, 'Emisor');
    if (emisor) {
      parsedData.emisor.rut = getElementText(emisor, 'RUTEmisor');
      parsedData.emisor.razon_social = getElementText(emisor, 'RznSoc');
      parsedData.emisor.giro = getElementText(emisor, 'GiroEmis');
    }

    // Receptor
    const receptor = findElementRecursive(encabezado, 'Receptor');
    if (receptor) {
      parsedData.receptor.rut = getElementText(receptor, 'RUTRecep');
      parsedData.receptor.razon_social = getElementText(receptor, 'RznSocRecep');
      parsedData.receptor.direccion = getElementText(receptor, 'DirRecep');
      parsedData.receptor.comuna = getElementText(receptor, 'CmnaRecep');
    }

    // Totales
    const totales = findElementRecursive(encabezado, 'Totales');
    if (totales) {
      parsedData.totales.neto = parseFloat(getElementText(totales, 'MntNeto') || '0');
      parsedData.totales.iva = parseFloat(getElementText(totales, 'IVA') || '0');
      parsedData.totales.total = parseFloat(getElementText(totales, 'MntTotal') || '0');
    }
  }

  // Extraer Referencias (ej: Orden de Compra 801)
  const refs = findAllElementsRecursive(docElement, 'Referencia');
  refs.forEach(ref => {
    const tpo = getElementText(ref, 'TpoDocRef');
    const folioRef = getElementText(ref, 'FolioRef');
    const fch = getElementText(ref, 'FchRef');
    const razon = getElementText(ref, 'RazonRef');
    const cleanFolioRef = (folioRef || '').replace(/^PO/i, '').replace(/^OC/i, '').trim();
    const looksLikePoNum = /^\d{5,10}$/.test(cleanFolioRef.replace(/^0+/, ''));
    const isPoRef = (tpo === '801' || tpo === 'CL801' || tpo === 'OC' || tpo === 'HES' ||
                    (razon && /orden|compra|po/i.test(razon)) ||
                    looksLikePoNum);

    parsedData.referencias.push({
      tipo: tpo,
      folio: folioRef,
      fecha: fch,
      razon: razon,
      is_po: isPoRef
    });
  });

  // Extraer Detalle de Ítems / Productos
  const detalles = findAllElementsRecursive(docElement, 'Detalle');
  detalles.forEach((det, index) => {
    const cdgItem = findElementRecursive(det, 'CdgItem');
    let vlrCodigo = cdgItem ? getElementText(cdgItem, 'VlrCodigo') : '';
    let tpoCodigo = cdgItem ? getElementText(cdgItem, 'TpoCodigo') : '';

    if (!vlrCodigo) {
      // Intentar buscar directamente VlrCodigo en el nodo Detalle
      vlrCodigo = getElementText(det, 'VlrCodigo');
    }

    const nmbItem = getElementText(det, 'NmbItem');
    const dscItem = getElementText(det, 'DscItem');
    const qty = parseFloat(getElementText(det, 'QtyItem') || '0');
    const unmd = getElementText(det, 'UnmdItem') || 'UN';
    const prc = parseFloat(getElementText(det, 'PrcItem') || '0');
    const monto = parseFloat(getElementText(det, 'MontoItem') || '0');

    parsedData.items.push({
      linea: index + 1,
      codigo: vlrCodigo.trim(),
      tipo_codigo: tpoCodigo,
      descripcion: nmbItem.trim(),
      descripcion_adicional: dscItem ? dscItem.trim() : '',
      cantidad_facturada: qty,
      unidad_medida: unmd,
      precio_facturado: prc,
      monto_facturado: monto
    });
  });

  // Extraer Descuentos y Recargos Globales (ej: TOTAL FLETES de Coca-Cola Embonor)
  const dscRcgs = findAllElementsRecursive(docElement, 'DscRcgGlobal');
  parsedData.descuentos_recargos = [];
  parsedData.total_fletes = 0;
  dscRcgs.forEach(dr => {
    const tpo = getElementText(dr, 'TpoMov');
    const glosa = getElementText(dr, 'GlosaDR') || 'RECARGO/DESCUENTO GLOBAL';
    const valor = parseFloat(getElementText(dr, 'ValorDR') || '0');
    parsedData.descuentos_recargos.push({
      tipo: tpo === 'R' ? 'RECARGO' : 'DESCUENTO',
      glosa: glosa,
      valor: valor
    });
    if (tpo === 'R') {
      if (/flete|transporte|despacho/i.test(glosa)) {
        parsedData.total_fletes += valor;
      }
    }
  });

  // Si la factura tiene recargo global de flete (ej: Coca-Cola Embonor $48.061 en folio 105214263),
  // se incorpora como línea de auditoría explícita para que el detalle de SKUs sume exactamente el neto del DTE.
  if (parsedData.total_fletes > 0) {
    parsedData.items.push({
      linea: parsedData.items.length + 1,
      codigo: 'FLETE-PROV',
      tipo_codigo: 'FLETE',
      descripcion: `TOTAL FLETES (Recargo Global de Transporte)`,
      descripcion_adicional: 'Recargo global estipulado en DTE pero no ordenado en la OC física',
      cantidad_facturada: 1,
      unidad_medida: 'GL',
      precio_facturado: parsedData.total_fletes,
      monto_facturado: parsedData.total_fletes,
      es_flete: true
    });
  }

  return parsedData;
}

/**
 * Busca de forma recursiva el primer elemento cuyo nombre local coincida.
 */
function findElementRecursive(element, localName) {
  if (!element) return null;
  if (element.getName && element.getName().toLowerCase() === localName.toLowerCase()) {
    return element;
  }
  const children = element.getChildren();
  for (let i = 0; i < children.length; i++) {
    const found = findElementRecursive(children[i], localName);
    if (found) return found;
  }
  return null;
}

/**
 * Busca recursivamente todos los elementos cuyo nombre local coincida.
 */
function findAllElementsRecursive(element, localName) {
  const results = [];
  if (!element) return results;

  function search(node) {
    if (node.getName && node.getName().toLowerCase() === localName.toLowerCase()) {
      results.push(node);
      return;
    }
    const children = node.getChildren();
    for (let i = 0; i < children.length; i++) {
      search(children[i]);
    }
  }

  search(element);
  return results;
}

/**
 * Obtiene el texto de un elemento hijo directo por nombre local.
 */
function getElementText(parent, localName) {
  if (!parent) return '';
  const child = findElementRecursive(parent, localName);
  return child ? child.getText().trim() : '';
}
