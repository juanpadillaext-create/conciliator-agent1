/**
 * GenerarSlides.gs
 * Generador automático de la presentación ejecutiva en Google Slides.
 * VERSIÓN ULTRA-RESUMIDA: Resumen Ejecutivo en 1 Sola Diapositiva (Executive One-Pager).
 * Paleta Corporativa Oficial PedidosYa / Dmarts Chile.
 */

function generarPresentacionSlides() {
  const tituloPresentacion = 'Resumen Ejecutivo: Agente Conciliador Dmarts';
  const presentation = SlidesApp.create(tituloPresentacion);
  
  // Limpiar diapositiva por defecto
  const slidesIniciales = presentation.getSlides();
  if (slidesIniciales.length > 0) {
    slidesIniciales[0].remove();
  }

  // Paleta de Colores Oficial PedidosYa / Dmarts
  const TEMA = {
    BG_SLIDE: '#F8FAFC',        // Slate 50 (Fondo limpio)
    CARD_BG: '#FFFFFF',         // Blanco puro para tarjetas
    CARD_BORDER: '#E2E8F0',     // Slate 200 (Bordes sutiles)
    TEXT_MAIN: '#0F172A',       // Slate 900 (Títulos)
    TEXT_MUTED: '#475569',      // Slate 600 (Texto secundario)
    
    BRAND_PEYA: '#FF1A53',      // Rojo Oficial PedidosYa
    ACCENT_BLUE: '#2563EB',     // Azul Tecnológico
    ACCENT_GREEN: '#059669',    // Verde Éxito
    
    CHIP_RED_BG: '#FFF1F4',     // Fondo rojo tenue
    CHIP_BLUE_BG: '#EFF6FF',    // Fondo azul tenue
    CHIP_GREEN_BG: '#ECFDF5',   // Fondo verde tenue
    
    BANNER_DARK: '#0F172A',     // Slate 900
    BANNER_TEXT: '#FFFFFF'
  };

  const slide = presentation.appendSlide();
  configurarFondoSlide(slide, TEMA.BG_SLIDE);

  // Cabecera Principal
  agregarCabeceraSlide(
    slide,
    'RESUMEN EJECUTIVO',
    'Automatización del Agente Conciliador',
    'DTE Axteroid ↔ BigQuery cl_dmarts ↔ SAP Sociedad 6202 (Cuentas por Pagar & Bodega)',
    TEMA.BRAND_PEYA,
    TEMA
  );

  const cardWidth = 215;
  const cardHeight = 220;
  const cardY = 105;

  // Columna 1: El Problema (As-Is)
  agregarTarjeta(
    slide,
    30, cardY, cardWidth, cardHeight,
    '1. El Problema (As-Is)',
    'Fricción & Riesgo',
    '• Fuga de liquidez por mercadería pagada pero no recibida en bodega.\n• Notas de Crédito no cobradas por falta de conciliación oportuna.\n• Alzas de precio (PPV) no pactadas que pasan inadvertidas.\n• Cruce manual en Excel lento y propenso a error (+44 DTEs por OC).',
    TEMA.CHIP_RED_BG,
    TEMA.BRAND_PEYA,
    TEMA
  );

  // Columna 2: La Solución (To-Be)
  agregarTarjeta(
    slide,
    253, cardY, cardWidth, cardHeight,
    '2. La Solución (To-Be)',
    'Automatización en Segundos',
    '• Buscador universal en vivo que detecta PO, DTE o RUT al instante.\n• Motor Agente Conciliador SKU x SKU (faltante físico vs. PPV).\n• Generador de Planilla Oficial Finanzas (con SUMPRODUCT) en 1 clic.\n• Póliza contable cuadrada para SAP Sociedad 6202 (Debe == Haber).',
    TEMA.CHIP_BLUE_BG,
    TEMA.ACCENT_BLUE,
    TEMA
  );

  // Columna 3: Próximos Pasos (Roadmap)
  agregarTarjeta(
    slide,
    476, cardY, cardWidth, cardHeight,
    '3. Próximos Pasos',
    'Plan de Despliegue',
    '• Calibrar Diferencia de Moneda Local (Dif ML / CLP).\n• Memoria caché para procesar lotes masivos (+50 DTEs).\n• Marcha blanca controlada con Carozzi e Ideal.\n• Capacitación práctica al equipo de Cuentas por Pagar (AP).',
    TEMA.CHIP_GREEN_BG,
    TEMA.ACCENT_GREEN,
    TEMA
  );

  // Banner Inferior de Impacto
  agregarBannerInferior(
    slide,
    30, 335, 660, 42,
    '🎯 IMPACTO ESPERADO: De 2-3 días a < 30 segs por orden | 100% recupero de Notas de Crédito | Cero descuadres en SAP 6202.',
    TEMA.BANNER_DARK,
    TEMA.BANNER_TEXT
  );

  presentation.saveAndClose();
  const url = presentation.getUrl();
  const id = presentation.getId();
  
  Logger.log('====================================================');
  Logger.log('Presentación Ejecutiva (One-Pager) creada con éxito: ' + url);
  Logger.log('====================================================');

  return {
    success: true,
    url: url,
    id: id,
    title: tituloPresentacion
  };
}

