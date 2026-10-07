/**
 * AGENTE-KREA V1 — Auditoría de Emparejamiento con Arquitectura Universal ALBRA
 * Genera documento DOCX profesional con las 26 fases del audit.
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, PageBreak, BorderStyle,
  ShadingType, TableOfContents, Tab, TabStopType, TabStopPosition,
  convertInchesToTwip, LevelFormat, UnderlineType, ImageRun,
  Header, Footer, PageNumber, NumberFormat
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─── Constants ─────────────────────────────────────────────
const FONT_HEADING = "SimHei";
const FONT_BODY    = "SimSun";
const FONT_MONO    = "Courier New";
const PT = (n) => n * 2; // half-points
const BODY_SIZE = 24;   // 12pt in half-points
const H1_SIZE   = 32;   // 16pt
const H2_SIZE   = 30;   // 15pt
const H3_SIZE   = 28;   // 14pt
const LINE_SPACING = 312; // 1.3x ≈ 312 twips (240 * 1.3)
const FIRST_LINE_INDENT = 480;

// Colors
const COLOR_DARK    = "1B2A4A";
const COLOR_ACCENT  = "2E5090";
const COLOR_RED     = "C0392B";
const COLOR_ORANGE  = "E67E22";
const COLOR_GREEN   = "27AE60";
const COLOR_GRAY    = "555555";
const COLOR_LIGHT   = "F0F4F8";
const COLOR_WHITE   = "FFFFFF";
const COLOR_BLACK   = "000000";

// ─── Helper Functions ──────────────────────────────────────

function bodyPara(text, opts = {}) {
  const runs = [];
  if (typeof text === "string") {
    runs.push(new TextRun({
      text,
      font: FONT_BODY,
      size: BODY_SIZE,
      color: opts.color || COLOR_BLACK,
      bold: opts.bold || false,
      italics: opts.italics || false,
    }));
  } else if (Array.isArray(text)) {
    text.forEach(t => runs.push(t));
  }
  return new Paragraph({
    children: runs,
    spacing: { line: LINE_SPACING },
    indent: opts.noIndent ? undefined : { firstLine: FIRST_LINE_INDENT },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    ...opts.extra,
  });
}

function boldBodyPara(text, opts = {}) {
  return bodyPara(text, { ...opts, bold: true });
}

function heading1(text) {
  return new Paragraph({
    children: [new TextRun({
      text,
      font: FONT_HEADING,
      size: H1_SIZE,
      color: COLOR_ACCENT,
      bold: true,
    })],
    spacing: { before: 360, after: 200, line: LINE_SPACING },
    heading: HeadingLevel.HEADING_1,
  });
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({
      text,
      font: FONT_HEADING,
      size: H2_SIZE,
      color: COLOR_DARK,
      bold: true,
    })],
    spacing: { before: 280, after: 160, line: LINE_SPACING },
    heading: HeadingLevel.HEADING_2,
  });
}

function heading3(text) {
  return new Paragraph({
    children: [new TextRun({
      text,
      font: FONT_HEADING,
      size: H3_SIZE,
      color: COLOR_DARK,
      bold: true,
    })],
    spacing: { before: 200, after: 120, line: LINE_SPACING },
    heading: HeadingLevel.HEADING_3,
  });
}

function bulletPara(text, level = 0) {
  const runs = [];
  if (typeof text === "string") {
    runs.push(new TextRun({
      text: `\u2022  ${text}`,
      font: FONT_BODY,
      size: BODY_SIZE,
      color: COLOR_BLACK,
    }));
  } else if (Array.isArray(text)) {
    runs.push(new TextRun({ text: "\u2022  ", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }));
    text.forEach(t => runs.push(t));
  }
  return new Paragraph({
    children: runs,
    spacing: { line: LINE_SPACING },
    indent: { left: 480 + level * 360 },
  });
}

function priorityBullet(text, priority) {
  const colorMap = { P0: COLOR_RED, P1: COLOR_ORANGE, P2: COLOR_GREEN };
  const labelMap = { P0: "CRÍTICO", P1: "IMPORTANTE", P2: "DESEABLE" };
  return bulletPara([
    new TextRun({ text: `[${priority} – ${labelMap[priority]}] `, font: FONT_BODY, size: BODY_SIZE, color: colorMap[priority], bold: true }),
    new TextRun({ text, font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ]);
}

function codePara(text) {
  return new Paragraph({
    children: [new TextRun({
      text,
      font: FONT_MONO,
      size: 20,
      color: COLOR_DARK,
    })],
    spacing: { line: 276 },
    indent: { left: 480 },
    shading: { type: ShadingType.SOLID, color: COLOR_LIGHT },
  });
}

function emptyLine() {
  return new Paragraph({ children: [], spacing: { line: LINE_SPACING } });
}

function makeTable(headers, rows) {
  const headerCells = headers.map(h => new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: h, font: FONT_HEADING, size: 20, color: COLOR_WHITE, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { line: 276 },
    })],
    shading: { type: ShadingType.SOLID, color: COLOR_ACCENT },
    width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
  }));

  const dataRows = rows.map((row, rowIdx) => new TableRow({
    children: row.map((cell, colIdx) => {
      const cellContent = typeof cell === "string"
        ? [new Paragraph({
            children: [new TextRun({ text: cell, font: FONT_BODY, size: 20, color: COLOR_BLACK })],
            spacing: { line: 276 },
          })]
        : cell; // array of Paragraphs
      return new TableCell({
        children: cellContent,
        shading: rowIdx % 2 === 0
          ? { type: ShadingType.SOLID, color: COLOR_LIGHT }
          : { type: ShadingType.SOLID, color: COLOR_WHITE },
        width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
      });
    }),
  }));

  return new Table({
    rows: [new TableRow({ children: headerCells }), ...dataRows],
    width: { size: 9000, type: WidthType.DXA },
  });
}

function statusCell(text, color) {
  return [new Paragraph({
    children: [new TextRun({ text, font: FONT_BODY, size: 20, color, bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { line: 276 },
  })];
}

// ─── Build Document ────────────────────────────────────────

function buildDocument() {
  const children = [];

  // ═══════ COVER PAGE ═══════
  children.push(emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine());

  children.push(new Paragraph({
    children: [new TextRun({
      text: "AGENTE-KREA V1",
      font: FONT_HEADING,
      size: 56,
      color: COLOR_ACCENT,
      bold: true,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
  }));

  children.push(new Paragraph({
    children: [new TextRun({
      text: "—",
      font: FONT_HEADING,
      size: 40,
      color: COLOR_ACCENT,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
  }));

  children.push(new Paragraph({
    children: [new TextRun({
      text: "Auditoría de Emparejamiento con",
      font: FONT_HEADING,
      size: 36,
      color: COLOR_DARK,
      bold: true,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
  }));

  children.push(new Paragraph({
    children: [new TextRun({
      text: "Arquitectura Universal ALBRA",
      font: FONT_HEADING,
      size: 36,
      color: COLOR_DARK,
      bold: true,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  children.push(new Paragraph({
    children: [new TextRun({
      text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      font: FONT_BODY,
      size: 20,
      color: COLOR_ACCENT,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  const coverMeta = [
    ["Versión del Documento:", "1.0"],
    ["Fecha:", new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })],
    ["Agente Auditado:", "AGENTE-KREA v1.0.0"],
    ["Propietario:", "ALBRA"],
    ["Clasificación:", "Confidencial — Uso Interno"],
    ["Arquitectura de Referencia:", "ALBRA Universal Architecture"],
    ["Total de Fases:", "26"],
  ];

  coverMeta.forEach(([label, value]) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: label + "  ", font: FONT_BODY, size: 22, color: COLOR_GRAY, bold: true }),
        new TextRun({ text: value, font: FONT_BODY, size: 22, color: COLOR_DARK }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { line: 320 },
    }));
  });

  children.push(emptyLine(), emptyLine(), emptyLine());

  children.push(new Paragraph({
    children: [new TextRun({
      text: "Este documento constituye la auditoría completa de alineamiento arquitectónico del agente AGENTE-KREA "
          + "contra la Arquitectura Universal ALBRA, cubriendo las 26 fases de evaluación, clasificación y plan de acción.",
      font: FONT_BODY,
      size: BODY_SIZE,
      color: COLOR_GRAY,
      italics: true,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { line: LINE_SPACING },
  }));

  // ═══════ PAGE BREAK + TABLE OF CONTENTS ═══════
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(heading1("Índice de Contenidos"));
  children.push(bodyPara(
    "A continuación se enumeran las 26 fases de la auditoría de emparejamiento con la Arquitectura Universal ALBRA. "
    + "Cada fase representa un dominio de evaluación independiente que contribuye al puntaje global de alineamiento.",
    { noIndent: true }
  ));
  children.push(emptyLine());

  const tocPhases = [
    "Fase 1  — Identidad del Agente",
    "Fase 2  — Misión del Agente",
    "Fase 3  — Arquitectura Actual",
    "Fase 4  — Capacidades Clasificadas",
    "Fase 5  — Dominio Canónico",
    "Fase 6  — Contrato de Identidad",
    "Fase 7  — Arquitectura de Proveedores",
    "Fase 8  — Contratos Agente-a-Agente",
    "Fase 9  — Categorías de Memoria",
    "Fase 10 — Matriz de Clasificación Universal",
    "Fase 11 — Evaluación de Seguridad",
    "Fase 12 — Sistema de Evidencia y Verdad",
    "Fase 13 — Observabilidad",
    "Fase 14 — Módulo Doctor",
    "Fase 15 — Trazas de Ejecución",
    "Fase 16 — Sistema de Créditos",
    "Fase 17 — Autenticación y Autorización",
    "Fase 18 — Interfaz de Herramientas (Tools)",
    "Fase 19 — Definición de Skills",
    "Fase 20 — MemoriaDV (Bóveda de Memoria)",
    "Fase 21 — Protocolo MCP",
    "Fase 22 — Sistema de Eventos",
    "Fase 23 — Niveles de Autonomía",
    "Fase 24 — Sistema de Políticas y Permisos",
    "Fase 25 — Bucle de Retroalimentación y Aprendizaje",
    "Fase 26 — Plan de Implementación P0",
  ];

  tocPhases.forEach(p => {
    children.push(bodyPara(p, { noIndent: true, extra: { spacing: { line: 300 } } }));
  });

  // ═══════════════════════════════════════════════
  // FASE 1 — Identidad del Agente
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 1 — Identidad del Agente"));

  children.push(heading2("1.1 Estado Actual"));
  children.push(bodyPara(
    "AGENTE-KREA posee una identidad parcial codificada de forma implícita en el código fuente. "
    + "El nombre del agente aparece en la interfaz de usuario y en el branding visual (logo, títulos), "
    + "pero no existe un archivo de contrato de identidad formal (agent.identity.json) que defina "
    + "de manera explícita y machine-readable los atributos canónicos del agente."
  ));

  children.push(heading2("1.2 Atributos Identificados"));
  children.push(bulletPara("Nombre visible: AGENTE-KREA / KREA"));
  children.push(bulletPara("Versión de código: 0.2.0 (package.json)"));
  children.push(bulletPara("Versión semántica esperada: 1.0.0"));
  children.push(bulletPara("Propietario: ALBRA (implícito)"));
  children.push(bulletPara("Estado: Activo (en producción)"));
  children.push(bulletPara("ID de agente: No definido formalmente"));

  children.push(heading2("1.3 Brechas Detectadas"));
  children.push(priorityBullet("No existe archivo agent.identity.json con contrato formal", "P0"));
  children.push(priorityBullet("AGENT_ID canónico no definido (recomendado: \"krea\")", "P0"));
  children.push(priorityBullet("Versión semántica inconsistente entre package.json (0.2.0) y la esperada (1.0.0)", "P1"));
  children.push(priorityBullet("Dominio canónico no declarado formalmente", "P0"));

  children.push(heading2("1.4 Contrato Objetivo"));
  children.push(codePara("AGENT_ID: \"krea\""));
  children.push(codePara("NAME: \"AGENTE-KREA\""));
  children.push(codePara("VERSION: \"1.0.0\""));
  children.push(codePara("DOMAIN: \"visual_creative_production\""));
  children.push(codePara("OWNER: \"ALBRA\""));
  children.push(codePara("STATUS: \"active\""));

  children.push(heading2("1.5 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "La identidad del agente es parcial e implícita. Se requiere la creación del contrato formal de identidad "
      + "como prerequisito para la integración con la arquitectura universal ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 2 — Misión del Agente
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 2 — Misión del Agente"));

  children.push(heading2("2.1 Estado Actual"));
  children.push(bodyPara(
    "La misión de KREA está implícita en la funcionalidad del sistema: generar activos visuales y creativos "
    + "mediante IA. Sin embargo, no existe un archivo de contrato de misión (agent.mission.json) que declare "
    + "formalmente la misión, el propósito, los objetivos y los límites del agente de manera explícita."
  ));

  children.push(heading2("2.2 Misión Inferida"));
  children.push(bodyPara(
    "\"Producir activos visuales y creativos utilizando generación por IA, incluyendo imágenes, prompts, "
    + "copywriting, voz, eBooks y métricas de campaña.\"", { italics: true }
  ));

  children.push(heading2("2.3 Dominio Declarado"));
  children.push(bulletPara("visual_generation — Imágenes y prompts para IA visual"));
  children.push(bulletPara("creative_production — Copy, eBooks, scripts, voz"));
  children.push(bulletPara("asset_production — Archivos generados: PNG, MP3, Markdown"));
  children.push(bulletPara("campaign_metrics — ROAS, seguimiento de revenue para campañas creativas"));

  children.push(heading2("2.4 Fuera de Alcance (OUT_OF_SCOPE)"));
  children.push(bulletPara("CRM, trading, procurement, prospecting"));
  children.push(bulletPara("Generación de leads, investigación académica"));
  children.push(bulletPara("Edición de video, orquestación de deployment"));

  children.push(heading2("2.5 Brechas Detectadas"));
  children.push(priorityBullet("No existe archivo agent.mission.json", "P0"));
  children.push(priorityBullet("Misión solo implícita en el código y la UI", "P0"));
  children.push(priorityBullet("Límites de alcance no formalizados", "P1"));

  children.push(heading2("2.6 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "La misión existe funcionalmente pero no está formalizada en contrato. La creación de agent.mission.json "
      + "es prioritaria para la operabilidad en la red de agentes ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 3 — Arquitectura Actual
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 3 — Arquitectura Actual"));

  children.push(heading2("3.1 Stack Tecnológico"));
  children.push(makeTable(
    ["Componente", "Tecnología", "Versión"],
    [
      ["Framework", "Next.js", "16.2.10"],
      ["Lenguaje", "TypeScript", "5.x"],
      ["Estilos", "Tailwind CSS v4", "4.x"],
      ["Animaciones", "Framer Motion", "11.x"],
      ["ORM / Base de Datos", "Prisma (SQLite)", "6.x"],
      ["SDK de IA", "ZAI SDK (z-ai-web-dev-sdk)", "0.0.18"],
      ["UI Components", "shadcn/ui", "47 componentes"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("3.2 Estructura de la Aplicación"));
  children.push(bulletPara("13 rutas API (/api/generate/*, /api/auth/*, /api/metrics, /api/generations)"));
  children.push(bulletPara("6 componentes de aplicación (AppShell, PromptChat, MetricsTracker, SettingsPage, SupportPage, AuthPage)"));
  children.push(bulletPara("47 componentes shadcn/ui reutilizables"));
  children.push(bulletPara("3 modelos Prisma: User, Generation, CampaignEntry"));
  children.push(bulletPara("Arquitectura de página única con switching de vista por estado"));

  children.push(heading2("3.3 Patrones Arquitectónicos"));
  children.push(bulletPara("Auto-login con usuario fallback (sin autenticación real)"));
  children.push(bulletPara("Sistema de créditos por generación (2-8 créditos por operación)"));
  children.push(bulletPara("Llamadas directas al SDK ZAI sin capa de abstracción de proveedores"));
  children.push(bulletPara("Escrituras síncronas de archivos (writeFileSync) en manejadores de petición"));

  children.push(heading2("3.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PARCIALMENTE ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_ORANGE, bold: true }),
    new TextRun({ text: "La arquitectura es funcional pero presenta desviaciones significativas respecto a los patrones universales ALBRA: "
      + "falta de abstracción de proveedores, autenticación insegura, y operaciones síncronas bloqueantes.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 4 — Capacidades Clasificadas
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 4 — Capacidades Clasificadas"));

  children.push(heading2("4.1 Inventario de Capacidades"));
  children.push(makeTable(
    ["#", "Capacidad", "Clasificación", "Estado", "Implementación"],
    [
      ["1",  "Generación de Prompts",   "CORE KREA",         "IMPLEMENTADO", "ZAI SDK chat.completions"],
      ["2",  "Generación de Imágenes",  "CORE KREA",         "IMPLEMENTADO", "ZAI SDK images.generations (512x512–1536x1024)"],
      ["3",  "Generación Voz/TTS",      "CORE KREA",         "IMPLEMENTADO", "ZAI SDK audio.tts (4 voces)"],
      ["4",  "Generación Texto/Copy",   "CORE KREA",         "IMPLEMENTADO", "ZAI SDK chat.completions (5 tipos)"],
      ["5",  "Generación eBooks",       "CORE KREA",         "IMPLEMENTADO", "ZAI SDK chat.completions (Markdown)"],
      ["6",  "Generación Subtítulos",   "CORE KREA",         "IMPLEMENTADO", "ZAI SDK chat.completions + page_reader"],
      ["7",  "Métricas 360",            "CORE KREA",         "IMPLEMENTADO", "Prisma SQLite CRUD"],
      ["8",  "Autenticación Usuarios",  "SHARED CONTRACT",   "PARCIAL",      "Contraseñas en texto plano, sin JWT"],
      ["9",  "Sistema de Créditos",     "SHARED CONTRACT",   "IMPLEMENTADO", "Patrón deduct/refund (race condition)"],
      ["10", "Historial Generaciones",  "CORE KREA",         "IMPLEMENTADO", "Prisma queries"],
      ["11", "Landing Page",            "INFRASTRUCTURE",    "IMPLEMENTADO", "—"],
      ["12", "Dashboard",               "DASHBOARD",         "IMPLEMENTADO", "Quick tools + stats + recent"],
      ["13", "Configuración",           "INFRASTRUCTURE",    "PARCIAL",      "Cambio de pass no funciona, prefs no persisten"],
      ["14", "Soporte",                 "INFRASTRUCTURE",    "MOCK",         "Envío simulado, sin API real"],
      ["15", "Error Boundary",          "INFRASTRUCTURE",    "IMPLEMENTADO", "—"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("4.2 Voces TTS Disponibles"));
  children.push(bulletPara("tongtong — Voz neutra, uso general"));
  children.push(bulletPara("xiaoyi — Voz expresiva, narración"));
  children.push(bulletPara("zhiyan — Voz profesional, presentaciones"));
  children.push(bulletPara("zhichu — Voz suave, contenido emocional"));

  children.push(heading2("4.3 Tipos de Copywriting"));
  children.push(bulletPara("copy — Texto publicitario general"));
  children.push(bulletPara("social — Contenido para redes sociales"));
  children.push(bulletPara("email — Copy para email marketing"));
  children.push(bulletPara("script — Guiones para video/audio"));
  children.push(bulletPara("subtitle — Subtítulos para contenido audiovisual"));

  children.push(heading2("4.4 Brechas"));
  children.push(priorityBullet("Capacidades sin contrato formal (formato ALBRA capability contract)", "P0"));
  children.push(priorityBullet("Clasificación implícita, no declarada en archivos de configuración", "P1"));
  children.push(priorityBullet("Capacidades MOCK y PARCIAL sin roadmap de completitud", "P1"));

  children.push(heading2("4.5 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PARCIALMENTE ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_ORANGE, bold: true }),
    new TextRun({ text: "7 capacidades core implementadas y funcionales, pero sin contratos formales de capacidad "
      + "y con 2 capacidades en estado PARCIAL y 1 MOCK.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 5 — Dominio Canónico
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 5 — Dominio Canónico"));

  children.push(heading2("5.1 Definición del Dominio"));
  children.push(bodyPara(
    "KREA es un agente de PRODUCCIÓN VISUAL/CREATIVA. Su dominio canónico se define como "
    + "\"visual_creative_production\", abarcando la generación de activos visuales, creativos y de métricas "
    + "de campaña mediante inteligencia artificial."
  ));

  children.push(heading2("5.2 Sub-dominios Operativos"));
  children.push(makeTable(
    ["Sub-dominio", "Descripción", "Capacidades Asociadas"],
    [
      ["visual_generation", "Imágenes y prompts para IA visual", "Prompt Gen, Image Gen"],
      ["creative_production", "Copy, eBooks, scripts, voz", "Text Gen, eBook Gen, Voice/TTS Gen, Subtitle Gen"],
      ["asset_production", "Archivos generados: PNG, MP3, Markdown", "Todas las generaciones core"],
      ["campaign_metrics", "ROAS, revenue, tracking de campañas", "360 Metrics, CampaignEntry model"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("5.3 Límites del Dominio (OUT_OF_SCOPE)"));
  children.push(bulletPara("CRM y gestión de relaciones con clientes"));
  children.push(bulletPara("Trading y operaciones financieras"));
  children.push(bulletPara("Procurement y adquisiciones"));
  children.push(bulletPara("Prospecting y generación de leads"));
  children.push(bulletPara("Investigación académica"));
  children.push(bulletPara("Edición de video (post-producción audiovisual)"));
  children.push(bulletPara("Orquestación de deployment e infraestructura"));

  children.push(heading2("5.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PARCIALMENTE ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_ORANGE, bold: true }),
    new TextRun({ text: "El dominio está claro funcionalmente, pero no está formalizado en un contrato de dominio canónico. "
      + "Los límites OUT_OF_SCOPE no están declarados en formato machine-readable.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 6 — Contrato de Identidad
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 6 — Contrato de Identidad"));

  children.push(heading2("6.1 Especificación del Contrato"));
  children.push(bodyPara(
    "El contrato de identidad ALBRA requiere un archivo agent.identity.json que defina todos los atributos "
    + "canónicos del agente de manera explícita, versionada y machine-readable."
  ));

  children.push(heading2("6.2 Contrato Objetivo (a implementar)"));
  children.push(codePara("{"));
  children.push(codePara("  AGENT_ID: \"krea\","));
  children.push(codePara("  NAME: \"AGENTE-KREA\","));
  children.push(codePara("  VERSION: \"1.0.0\","));
  children.push(codePara("  DOMAIN: \"visual_creative_production\","));
  children.push(codePara("  MISSION: \"Produce visual and creative assets using AI generation,\""));
  children.push(codePara("           \"including images, prompts, copy, voice, ebooks,\""));
  children.push(codePara("           \"and campaign metrics\","));
  children.push(codePara("  OWNER: \"ALBRA\","));
  children.push(codePara("  STATUS: \"active\""));
  children.push(codePara("}"));

  children.push(heading2("6.3 Estado de Implementación"));
  children.push(priorityBullet("Archivo agent.identity.json no existe", "P0"));
  children.push(priorityBullet("Atributos de identidad dispersos en código fuente", "P0"));
  children.push(priorityBullet("No hay validación de contrato en CI/CD", "P1"));

  children.push(heading2("6.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "El contrato de identidad no existe. Es prerequisito P0 para la integración ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 7 — Arquitectura de Proveedores
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 7 — Arquitectura de Proveedores"));

  children.push(heading2("7.1 Estado Actual"));
  children.push(bodyPara(
    "KREA utiliza llamadas directas al SDK de ZAI (z-ai-web-dev-sdk v0.0.18) sin capa de abstracción. "
    + "Cada ruta API invoca directamente los métodos del SDK, creando un acoplamiento fuerte que impide "
    + "el cambio de proveedor, fallback automático y medición de calidad/coste."
  ));

  children.push(heading2("7.2 Flujo Actual"));
  children.push(codePara("Route Handler → ZAI SDK (directo)"));
  children.push(codePara("Ejemplo: /api/generate/image → sdk.images.generations(...)"));

  children.push(heading2("7.3 Flujo Objetivo"));
  children.push(codePara("Route → ProviderInterface → Adapter → Provider (ZAI/alternativa)"));
  children.push(bodyPara(
    "La capa de abstracción ProviderInterface permite: cambio de proveedor sin modificar rutas, "
    + "fallback automático en caso de error, medición de calidad por proveedor, y tracking de costes.",
    { noIndent: true }
  ));

  children.push(heading2("7.4 Proveedor Primario"));
  children.push(makeTable(
    ["Atributo", "Valor"],
    [
      ["Proveedor", "ZAI SDK (z-ai-web-dev-sdk)"],
      ["Versión", "v0.0.18"],
      ["Rol", "PRIMARIO (único)"],
      ["Servicios", "LLM (chat.completions), TTS (audio.tts), Images (images.generations)"],
      ["Fallback", "Ninguno"],
      ["Abstracción", "Ninguna (acoplamiento directo)"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("7.5 Brechas"));
  children.push(priorityBullet("No existe capa de abstracción de proveedores (ProviderInterface)", "P0"));
  children.push(priorityBullet("No hay proveedor de fallback — si ZAI falla, la generación falla", "P0"));
  children.push(priorityBullet("No hay tracking de costes por proveedor", "P1"));
  children.push(priorityBullet("No hay medición de calidad comparativa entre proveedores", "P2"));

  children.push(heading2("7.6 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Arquitectura de proveedores inexistente. Acoplamiento directo al SDK ZAI sin posibilidad de fallback, "
      + "intercambio o medición.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 8 — Contratos Agente-a-Agente
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 8 — Contratos Agente-a-Agente"));

  children.push(heading2("8.1 Contratos Identificados"));
  children.push(makeTable(
    ["Origen", "Destino", "Tipo de Contrato", "Estado"],
    [
      ["NEX-SCOPE", "KREA", "Research/concept/reference → KREA genera activos visuales", "No implementado"],
      ["CREATIVE-ENGINE", "KREA", "Creative spec → KREA produce activos", "No implementado"],
      ["KREA", "YOUTUBE-AUTOMATION", "Assets/prompts/instructions → Producción audiovisual", "No implementado"],
      ["CHISMOSO", "KREA", "Señales de tendencia visual (opcional)", "No implementado"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("8.2 Formato de Contrato Requerido"));
  children.push(bodyPara(
    "Cada contrato A2A debe definir: el protocolo de comunicación (HTTP/WebSocket/MCP), el esquema "
    + "de mensaje (request/response), los requisitos de autenticación, los timeouts y reintentos, "
    + "y el manejo de errores.",
    { noIndent: true }
  ));

  children.push(heading2("8.3 Brechas"));
  children.push(priorityBullet("Ningún contrato A2A está implementado", "P1"));
  children.push(priorityBullet("KREA opera como agente aislado sin comunicación inter-agente", "P1"));
  children.push(priorityBullet("No hay definición de esquemas de mensaje para contratos A2A", "P1"));

  children.push(heading2("8.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "KREA opera en aislamiento total. Los contratos A2A son necesarios para la operabilidad "
      + "en la red de agentes ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 9 — Categorías de Memoria
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 9 — Categorías de Memoria"));

  children.push(heading2("9.1 Modelo de Memoria ALBRA"));
  children.push(bodyPara(
    "La arquitectura ALBRA define cuatro categorías de memoria para cada agente, mapeando los tipos "
    + "de información que el agente debe almacenar, recuperar y utilizar para mejorar su operación."
  ));

  children.push(heading2("9.2 Categorías Definidas para KREA"));
  children.push(makeTable(
    ["Categoría", "Contenido KREA", "Implementación Actual"],
    [
      ["Episódica", "Historial de generaciones, sesiones de proyecto", "Prisma Generation model (parcial)"],
      ["Semántica", "Patrones de prompts, preferencias de estilo, capacidades de proveedor", "No implementado"],
      ["Factual", "Costes de proveedor, specs de modelos, límites de generación", "Hardcodeado en código fuente"],
      ["Procedural", "Workflows de generación, reglas de optimización, recuperación de errores", "Implícito en lógica de rutas API"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("9.3 Brechas"));
  children.push(priorityBullet("Memoria episódica parcial (solo historial, sin sesiones)", "P1"));
  children.push(priorityBullet("Memoria semántica no implementada (patrones y preferencias)", "P1"));
  children.push(priorityBullet("Memoria factual hardcodeada en vez de persistida", "P1"));
  children.push(priorityBullet("Memoria procedural implícita, no declarada como reglas", "P1"));

  children.push(heading2("9.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Solo la memoria episódica tiene implementación parcial. Las categorías semántica, factual y procedural "
      + "carecen de implementación o están hardcodeadas.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 10 — Matriz de Clasificación Universal
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 10 — Matriz de Clasificación Universal"));

  children.push(heading2("10.1 Matriz Completa de Clasificación"));
  children.push(bodyPara(
    "La siguiente matriz evalúa cada componente de KREA contra los tres ejes de la arquitectura universal: "
    + "Universal (estándar ALBRA), KREA-specific (particular del agente), y Missing (ausente).",
    { noIndent: true }
  ));
  children.push(emptyLine());

  const matrixData = [
    ["Runtime",        "Next.js 16",    "✅", "—",   "—",   "OK"],
    ["Identity",       "Partial",       "❌", "—",   "—",   "Full contract", "P0"],
    ["Mission",        "Implicit",      "❌", "—",   "—",   "Explicit contract", "P0"],
    ["Capabilities",   "7 core working","Partial", "✅", "—", "Contract format", "P0"],
    ["Tools",          "ZAI SDK direct","❌", "—",   "—",   "Tool contracts", "P0"],
    ["Skills",         "Implicit",      "❌", "✅",   "—",   "Skill definitions", "P1"],
    ["MemoryDV",       "Prisma only",   "❌", "✅",   "—",   "Memory contract", "P1"],
    ["Evidence",       "None",          "❌", "—",   "—",   "Evidence system", "P0"],
    ["Truth",          "None",          "❌", "—",   "—",   "Truth levels", "P0"],
    ["Providers",      "Direct ZAI",    "❌", "—",   "—",   "Provider abstraction", "P0"],
    ["MCP",            "Absent",        "❌", "—",   "—",   "MCP interface", "P1"],
    ["Agent-to-Agent", "Absent",        "❌", "—",   "—",   "A2A contracts", "P1"],
    ["Events",         "Absent",        "❌", "—",   "—",   "Event contract", "P1"],
    ["Execution Trace","Partial",       "❌", "✅",   "—",   "Full trace", "P0"],
    ["Policy",         "None",          "❌", "—",   "—",   "Permission system", "P0"],
    ["Autonomy",       "L3 implicit",   "❌", "✅",   "—",   "Explicit levels", "P1"],
    ["Doctor",         "Absent",        "❌", "—",   "—",   "Doctor module", "P0"],
    ["Observability",  "None",          "❌", "—",   "—",   "Logging/metrics", "P0"],
    ["Dashboard",      "Working",       "Partial", "✅", "—", "Enhance with health", "P1"],
    ["Security",       "CRITICAL",      "❌", "—",   "—",   "Fix all P0 vulns", "P0"],
    ["Feedback",       "None",          "❌", "—",   "—",   "Feedback loop", "P1"],
    ["Learning",       "None",          "❌", "—",   "—",   "MemoryDV integration", "P2"],
    ["Testing",        "None",          "❌", "—",   "—",   "Unit+integration+E2E", "P0"],
    ["E2E",            "None",          "❌", "—",   "—",   "Real flow tests", "P0"],
    ["Clean-room",     "Not verified",  "❌", "—",   "—",   "Independent validation", "P0"],
  ];

  children.push(makeTable(
    ["Componente", "Actual", "Universal", "KREA", "Missing", "Acción"],
    matrixData.map(row => row.slice(0, 6))
  ));
  children.push(emptyLine());

  children.push(heading2("10.2 Resumen Estadístico"));
  const totalComponents = matrixData.length;
  const p0Count = matrixData.filter(r => r[6] === "P0").length;
  const p1Count = matrixData.filter(r => r[6] === "P1").length;
  const p2Count = matrixData.filter(r => r[6] === "P2").length;
  const okCount = matrixData.filter(r => r[5] === "OK").length;

  children.push(bulletPara(`Total de componentes evaluados: ${totalComponents}`));
  children.push(bulletPara(`Componentes OK: ${okCount} (${Math.round(okCount/totalComponents*100)}%)`));
  children.push(bulletPara(`Acciones P0 (críticas): ${p0Count}`));
  children.push(bulletPara(`Acciones P1 (importantes): ${p1Count}`));
  children.push(bulletPara(`Acciones P2 (deseables): ${p2Count}`));

  children.push(heading2("10.3 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: `Solo ${okCount} de ${totalComponents} componentes está alineado. ${p0Count} acciones P0 requeridas. `
      + `Nivel de alineamiento: ${Math.round(okCount/totalComponents*100)}%.`, font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 11 — Evaluación de Seguridad
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 11 — Evaluación de Seguridad"));

  children.push(heading2("11.1 Vulnerabilidades Críticas"));
  children.push(makeTable(
    ["Severidad", "Vulnerabilidad", "Impacto", "Acción Requerida"],
    [
      [statusCell("CRÍTICO", COLOR_RED), "Contraseñas en texto plano (sin hashing)", "Compromiso total de cuentas", "Implementar bcrypt"],
      [statusCell("CRÍTICO", COLOR_RED), "Token = user.id (sin JWT, sin expiración)", "Suplantación de identidad trivial", "Implementar JWT con expiración"],
      [statusCell("CRÍTICO", COLOR_RED), "Sin autenticación en rutas de métricas (GET/POST/DELETE)", "Acceso no autorizado a datos de campaña", "Añadir middleware de auth"],
      [statusCell("ALTO", COLOR_ORANGE), "Race condition en créditos (read-then-write, sin transacción)", "Doble gasto de créditos", "Usar Prisma transactions"],
      [statusCell("ALTO", COLOR_ORANGE), "Escrituras síncronas en manejadores de petición (writeFileSync)", "Bloqueo del event loop", "Migrar a async/await + writeFile"],
      [statusCell("MEDIO", COLOR_ORANGE), "Sin rate limiting", "Abuso de API y agotamiento de créditos", "Implementar rate limiter middleware"],
      [statusCell("MEDIO", COLOR_ORANGE), "Sin configuración CORS", "Posibles ataques cross-origin", "Configurar CORS restrictivo"],
      [statusCell("MEDIO", COLOR_ORANGE), "Archivos generados en public/ sin limpieza", "Acumulación de archivos, fuga de datos", "Implementar limpieza periódica"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("11.2 Detalle de Vulnerabilidades"));

  children.push(heading3("11.2.1 Contraseñas en Texto Plano"));
  children.push(bodyPara(
    "Las contraseñas de usuario se almacenan y comparan en texto plano sin ningún tipo de hashing. "
    + "Esto permite que cualquier persona con acceso a la base de datos SQLite pueda leer todas las contraseñas. "
    + "Solución: implementar bcrypt con salt rounds ≥ 12."
  ));

  children.push(heading3("11.2.2 Token de Autenticación Inseguro"));
  children.push(bodyPara(
    "El token de autenticación actual es simplemente el user.id, sin firma, sin expiración y sin estructura JWT. "
    + "Cualquier actor que conozca un ID de usuario puede suplantar su identidad. "
    + "Solución: implementar JWT con secreto fuerte, expiración (24h), y claims mínimos."
  ));

  children.push(heading3("11.2.3 Rutas de Métricas Sin Protección"));
  children.push(bodyPara(
    "Los endpoints /api/metrics (GET, POST, DELETE) no requieren autenticación. "
    + "Cualquier request puede leer, modificar o eliminar datos de métricas de campaña. "
    + "Solución: añadir middleware de autenticación a todas las rutas de métricas."
  ));

  children.push(heading3("11.2.4 Race Condition en Créditos"));
  children.push(bodyPara(
    "El sistema de créditos utiliza un patrón read-then-write sin transacciones atómicas. "
    + "Dos requests concurrentes pueden leer el mismo balance, deducir créditos, y escribir, "
    + "resultando en un doble gasto. Solución: usar Prisma interactive transactions."
  ));

  children.push(heading2("11.3 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — CRÍTICO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "3 vulnerabilidades críticas, 2 altas y 3 medias. La seguridad es el área de mayor urgencia "
      + "en todo el audit. Requiere remediación inmediata antes de cualquier integración ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 12 — Sistema de Evidencia y Verdad
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 12 — Sistema de Evidencia y Verdad"));

  children.push(heading2("12.1 Estado Actual"));
  children.push(bodyPara(
    "KREA no posee un sistema de evidencia ni niveles de verdad. Las generaciones se almacenan "
    + "en el modelo Prisma Generation con metadata básica, pero sin indicadores de confianza, "
    + "verificabilidad o calidad del resultado."
  ));

  children.push(heading2("12.2 Requisitos ALBRA"));
  children.push(bulletPara("Cada generación debe incluir nivel de evidencia (confirmed/inferred/assumed/rejected)"));
  children.push(bulletPara("Cada generación debe incluir nivel de verdad (verified/unverified/conflicting/unknown)"));
  children.push(bulletPara("El sistema debe permitir la verificación posterior de resultados"));
  children.push(bulletPara("Los niveles deben propagarse en cadenas de dependencia"));

  children.push(heading2("12.3 Brechas"));
  children.push(priorityBullet("No existe sistema de evidencia", "P0"));
  children.push(priorityBullet("No existen niveles de verdad", "P0"));
  children.push(priorityBullet("No hay metadata de confianza en resultados de generación", "P0"));

  children.push(heading2("12.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Sistema de evidencia y verdad completamente ausente. Es prerequisito para la "
      + "confiabilidad de resultados en la red ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 13 — Observabilidad
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 13 — Observabilidad"));

  children.push(heading2("13.1 Estado Actual"));
  children.push(bodyPara(
    "KREA carece de cualquier forma de observabilidad estructurada. No hay logging estructurado, "
    + "no hay métricas de rendimiento, no hay tracing distribuido, y no hay dashboards de salud. "
    + "Los errores se capturan parcialmente mediante el Error Boundary de React, pero sin persistencia ni análisis."
  ));

  children.push(heading2("13.2 Requisitos Mínimos"));
  children.push(bulletPara("Logging estructurado (JSON) con niveles (debug/info/warn/error)"));
  children.push(bulletPara("Métricas de rendimiento por ruta API (latencia, throughput, errores)"));
  children.push(bulletPara("Tracing de generaciones (tiempo total, tiempo por proveedor, tokens usados)"));
  children.push(bulletPara("Health check endpoint (/health) para orquestación"));

  children.push(heading2("13.3 Brechas"));
  children.push(priorityBullet("No existe logging estructurado", "P0"));
  children.push(priorityBullet("No hay métricas de rendimiento", "P0"));
  children.push(priorityBullet("No hay tracing de generaciones", "P0"));
  children.push(priorityBullet("No hay endpoint de health check", "P0"));

  children.push(heading2("13.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Observabilidad completamente ausente. Sin visibilidad del estado operativo del agente.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 14 — Módulo Doctor
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 14 — Módulo Doctor"));

  children.push(heading2("14.1 Definición ALBRA"));
  children.push(bodyPara(
    "El módulo Doctor es un componente de autodiagnóstico que permite al agente verificar su propio estado "
    + "de salud, detectar degradaciones, y reportar su condición a la red de agentes y al orquestador."
  ));

  children.push(heading2("14.2 Checks Requeridos"));
  children.push(bulletPara("Conectividad con proveedor ZAI SDK"));
  children.push(bulletPara("Estado de base de datos (Prisma/SQLite)"));
  children.push(bulletPara("Espacio en disco para archivos generados"));
  children.push(bulletPara("Validez de configuración de identidad y misión"));
  children.push(bulletPara("Estado de contratos A2A"));
  children.push(bulletPara("Integridad del sistema de créditos"));

  children.push(heading2("14.3 Estado Actual"));
  children.push(bodyPara("El módulo Doctor no existe. No hay ningún mecanismo de autodiagnóstico implementado."));

  children.push(heading2("14.4 Brechas"));
  children.push(priorityBullet("Módulo Doctor completamente ausente", "P0"));
  children.push(priorityBullet("No hay endpoint /health ni /doctor", "P0"));
  children.push(priorityBullet("No hay checks de conectividad con proveedores", "P0"));

  children.push(heading2("14.5 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "El módulo Doctor es esencial para la operación autónoma y la integración en la red ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 15 — Trazas de Ejecución
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 15 — Trazas de Ejecución"));

  children.push(heading2("15.1 Estado Actual"));
  children.push(bodyPara(
    "El modelo Prisma Generation almacena metadata básica de cada generación (tipo, prompt, resultado, "
    + "timestamp), pero no constituye una traza de ejecución completa. Faltan: timing por etapa, "
    + "tokens consumidos, errores intermedios, decisiones de routing, y contexto de la petición."
  ));

  children.push(heading2("15.2 Traza Objetivo"));
  children.push(bodyPara(
    "Cada generación debe producir una traza completa con: request_id, timestamps de inicio/fin por etapa, "
    + "proveedor utilizado, tokens consumidos (input/output), resultado, errores, nivel de evidencia, "
    + "y contexto completo de la petición."
  ));

  children.push(heading2("15.3 Brechas"));
  children.push(priorityBullet("Traza parcial (solo modelo Generation, sin etapas)", "P0"));
  children.push(priorityBullet("No hay timing por etapa de generación", "P0"));
  children.push(priorityBullet("No hay tracking de tokens consumidos", "P0"));
  children.push(priorityBullet("No hay request_id correlacionable", "P1"));

  children.push(heading2("15.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Trazas de ejecución insuficientes para observabilidad y debugging en producción.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 16 — Sistema de Créditos
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 16 — Sistema de Créditos"));

  children.push(heading2("16.1 Estado Actual"));
  children.push(bodyPara(
    "El sistema de créditos está implementado con un patrón deduct/refund. Cada generación consume "
    + "entre 2 y 8 créditos según el tipo. Si la generación falla, los créditos se reembolsan. "
    + "Sin embargo, el patrón read-then-write sin transacciones atómicas presenta una race condition."
  ));

  children.push(heading2("16.2 Coste por Tipo de Generación"));
  children.push(makeTable(
    ["Tipo de Generación", "Créditos", "Rango de Resolución"],
    [
      ["Prompt", "2", "—"],
      ["Imagen", "5", "512x512 – 1536x1024"],
      ["Voz/TTS", "3", "4 voces disponibles"],
      ["Texto/Copy", "2", "5 tipos de copy"],
      ["eBook", "4", "Markdown output"],
      ["Subtítulos", "2", "Con page_reader"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("16.3 Problema: Race Condition"));
  children.push(bodyPara(
    "El flujo actual es: 1) Leer balance actual → 2) Verificar si balance ≥ coste → "
    + "3) Deducir créditos → 4) Escribir nuevo balance. Entre pasos 1 y 4, otro request concurrente "
    + "puede leer el mismo balance original, resultando en doble gasto. Solución: usar "
    + "Prisma interactive transactions con $transaction([])."
  ));

  children.push(heading2("16.4 Brechas"));
  children.push(priorityBullet("Race condition en deduct/refund (sin transacción atómica)", "P0"));
  children.push(priorityBullet("No hay auditoría de transacciones de créditos", "P1"));
  children.push(priorityBullet("No hay límite de crédito mínimo configurable", "P2"));

  children.push(heading2("16.5 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PARCIALMENTE ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_ORANGE, bold: true }),
    new TextRun({ text: "El sistema funciona pero con una race condition crítica que puede causar doble gasto de créditos.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 17 — Autenticación y Autorización
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 17 — Autenticación y Autorización"));

  children.push(heading2("17.1 Estado Actual"));
  children.push(bodyPara(
    "El sistema de autenticación es mínimamente funcional: soporta registro, login y auto-login con "
    + "usuario fallback. Sin embargo, presenta vulnerabilidades críticas que lo hacen inseguro para producción."
  ));

  children.push(heading2("17.2 Problemas Identificados"));
  children.push(makeTable(
    ["Problema", "Severidad", "Detalle"],
    [
      ["Contraseñas en texto plano", "CRÍTICO", "No se usa bcrypt ni ningún hashing. Las contraseñas se comparan directamente."],
      ["Token = user.id", "CRÍTICO", "El token de sesión es simplemente el ID del usuario, sin firma ni expiración."],
      ["Sin JWT", "CRÍTICO", "No se emiten JSON Web Tokens. No hay verificación de firma."],
      ["Auto-login inseguro", "ALTO", "El auto-login crea/accede a un usuario fallback sin credenciales."],
      ["Sin middleware de auth", "ALTO", "Las rutas de métricas no verifican autenticación."],
      ["Cambio de pass roto", "MEDIO", "La funcionalidad de cambio de contraseña en Settings no funciona."],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("17.3 Plan de Remediación"));
  children.push(priorityBullet("Implementar bcrypt para hashing de contraseñas (salt rounds ≥ 12)", "P0"));
  children.push(priorityBullet("Implementar JWT con secreto fuerte, expiración 24h, y claims mínimos", "P0"));
  children.push(priorityBullet("Añadir middleware de autenticación a TODAS las rutas API protegidas", "P0"));
  children.push(priorityBullet("Revisar y corregir el flujo de auto-login", "P1"));
  children.push(priorityBullet("Corregir la funcionalidad de cambio de contraseña", "P1"));

  children.push(heading2("17.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — CRÍTICO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "El sistema de autenticación es funcionalmente inseguro. Remediación P0 obligatoria.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 18 — Interfaz de Herramientas (Tools)
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 18 — Interfaz de Herramientas (Tools)"));

  children.push(heading2("18.1 Estado Actual"));
  children.push(bodyPara(
    "KREA utiliza el ZAI SDK directamente como su única herramienta, sin una interfaz de contrato de herramientas "
    + "(Tool Contract) que defina las herramientas disponibles, sus parámetros, restricciones y permisos."
  ));

  children.push(heading2("18.2 Herramientas Identificadas (Implícitas)"));
  children.push(makeTable(
    ["Herramienta", "Método SDK", "Parámetros", "Restricciones"],
    [
      ["generate_prompt", "chat.completions", "prompt, style, context", "2 créditos"],
      ["generate_image", "images.generations", "prompt, size", "5 créditos, 512x512–1536x1024"],
      ["generate_voice", "audio.tts", "text, voice", "3 créditos, 4 voces"],
      ["generate_copy", "chat.completions", "prompt, type", "2 créditos, 5 tipos"],
      ["generate_ebook", "chat.completions", "topic, chapters", "4 créditos"],
      ["generate_subtitle", "chat.completions", "video_url, lang", "2 créditos"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("18.3 Brechas"));
  children.push(priorityBullet("No existen contratos formales de herramienta (Tool Contract)", "P0"));
  children.push(priorityBullet("Parámetros y restricciones hardcodeados en rutas API", "P0"));
  children.push(priorityBullet("No hay registro/descubrimiento de herramientas", "P1"));

  children.push(heading2("18.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Las herramientas existen funcionalmente pero sin contratos formales ni interfaz estandarizada.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 19 — Definición de Skills
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 19 — Definición de Skills"));

  children.push(heading2("19.1 Estado Actual"));
  children.push(bodyPara(
    "Las skills de KREA están implícitas en el código de las rutas API y los componentes de UI. "
    + "No existen archivos de definición de skill (skill.json) que declaren las skills disponibles, "
    + "sus prerrequisitos, sus flujos de ejecución y sus dependencias."
  ));

  children.push(heading2("19.2 Skills Inferidas"));
  children.push(bulletPara("skill:prompt_generation — Generación de prompts para IA visual"));
  children.push(bulletPara("skill:image_generation — Generación de imágenes con resolución variable"));
  children.push(bulletPara("skill:voice_generation — Síntesis de voz con selección de voces"));
  children.push(bulletPara("skill:copy_generation — Copywriting multi-tipo"));
  children.push(bulletPara("skill:ebook_generation — Generación de eBooks en Markdown"));
  children.push(bulletPara("skill:subtitle_generation — Generación de subtítulos"));
  children.push(bulletPara("skill:campaign_tracking — Seguimiento de métricas de campaña 360"));

  children.push(heading2("19.3 Brechas"));
  children.push(priorityBullet("Sin archivos skill.json formales", "P1"));
  children.push(priorityBullet("Sin definición de prerrequisitos y dependencias por skill", "P1"));
  children.push(priorityBullet("Sin composición de skills (pipelines)", "P2"));

  children.push(heading2("19.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PARCIALMENTE ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_ORANGE, bold: true }),
    new TextRun({ text: "Las skills existen funcionalmente pero sin definición formal ni composición.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 20 — MemoriaDV (Bóveda de Memoria)
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 20 — MemoriaDV (Bóveda de Memoria)"));

  children.push(heading2("20.1 Estado Actual"));
  children.push(bodyPara(
    "KREA utiliza Prisma con SQLite como única store de persistencia. Los modelos User, Generation y CampaignEntry "
    + "proporcionan almacenamiento factual, pero no constituyen una bóveda de memoria (MemoryDV) conforme al estándar ALBRA, "
    + "que requiere separación por categorías (episódica, semántica, factual, procedural) y capacidades de búsqueda semántica."
  ));

  children.push(heading2("20.2 Modelos Prisma Actuales"));
  children.push(makeTable(
    ["Modelo", "Campos Principales", "Uso"],
    [
      ["User", "id, email, password, credits, name, role", "Autenticación y créditos"],
      ["Generation", "id, userId, type, prompt, result, metadata, credits, createdAt", "Historial de generaciones"],
      ["CampaignEntry", "id, userId, date, revenue, roas, spend, impressions, clicks, conversions", "Métricas de campaña"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("20.3 Brechas"));
  children.push(priorityBullet("Sin contrato MemoryDV formal", "P1"));
  children.push(priorityBullet("Sin separación por categorías de memoria", "P1"));
  children.push(priorityBullet("Sin búsqueda semántica en generaciones", "P2"));
  children.push(priorityBullet("Sin indexación para recuperación eficiente", "P2"));

  children.push(heading2("20.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PARCIALMENTE ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_ORANGE, bold: true }),
    new TextRun({ text: "Persistencia funcional pero sin las capacidades de MemoryDV requeridas por ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 21 — Protocolo MCP
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 21 — Protocolo MCP"));

  children.push(heading2("21.1 Definición"));
  children.push(bodyPara(
    "El Model Context Protocol (MCP) es el estándar ALBRA para la comunicación entre agentes y herramientas. "
    + "Proporciona una interfaz estandarizada para descubrimiento de capacidades, invocación de herramientas, "
    + "y gestión de contexto entre agentes."
  ));

  children.push(heading2("21.2 Estado Actual"));
  children.push(bodyPara(
    "KREA no implementa el protocolo MCP. Toda la comunicación es interna (rutas API de Next.js) "
    + "y no hay interfaz para la exposición de capacidades a otros agentes."
  ));

  children.push(heading2("21.3 Brechas"));
  children.push(priorityBullet("Protocolo MCP completamente ausente", "P1"));
  children.push(priorityBullet("No hay servidor MCP ni cliente MCP", "P1"));
  children.push(priorityBullet("Las capacidades no son descubribles externamente", "P1"));

  children.push(heading2("21.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "MCP ausente. KREA no es accesible como proveedor de herramientas en la red ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 22 — Sistema de Eventos
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 22 — Sistema de Eventos"));

  children.push(heading2("22.1 Estado Actual"));
  children.push(bodyPara(
    "KREA no posee un sistema de eventos. Las operaciones (generaciones, deducciones de crédito, errores) "
    + "no emiten eventos que puedan ser consumidos por otros agentes o sistemas de observabilidad."
  ));

  children.push(heading2("22.2 Eventos Requeridos"));
  children.push(makeTable(
    ["Evento", "Payload", "Consumidores Potentes"],
    [
      ["generation.started", "{userId, type, prompt, requestId}", "Observabilidad, A2A"],
      ["generation.completed", "{userId, type, result, credits, duration}", "Historial, A2A, Feedback"],
      ["generation.failed", "{userId, type, error, creditsRefunded}", "Observabilidad, Doctor"],
      ["credits.deducted", "{userId, amount, reason, newBalance}", "Auditoría, Observabilidad"],
      ["credits.refunded", "{userId, amount, reason, newBalance}", "Auditoría, Observabilidad"],
      ["agent.health", "{status, checks, timestamp}", "Orquestador, Doctor"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("22.3 Brechas"));
  children.push(priorityBullet("Sistema de eventos completamente ausente", "P1"));
  children.push(priorityBullet("No hay emisión de eventos en operaciones críticas", "P1"));
  children.push(priorityBullet("No hay contrato de evento (schema por evento)", "P1"));

  children.push(heading2("22.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Sistema de eventos ausente. Impide la integración reactiva con la red ALBRA.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 23 — Niveles de Autonomía
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 23 — Niveles de Autonomía"));

  children.push(heading2("23.1 Niveles ALBRA"));
  children.push(makeTable(
    ["Nivel", "Nombre", "Descripción", "KREA Actual"],
    [
      ["L0", "Manual", "Requiere intervención humana para cada acción", "—"],
      ["L1", "Asistido", "Sugiere acciones, humano decide y ejecuta", "—"],
      ["L2", "Supervisado", "Ejecuta con aprobación humana previa", "—"],
      ["L3", "Delegado", "Ejecuta de forma autónoma dentro de límites", "✅ (implícito)"],
      ["L4", "Autónomo", "Toma decisiones y ejecuta sin supervisión", "—"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("23.2 Estado Actual"));
  children.push(bodyPara(
    "KREA opera de facto en L3 (Delegado): ejecuta generaciones de forma autónoma dentro de los límites "
    + "definidos por el sistema de créditos y las capacidades disponibles. Sin embargo, este nivel "
    + "no está declarado formalmente ni son explícitos los límites de la delegación."
  ));

  children.push(heading2("23.3 Brechas"));
  children.push(priorityBullet("Nivel de autonomía implícito, no declarado formalmente", "P1"));
  children.push(priorityBullet("Límites de delegación no explícitos", "P1"));
  children.push(priorityBullet("No hay mecanismo para escalar autonomía (L3→L4)", "P2"));

  children.push(heading2("23.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PARCIALMENTE ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_ORANGE, bold: true }),
    new TextRun({ text: "La autonomía funcional existe (L3) pero no está formalizada ni son explícitos los límites.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 24 — Sistema de Políticas y Permisos
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 24 — Sistema de Políticas y Permisos"));

  children.push(heading2("24.1 Estado Actual"));
  children.push(bodyPara(
    "KREA no posee un sistema de políticas ni permisos. No hay RBAC (Role-Based Access Control), "
    + "no hay ACL (Access Control List), y no hay validación de permisos por operación. "
    + "Cualquier usuario autenticado puede acceder a todas las funcionalidades."
  ));

  children.push(heading2("24.2 Políticas Requeridas"));
  children.push(bulletPara("policy:generation_limits — Límites de generación por tipo y usuario"));
  children.push(bulletPara("policy:credit_minimum — Balance mínimo de créditos para operar"));
  children.push(bulletPara("policy:content_filter — Filtro de contenido inapropiado en prompts"));
  children.push(bulletPara("policy:rate_limit — Límites de tasa por usuario y endpoint"));
  children.push(bulletPara("policy:admin_access — Permisos de administración (métricas globales, configuración)"));

  children.push(heading2("24.3 Brechas"));
  children.push(priorityBullet("Sistema de políticas completamente ausente", "P0"));
  children.push(priorityBullet("No hay RBAC ni ACL", "P0"));
  children.push(priorityBullet("Cualquier usuario puede acceder a todas las funcionalidades", "P0"));

  children.push(heading2("24.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Sistema de políticas ausente. Cualquier usuario tiene acceso total.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 25 — Bucle de Retroalimentación y Aprendizaje
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 25 — Bucle de Retroalimentación y Aprendizaje"));

  children.push(heading2("25.1 Estado Actual"));
  children.push(bodyPara(
    "KREA no tiene mecanismo de retroalimentación ni aprendizaje. Los resultados de generación "
    + "no son evaluados, no hay feedback del usuario sobre calidad, y no hay mecanismo de mejora "
    + "automática basada en resultados históricos."
  ));

  children.push(heading2("25.2 Mecanismos Requeridos"));
  children.push(bulletPara("feedback:rating — Rating de calidad por generación (1-5)"));
  children.push(bulletPara("feedback:correction — Corrección del usuario sobre resultado"));
  children.push(bulletPara("learning:prompt_optimization — Optimización de prompts basada en ratings históricos"));
  children.push(bulletPara("learning:style_preference — Aprendizaje de preferencias de estilo por usuario"));
  children.push(bulletPara("learning:provider_quality — Evaluación de calidad por proveedor"));

  children.push(heading2("25.3 Brechas"));
  children.push(priorityBullet("Sistema de retroalimentación completamente ausente", "P1"));
  children.push(priorityBullet("Sistema de aprendizaje completamente ausente", "P2"));
  children.push(priorityBullet("No hay evaluación de calidad de resultados", "P1"));

  children.push(heading2("25.4 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "NO ALINEADO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_RED, bold: true }),
    new TextRun({ text: "Sin retroalimentación ni aprendizaje. KREA no mejora con el uso.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // FASE 26 — Plan de Implementación P0
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Fase 26 — Plan de Implementación P0"));

  children.push(heading2("26.1 Elementos P0 (Acciones Críticas)"));
  children.push(bodyPara(
    "Los siguientes elementos constituyen el plan de implementación de prioridad P0. "
    + "Deben completarse antes de que KREA pueda ser considerado alineado con la Arquitectura Universal ALBRA.",
    { noIndent: true }
  ));
  children.push(emptyLine());

  const p0Items = [
    ["1",  "Crear archivo agent.identity.json con contrato de identidad formal", "Fase 1, 6"],
    ["2",  "Crear archivo agent.mission.json con contrato de misión formal", "Fase 2"],
    ["3",  "Corregir ruta /api/generate/prompt (se recrea pero desaparece)", "Fase 4"],
    ["4",  "Implementar bcrypt para hashing de contraseñas", "Fase 11, 17"],
    ["5",  "Implementar JWT con secreto y expiración para autenticación", "Fase 11, 17"],
    ["6",  "Añadir middleware de autenticación a rutas de métricas", "Fase 11, 17"],
    ["7",  "Corregir race condition de créditos con Prisma transactions", "Fase 11, 16"],
    ["8",  "Crear interfaz de abstracción de proveedores (ProviderInterface)", "Fase 7"],
    ["9",  "Crear módulo Doctor con health checks", "Fase 14"],
    ["10", "Implementar trazas de ejecución completas", "Fase 15"],
    ["11", "Añadir niveles de evidencia/verdad a resultados de generación", "Fase 12"],
    ["12", "Implementar logging estructurado (observabilidad básica)", "Fase 13"],
    ["13", "Migrar writeFileSync → writeFile async en manejadores de petición", "Fase 11"],
    ["14", "Pass completo de auditoría de seguridad", "Fase 11"],
  ];

  children.push(makeTable(
    ["#", "Acción P0", "Fases Relacionadas"],
    p0Items
  ));
  children.push(emptyLine());

  children.push(heading2("26.2 Elementos P1 (Importantes)"));
  const p1Items = [
    "Crear contratos de capacidad formales",
    "Implementar sistema de eventos (event emission)",
    "Definir contratos Agente-a-Agente (A2A)",
    "Implementar protocolo MCP (servidor)",
    "Crear archivos skill.json para cada skill",
    "Declarar niveles de autonomía explícitos",
    "Implementar sistema de políticas y permisos (RBAC)",
    "Crear contrato MemoryDV",
    "Implementar bucle de retroalimentación",
    "Corregir Settings (cambio de pass, preferencias)",
    "Añadir rate limiting",
    "Configurar CORS restrictivo",
  ];
  p1Items.forEach(item => children.push(priorityBullet(item, "P1")));

  children.push(heading2("26.3 Elementos P2 (Deseables)"));
  const p2Items = [
    "Implementar sistema de aprendizaje (MemoryDV integration)",
    "Búsqueda semántica en historial de generaciones",
    "Composición de skills (pipelines)",
    "Medición de calidad comparativa entre proveedores",
    "Mecanismo de escalado de autonomía (L3→L4)",
    "Límite de crédito mínimo configurable",
  ];
  p2Items.forEach(item => children.push(priorityBullet(item, "P2")));

  children.push(heading2("26.4 Estimación de Esfuerzo"));
  children.push(makeTable(
    ["Prioridad", "Elementos", "Estimación (horas)", "Riesgo si no se completa"],
    [
      ["P0", "14", "80–120", "Bloqueante para integración ALBRA"],
      ["P1", "12", "60–90", "Limitante para operabilidad en red"],
      ["P2", "6", "30–50", "Mejora de calidad y eficiencia"],
      ["Total", "32", "170–260", "—"],
    ]
  ));
  children.push(emptyLine());

  children.push(heading2("26.5 Orden Recomendado de Implementación"));
  children.push(bodyPara(
    "Se recomienda el siguiente orden de implementación para maximizar el impacto y minimizar el riesgo:",
    { noIndent: true }
  ));
  children.push(emptyLine());

  const order = [
    "Sprint 1 (Seguridad): Items 4, 5, 6, 13, 14 — Cerrar vulnerabilidades críticas primero",
    "Sprint 2 (Identidad): Items 1, 2 — Establecer contratos formales de identidad y misión",
    "Sprint 3 (Infraestructura): Items 7, 8, 12 — Credit safety, provider abstraction, observabilidad",
    "Sprint 4 (Calidad): Items 9, 10, 11, 3 — Doctor, trazas, evidencia, fix prompt route",
    "Sprint 5 (Integración): P1 items — A2A, MCP, eventos, políticas, skills, feedback",
    "Sprint 6 (Madurez): P2 items — Aprendizaje, búsqueda semántica, composición, calidad comparativa",
  ];
  order.forEach((item, idx) => {
    children.push(bodyPara([
      new TextRun({ text: `${idx + 1}. `, font: FONT_BODY, size: BODY_SIZE, color: COLOR_ACCENT, bold: true }),
      new TextRun({ text: item, font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
    ], { noIndent: true }));
  });

  children.push(heading2("26.6 Veredicto de Fase"));
  children.push(bodyPara([
    new TextRun({ text: "PLAN DEFINIDO — ", font: FONT_HEADING, size: BODY_SIZE, color: COLOR_GREEN, bold: true }),
    new TextRun({ text: "El plan de implementación P0 está completo y priorizado. La ejecución debe seguir el orden "
      + "recomendado (seguridad → identidad → infraestructura → calidad → integración → madurez) para minimizar riesgo.", font: FONT_BODY, size: BODY_SIZE, color: COLOR_BLACK }),
  ], { noIndent: true }));

  // ═══════════════════════════════════════════════
  // CONCLUSIÓN GLOBAL
  // ═══════════════════════════════════════════════
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading1("Conclusión Global del Audit"));

  children.push(heading2("Resumen de Veredictos por Fase"));
  const verdicts = [
    ["Fase 1", "Identidad del Agente", "NO ALINEADO", COLOR_RED],
    ["Fase 2", "Misión del Agente", "NO ALINEADO", COLOR_RED],
    ["Fase 3", "Arquitectura Actual", "PARCIALMENTE ALINEADO", COLOR_ORANGE],
    ["Fase 4", "Capacidades Clasificadas", "PARCIALMENTE ALINEADO", COLOR_ORANGE],
    ["Fase 5", "Dominio Canónico", "PARCIALMENTE ALINEADO", COLOR_ORANGE],
    ["Fase 6", "Contrato de Identidad", "NO ALINEADO", COLOR_RED],
    ["Fase 7", "Arquitectura de Proveedores", "NO ALINEADO", COLOR_RED],
    ["Fase 8", "Contratos A2A", "NO ALINEADO", COLOR_RED],
    ["Fase 9", "Categorías de Memoria", "NO ALINEADO", COLOR_RED],
    ["Fase 10", "Matriz de Clasificación", "NO ALINEADO", COLOR_RED],
    ["Fase 11", "Evaluación de Seguridad", "NO ALINEADO — CRÍTICO", COLOR_RED],
    ["Fase 12", "Evidencia y Verdad", "NO ALINEADO", COLOR_RED],
    ["Fase 13", "Observabilidad", "NO ALINEADO", COLOR_RED],
    ["Fase 14", "Módulo Doctor", "NO ALINEADO", COLOR_RED],
    ["Fase 15", "Trazas de Ejecución", "NO ALINEADO", COLOR_RED],
    ["Fase 16", "Sistema de Créditos", "PARCIALMENTE ALINEADO", COLOR_ORANGE],
    ["Fase 17", "Autenticación y Autorización", "NO ALINEADO — CRÍTICO", COLOR_RED],
    ["Fase 18", "Interfaz de Herramientas", "NO ALINEADO", COLOR_RED],
    ["Fase 19", "Definición de Skills", "PARCIALMENTE ALINEADO", COLOR_ORANGE],
    ["Fase 20", "MemoriaDV", "PARCIALMENTE ALINEADO", COLOR_ORANGE],
    ["Fase 21", "Protocolo MCP", "NO ALINEADO", COLOR_RED],
    ["Fase 22", "Sistema de Eventos", "NO ALINEADO", COLOR_RED],
    ["Fase 23", "Niveles de Autonomía", "PARCIALMENTE ALINEADO", COLOR_ORANGE],
    ["Fase 24", "Políticas y Permisos", "NO ALINEADO", COLOR_RED],
    ["Fase 25", "Retroalimentación", "NO ALINEADO", COLOR_RED],
    ["Fase 26", "Plan P0", "PLAN DEFINIDO", COLOR_GREEN],
  ];

  children.push(makeTable(
    ["Fase", "Dominio", "Veredicto"],
    verdicts.map(v => [
      v[0], v[1],
      statusCell(v[2], v[3]),
    ])
  ));
  children.push(emptyLine());

  const noAlineado = verdicts.filter(v => v[2].includes("NO ALINEADO")).length;
  const parcial = verdicts.filter(v => v[2].includes("PARCIAL")).length;
  const alineado = verdicts.filter(v => v[2].includes("PLAN") || v[2].includes("ALINEADO") && !v[2].includes("NO") && !v[2].includes("PARCIAL")).length;

  children.push(heading2("Estadísticas Globales"));
  children.push(bulletPara(`Fases NO ALINEADO: ${noAlineado} de 26 (${Math.round(noAlineado/26*100)}%)`));
  children.push(bulletPara(`Fases PARCIALMENTE ALINEADO: ${parcial} de 26 (${Math.round(parcial/26*100)}%)`));
  children.push(bulletPara(`Fases con Plan Definido: 1 de 26`));
  children.push(bulletPara(`Acciones P0 totales: 14`));
  children.push(bulletPara(`Acciones P1 totales: 12`));
  children.push(bulletPara(`Acciones P2 totales: 6`));
  children.push(bulletPara(`Estimación total: 170–260 horas`));

  children.push(heading2("Veredicto Global"));
  children.push(emptyLine());
  children.push(new Paragraph({
    children: [new TextRun({
      text: "AGENTE-KREA V1 NO ESTÁ ALINEADO CON LA ARQUITECTURA UNIVERSAL ALBRA",
      font: FONT_HEADING,
      size: 28,
      color: COLOR_RED,
      bold: true,
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  }));
  children.push(emptyLine());

  children.push(bodyPara(
    "AGENTE-KREA es funcionalmente operativo como agente de producción visual/creativa aislado, con 7 capacidades "
    + "core implementadas y un sistema de créditos funcional. Sin embargo, presenta desviaciones críticas respecto "
    + "a la Arquitectura Universal ALBRA en las áreas de seguridad (3 vulnerabilidades CRÍTICAS), identidad formal "
    + "(contratos ausentes), abstracción de proveedores (acoplamiento directo), observabilidad (ausente), y "
    + "comunicación inter-agente (aislamiento total).",
    { noIndent: true }
  ));
  children.push(emptyLine());

  children.push(bodyPara(
    "La remediación requiere un esfuerzo estimado de 170–260 horas, priorizando la seguridad (Sprint 1) "
    + "seguida de la identidad formal (Sprint 2) y la infraestructura ALBRA (Sprint 3). "
    + "Tras completar los 14 items P0, KREA podrá integrarse en la red de agentes ALBRA con un nivel "
    + "de alineamiento aceptable, requiriendo posteriormente los items P1 y P2 para operabilidad completa.",
    { noIndent: true }
  ));

  children.push(emptyLine(), emptyLine());

  children.push(new Paragraph({
    children: [new TextRun({
      text: "— Fin del Documento de Auditoría —",
      font: FONT_BODY,
      size: BODY_SIZE,
      color: COLOR_GRAY,
      italics: true,
    })],
    alignment: AlignmentType.CENTER,
  }));

  // ═══════ BUILD DOCUMENT ═══════
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_BODY,
            size: BODY_SIZE,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            bottom: 1440,
            left: 1701,
            right: 1417,
          },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({
              text: "AGENTE-KREA V1 — Auditoría ALBRA",
              font: FONT_BODY,
              size: 16,
              color: COLOR_GRAY,
              italics: true,
            })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: "Confidencial — ALBRA © 2025  |  ", font: FONT_BODY, size: 16, color: COLOR_GRAY }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 16, color: COLOR_GRAY }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children,
    }],
  });

  return doc;
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log("🔧 Generando documento de auditoría AGENTE-KREA V1...");
  
  const doc = buildDocument();
  const buffer = await Packer.toBuffer(doc);
  
  const outputPath = "/home/z/my-project/download/KREA_ALBRA_Audit_V1.docx";
  fs.writeFileSync(outputPath, buffer);
  
  const stats = fs.statSync(outputPath);
  console.log(`✅ Documento generado exitosamente: ${outputPath}`);
  console.log(`📏 Tamaño: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`📄 Fases incluidas: 26`);
  console.log(`🔐 Clasificación: Confidencial — Uso Interno`);
}

main().catch(err => {
  console.error("❌ Error generando documento:", err);
  process.exit(1);
});