/**
 * Alias de compatibilidad.
 */
function generarSlideOnePager() {
  return generarPresentacionSlides();
}

// ===========================================================================
// FUNCIONES AUXILIARES DE DISEÑO Y MAQUETACIÓN EN SLIDESAPP
// ===========================================================================

function configurarFondoSlide(slide, colorHex) {
  slide.getBackground().setSolidFill(colorHex);
}

function agregarCabeceraSlide(slide, tagText, titleText, subtitleText, tagColorHex, TEMA) {
  // Chip de categoría superior
  const tagBox = slide.insertTextBox(tagText, 30, 22, 200, 18);
  const tagStyle = tagBox.getText().getTextStyle();
  tagStyle.setFontFamily('Arial');
  tagStyle.setFontSize(9);
  tagStyle.setBold(true);
  tagStyle.setForegroundColor(tagColorHex);

  // Título principal
  const titleBox = slide.insertTextBox(titleText, 30, 42, 660, 32);
  const titleStyle = titleBox.getText().getTextStyle();
  titleStyle.setFontFamily('Arial');
  titleStyle.setFontSize(17);
  titleStyle.setBold(true);
  titleStyle.setForegroundColor(TEMA.TEXT_MAIN);

  // Subtítulo
  const subBox = slide.insertTextBox(subtitleText, 30, 74, 660, 22);
  const subStyle = subBox.getText().getTextStyle();
  subStyle.setFontFamily('Arial');
  subStyle.setFontSize(10.5);
  subStyle.setForegroundColor(TEMA.TEXT_MUTED);
}

function agregarTarjeta(slide, x, y, w, h, titulo, badgeText, itemsText, badgeBgHex, badgeTextHex, TEMA) {
  // Fondo de tarjeta con bordes redondeados (ROUND_RECTANGLE)
  const card = slide.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, x, y, w, h);
  card.getFill().setSolidFill(TEMA.CARD_BG);
  card.getBorder().getLineFill().setSolidFill(TEMA.CARD_BORDER);
  card.getBorder().setWeight(1);

  // Badge / Chip
  const badge = slide.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, x + 12, y + 12, w - 24, 20);
  badge.getFill().setSolidFill(badgeBgHex);
  badge.getBorder().setTransparent();
  badge.getText().setText(badgeText.toUpperCase());
  const bStyle = badge.getText().getTextStyle();
  bStyle.setFontFamily('Arial');
  bStyle.setFontSize(8);
  bStyle.setBold(true);
  bStyle.setForegroundColor(badgeTextHex);

  // Título de tarjeta
  const titleBox = slide.insertTextBox(titulo, x + 12, y + 36, w - 24, 26);
  const tStyle = titleBox.getText().getTextStyle();
  tStyle.setFontFamily('Arial');
  tStyle.setFontSize(12);
  tStyle.setBold(true);
  tStyle.setForegroundColor(TEMA.TEXT_MAIN);

  // Contenido / Viñetas
  const bodyBox = slide.insertTextBox(itemsText, x + 12, y + 62, w - 24, h - 70);
  const bBodyStyle = bodyBox.getText().getTextStyle();
  bBodyStyle.setFontFamily('Arial');
  bBodyStyle.setFontSize(9.5);
  bBodyStyle.setForegroundColor(TEMA.TEXT_MUTED);
}

function agregarBannerInferior(slide, x, y, w, h, texto, bgHex, textHex) {
  // Banner inferior con bordes redondeados (ROUND_RECTANGLE)
  const banner = slide.insertShape(SlidesApp.ShapeType.ROUND_RECTANGLE, x, y, w, h);
  banner.getFill().setSolidFill(bgHex);
  banner.getBorder().setTransparent();
  banner.getText().setText(texto);
  const style = banner.getText().getTextStyle();
  style.setFontFamily('Arial');
  style.setFontSize(9.5);
  style.setBold(true);
  style.setForegroundColor(textHex);
}
