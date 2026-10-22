/**
 * Generador: PROMPT MAESTRO — Migración Proyecto → Arnés
 * Basado en la migración real de KREA V2.1
 */
const { Document, Packer, Paragraph, TextRun, Header, Footer,
        AlignmentType, HeadingLevel, PageNumber, TabStopType,
        BorderStyle, Table, TableRow, TableCell, WidthType,
        ShadingType, PageBreak, SectionType } = require("docx");
const fs = require("fs");

// ─── Palette (Tech: Cool + Light + Active) ──────────────────────
const P = {
  primary: "#0A1628",
  body: "#1A2B40",
  secondary: "#6878A0",
  accent: "#5B8DB8",
  surface: "#F4F8FC",
};
const c = (hex) => hex.replace("#", "");

// ─── Helpers ────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: c(P.accent), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    indent: opts.noIndent ? undefined : { firstLine: 420 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 22, color: c(opts.color || P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, bold: opts.bold, italics: opts.italic })],
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    indent: { left: 420 + level * 360 },
    children: [
      new TextRun({ text: level === 0 ? "\u2022 " : "\u25E6 ", size: 22, color: c(P.accent), font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}
function code(text) {
  return new Paragraph({
    spacing: { line: 280, before: 80, after: 80 },
    indent: { left: 420 },
    shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
    children: [new TextRun({ text, size: 18, color: c("#1A1A2E"), font: { ascii: "Consolas", eastAsia: "Consolas" } })],
  });
}
function codeBlock(lines) {
  return lines.map(l => code(l));
}
function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent) } },
    children: [],
  });
}

// ─── Cover ──────────────────────────────────────────────────────
function buildCover() {
  return [
    new Paragraph({ spacing: { before: 3600 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "PROMPT MAESTRO", size: 56, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: "Migraci\u00f3n Proyecto \u2192 Arn\u00e9s", size: 36, color: c(P.accent), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
    }),
    divider(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Separar el AGENTE-GENERAL de cada proyecto", size: 24, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Cada proyecto = chaleco (arn\u00e9s) que el agente se pone", size: 24, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Sin perder informaci\u00f3n ni da\u00f1ar cosas en el proceso", size: 24, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    divider(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 120 },
      children: [new TextRun({ text: "Basado en la migraci\u00f3n real de KREA V2.1", size: 20, italic: true, color: c(P.secondary), font: { ascii: "Calibri" } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Octubre 2026", size: 20, italic: true, color: c(P.secondary), font: { ascii: "Calibri" } })],
    }),
  ];
}

// ─── Section Content ────────────────────────────────────────────
function section1() { // El Problema
  return [
    h1("1. El Problema"),
    p("Tienes m\u00faltiples proyectos donde el agente de IA est\u00e1 encarnado \u2014 mezclado con el c\u00f3digo del proyecto, sus conocimientos incrustados en los m\u00f3dulos, sus capacidades acopladas a la infraestructura. Cada proyecto reinventa el agente desde cero: mismo patr\u00f3n de razonamiento, misma gesti\u00f3n de memoria, mismas validaciones, mismo sistema de evidencia \u2014 copiado y pegado con variaciones menores."),
    p("El resultado es trabajo doble: cada cambio al agente hay que aplicarlo proyecto por proyecto, cada bug se multiplica, cada mejora requiere ir uno por uno. Y cuando un proyecto falla, se pierde conocimiento que deber\u00eda ser compartido."),
    p("La soluci\u00f3n es separar lo que es del AGENTE de lo que es del PROYECTO. El agente es una constante \u2014 un repositorio \u00fanico con identidad, capacidades cognitivas y contrato. Cada proyecto es un chaleco (arn\u00e9s) que el agente se pone, que contiene el conocimiento espec\u00edfico del dominio."),
    h2("La analog\u00eda del cajero"),
    p("Piensa en una tienda. El cajero es el agente: llega, se pone el chaleco, opera la caja. Si el cajero se va, llega otro cajero. La caja registradora (el arn\u00e9s) no se mueve: los procedimientos, los registros, los productos, los precios \u2014 todo queda. El cajero nuevo solo necesita saber operar la caja, y el chaleco le dice c\u00f3mo."),
    p("Lo cr\u00edtico: el conocimiento nunca est\u00e1 en el cajero. Est\u00e1 en la caja. Si cambias de cajero, no pierdes nada. Si abres otra tienda, le pones el mismo tipo de chaleco a otro cajero."),
  ];
}

function section2() { // La Arquitectura
  return [
    h1("2. La Arquitectura: Agente + Arn\u00e9s"),
    p("La arquitectura target tiene 4 capas formales. Cada capa tiene una responsabilidad \u00fanica y no se mezcla con las dem\u00e1s:"),
    h2("Capa 1: AgentAdapter \u2014 El Contrato del Cajero"),
    p("El AgentAdapter es la interfaz que cualquier agente debe implementar para conectarse al arn\u00e9s. Define qu\u00e9 puede hacer un agente, no c\u00f3mo lo hace. Es el contrato entre el chaleco y quien lo usa."),
    bullet("getIdentity() \u2014 Qui\u00e9n es el agente (nombre, versi\u00f3n, capacidades, autonom\u00eda)"),
    bullet("reason(prompt) \u2014 Razonamiento (LLM)"),
    bullet("reasonStructured(prompt, schema) \u2014 Razonamiento con salida estructurada"),
    bullet("generateImage(prompt) \u2014 Generaci\u00f3n de im\u00e1genes"),
    bullet("generateSpeech(text) \u2014 Texto a voz"),
    bullet("memoryWrite / memoryRead \u2014 Persistencia cognitiva"),
    bullet("checkPermission / auditLog \u2014 Seguridad y auditor\u00eda"),
    bullet("healthCheck / initialize / shutdown \u2014 Ciclo de vida"),
    p("El AGENTE-GENERAL implementa esta interfaz. Cualquier otro agente (HERMES, un agente custom) que la implemente puede conectarse al mismo arn\u00e9s sin cambiar nada m\u00e1s."),
    h2("Capa 2: BridgeRegistry \u2014 Las Conexiones Formales"),
    p("Los bridges formalizan c\u00f3mo el arn\u00e9s habla con cada runtime externo. Nunca se llama un proveedor directamente \u2014 todo pasa por un bridge. Los tipos de bridge son:"),
    bullet("ZaiSdkBridge \u2014 Llama al z-ai-web-dev-sdk (LLM, imagen, voz) \u2014 Node.js nativo"),
    bullet("PythonBridge \u2014 Llama scripts Python via subprocess"),
    bullet("HttpBridge \u2014 Llama APIs REST externas"),
    p("El AdapterRegistry permite cambiar el agente activo en runtime sin reiniciar. KREA.swapAgent(nuevoAgente) desconecta el anterior, conecta el nuevo, y el conocimiento queda intacto."),
    h2("Capa 3: SkillRegistry \u2014 Conocimiento Plugin"),
    p("Los SkillPlugins son m\u00f3dulos de conocimiento que se registran en el arn\u00e9s. Cada skill tiene operaciones espec\u00edficas que ejecuta usando el agente activo. Ejemplo: InfoproductosPlugin con 8 operaciones (recommend-format, validate-demand, build-index, etc.)."),
    p("Si el agente cambia, los skills siguen funcionando \u2014 solo cambian las manos que ejecutan, no las recetas."),
    h2("Capa 4: KnowledgeRegistry \u2014 Conocimiento Core"),
    p("El KnowledgeRegistry registra formalmente cada m\u00f3dulo de conocimiento del arn\u00e9s con su ID, versi\u00f3n, categor\u00eda, capacidades y archivos fuente. Cada m\u00f3dulo puede reportar su salud. El conocimiento es INMUTABLE frente al cambio de agente."),
  ];
}

function section3() { // FASE 0
  return [
    h1("3. FASE 0: Auditor\u00eda del Proyecto"),
    p("Antes de tocar nada, audita el proyecto existente. Esta fase es CR\u00cdTICA \u2014 sin ella no sabes qu\u00e9 separar y qu\u00e9 dejar. El objetivo es mapear qu\u00e9 es agente (intercambiable) y qu\u00e9 es conocimiento (permanente)."),
    h2("3.1 Detectar el stack"),
    p("Revisa el proyecto y determina:"),
    bullet("\u00bfTiene package.json? \u2192 Node.js / Next.js / React"),
    bullet("\u00bfTiene requirements.txt o pyproject.toml? \u2192 Python / FastAPI / Flask"),
    bullet("\u00bfTiene ambos? \u2192 H\u00edbrido (Node.js + scripts Python)"),
    bullet("\u00bfUsa z-ai-web-dev-sdk? \u2192 Ya tiene bridge a ZAI"),
    bullet("\u00bfUsa OpenAI SDK directo? \u2192 Necesita bridge"),
    h2("3.2 Mapear agente vs conocimiento"),
    p("Para cada m\u00f3dulo del proyecto, clasifica:"),
    bullet("AGENTE: Llamadas a LLM, generaci\u00f3n de im\u00e1genes, TTS, razonamiento, prompts del sistema \u2192 se mueve al AGENTE-GENERAL"),
    bullet("CONOCIMIENTO: L\u00f3gica de negocio, validaciones, pipelines, schemas, reglas del dominio \u2192 se queda en el arn\u00e9s"),
    bullet("PUENTE: Memoria, seguridad, auditor\u00eda \u2192 se implementa como adaptador que usa ambos"),
    h2("3.3 Identificar acoplamientos"),
    p("Busca import directos del SDK de IA desde m\u00f3dulos de negocio. Cada uno es un acoplamiento que hay que romper y reemplazar con una llamada al adaptador. Ejemplo:"),
    code("// ANTES (acoplado):"),
    code("import ZAI from 'z-ai-web-dev-sdk';"),
    code("const result = await ZAI.chat.completions.create({messages});"),
    code(""),
    code("// DESPU\u00c9S (desacoplado):"),
    code("const agent = getAgent();  // del arn\u00e9s"),
    code("const result = await agent.reason(prompt, {systemPrompt});"),
    h2("3.4 Generar el inventario"),
    p("Crea un archivo INVENTARIO.md con:"),
    bullet("Lista de archivos AGENTE (se mueven/reemplazan)"),
    bullet("Lista de archivos CONOCIMIENTO (se quedan, se registran)"),
    bullet("Lista de acoplamientos a romper"),
    bullet("Stack detectado y bridges necesarios"),
    bullet("Dependencias entre m\u00f3dulos (grafo)"),
    p("Este inventario es tu mapa. Sin \u00e9l, operas a ciegas."),
  ];
}

function section4() { // FASE 1
  return [
    h1("4. FASE 1: Dise\u00f1ar el Contrato del Adaptador"),
    p("Define el AgentAdapter para el stack del proyecto. Este contrato es lo que el AGENTE-GENERAL va a implementar para conectarse. Si el proyecto es TypeScript, usa interfaz. Si es Python, usa Protocol o ABC."),
    h2("Para TypeScript / Next.js"),
    ...codeBlock([
      "export interface AgentAdapter {",
      "  readonly adapterName: string;",
      "  readonly isConnected: boolean;",
      "  getIdentity(): AgentIdentity;",
      "  reason(prompt: string, options?: ReasonOptions): Promise<AgentResponse>;",
      "  reasonStructured<T>(prompt: string, schema: unknown): Promise<AgentResponse & { structured: T }>;",
      "  generateImage?(prompt: string, options?: ImageOptions): Promise<AgentResponse>;",
      "  generateSpeech?(text: string, options?: SpeechOptions): Promise<AgentResponse>;",
      "  memoryWrite(domain: string, content: unknown): Promise<{ id: string; evidence: EvidenceTag }>;",
      "  memoryRead(domain: string, query?: string): Promise<MemoryRecord[]>;",
      "  checkPermission(action: string, actor: string): Promise<SecurityResult>;",
      "  auditLog(entry: AuditEntry): Promise<void>;",
      "  healthCheck(): Promise<HealthStatus>;",
      "  initialize(): Promise<void>;",
      "  shutdown(): Promise<void>;",
      "}",
    ]),
    h2("Para Python / FastAPI"),
    ...codeBlock([
      "from abc import ABC, abstractmethod",
      "from dataclasses import dataclass",
      "",
      "class AgentAdapter(ABC):",
      "    @property",
      "    @abstractmethod",
      "    def adapter_name(self) -> str: ...",
      "",
      "    @abstractmethod",
      "    async def reason(self, prompt: str, **options) -> AgentResponse: ...",
      "",
      "    @abstractmethod",
      "    async def reason_structured(self, prompt: str, schema: dict, **options) -> AgentResponse: ...",
      "",
      "    @abstractmethod",
      "    async def health_check(self) -> HealthStatus: ...",
      "",
      "    @abstractmethod",
      "    async def initialize(self) -> None: ...",
      "",
      "    @abstractmethod",
      "    async def shutdown(self) -> None: ...",
    ]),
    p("El punto clave: cada m\u00f3dulo de conocimiento NUNCA importa el SDK de IA directamente. Siempre llama a getAgent().reason() o getAgent().generateImage(). El agente es accedido a trav\u00e9s del contrato, nunca directamente."),
  ];
}

function section5() { // FASE 2
  return [
    h1("5. FASE 2: Implementar Bridges"),
    p("Los bridges formalizan las conexiones entre el arn\u00e9s y los runtimes externos. Sin bridges, cada m\u00f3dulo llama proveedores directamente \u2014 eso es acoplamiento."),
    h2("Bridge TS \u2192 ZAI SDK (Node.js)"),
    p("Si el proyecto usa z-ai-web-dev-sdk, crea un ZaiSdkBridge que envuelva las llamadas al SDK en la interfaz del bridge:"),
    bullet("chat(messages) \u2192 zai.chat.completions.create()"),
    bullet("generateImage(prompt) \u2192 zai.images.generations.create()"),
    bullet("generateSpeech(text) \u2192 zai.audio.tts.create()"),
    bullet("healthCheck() \u2192 ping al SDK"),
    h2("Bridge TS \u2192 Python (subprocess)"),
    p("Si el proyecto tiene scripts Python (como infoproductos), crea un PythonBridge:"),
    bullet("call({script, args}) \u2192 execFile('python3', [script, ...args])"),
    bullet("runScript(name, args) \u2192 shortcut que retorna stdout"),
    bullet("runScriptJson(name, args) \u2192 shortcut que parsea JSON del stdout"),
    h2("Bridge HTTP (APIs remotas)"),
    p("Si el agente corre como servidor separado (FastAPI, Flask), crea un HttpBridge:"),
    bullet("call({url, method, body}) \u2192 fetch(url, {method, body})"),
    h2("BridgeRegistry"),
    p("Todos los bridges se registran en un BridgeRegistry central. El arn\u00e9s puede buscar bridges por capacidad (getByCapability('chat')) y verificar su salud."),
    p("REGLA: Ning\u00fan m\u00f3dulo de conocimiento llama un proveedor directamente. Todo pasa por un bridge registrado."),
  ];
}

function section6() { // FASE 3
  return [
    h1("6. FASE 3: Separar Conocimiento del Agente"),
    p("Esta es la fase m\u00e1s delicada. Hay que mover el conocimiento al arn\u00e9s sin perder nada. El principio: si un m\u00f3dulo sabe C\u00d3MO hacer algo (l\u00f3gica de negocio, validaciones, pipelines), es conocimiento. Si un m\u00f3dulo sabe CON QUI\u00c9N hablar (LLM, API, SDK), es agente."),
    h2("6.1 Crear KnowledgeRegistry"),
    p("Registra cada m\u00f3dulo de conocimiento con: ID, nombre, versi\u00f3n, categor\u00eda, capacidades, archivos fuente, healthCheck. El registry permite saber en cualquier momento qu\u00e9 conocimiento est\u00e1 disponible."),
    h2("6.2 Crear SkillRegistry"),
    p("Los skills son conocimiento ejecutable. Un ISkillPlugin tiene operaciones que puede ejecutar usando el agente activo. Ejemplo: InfoproductosPlugin.recommendFormat(profile) usa heur\u00edstica del arn\u00e9s (no del agente), pero InfoproductosPlugin.validateDemand(topic) usa el agente para llamar scripts Python."),
    h2("6.3 Romper acoplamientos"),
    p("Por cada acoplamiento identificado en FASE 0:"),
    bullet("Reemplaza import ZAI from 'z-ai-web-dev-sdk' con import { getAgent } from './krea-harness'"),
    bullet("Reemplaza llamadas directas al SDK con llamadas al adaptador"),
    bullet("Reemplaza l\u00f3gica hardcodeada del agente con l\u00f3gica del arn\u00e9s + llamada al agente"),
    p("Ejemplo concreto de la migraci\u00f3n KREA:"),
    code("// ANTES: product-fit.ts importaba ZAI directamente"),
    code("import ZAI from 'z-ai-web-dev-sdk';"),
    code("const zai = await ZAI.create();"),
    code("const response = await zai.chat.completions.create({messages});"),
    code(""),
    code("// DESPU\u00c9S: product-fit.ts usa el agente del arn\u00e9s"),
    code("import { withAgent } from './krea-harness';"),
    code("const response = await withAgent("),
    code("  agent => agent.reason(prompt, {systemPrompt}),"),
    code("  () => ({content: 'fallback', evidence: 'NOT_VERIFIED'})"),
    code(");"),
    h2("6.4 Verificar que nada se perdi\u00f3"),
    p("Despu\u00e9s de cada movimiento, corre los tests. Si un test falla, el conocimiento se rompi\u00f3 \u2014 para y arregla antes de continuar. La regla de oro: despu\u00e9s de la separaci\u00f3n, el proyecto debe funcionar EXACTAMENTE igual que antes, solo que ahora el agente es intercambiable."),
  ];
}

function section7() { // FASE 4
  return [
    h1("7. FASE 4: Crear el Bootstrap"),
    p("El bootstrap es el c\u00f3digo que pone el chaleco al agente al arrancar la app. Sin bootstrap, el arn\u00e9s existe pero el agente no est\u00e1 montado \u2014 el chaleco est\u00e1 cosido pero nadie se lo ha puesto."),
    h2("Para Next.js"),
    ...codeBlock([
      "// src/lib/bootstrap.ts",
      "export async function bootstrapKrea() {",
      "  // 1. Registrar bridges",
      "  bridgeRegistry.register(zaiSdkBridge);",
      "  await zaiSdkBridge.initialize();",
      "",
      "  // 2. Crear y montar adaptador",
      "  const adapter = new GeneralAdapter({useZaiSdk: true});",
      "  await kreaHarness.mount(adapter);",
      "",
      "  // 3. Registrar skills",
      "  await kreaHarness.registerSkill(new InfoproductosPlugin());",
      "}",
    ]),
    p("Conectar al layout para que corra al inicio:"),
    ...codeBlock([
      "// src/app/layout.tsx",
      "if (typeof window === 'undefined') {",
      "  import('@/lib/bootstrap').then(({bootstrapKrea}) => bootstrapKrea());",
      "}",
    ]),
    h2("Para FastAPI / Flask"),
    ...codeBlock([
      "# main.py",
      "from harness import KreaHarness, GeneralAdapter",
      "",
      "harness = KreaHarness()",
      "",
      "@app.on_event('startup')",
      "async def startup():",
      "    adapter = GeneralAdapter()",
      "    await harness.mount(adapter)",
      "    await harness.register_skill(InfoproductosPlugin())",
    ]),
    p("El bootstrap debe ser idempotente: llamarlo m\u00faltiples veces no tiene efecto negativo. Y si falla, el arn\u00e9s debe funcionar en modo degradado \u2014 el conocimiento sigue disponible aunque el agente no est\u00e9 conectado."),
  ];
}

function section8() { // FASE 5
  return [
    h1("8. FASE 5: Cleanup y Verificaci\u00f3n"),
    h2("8.1 Eliminar reimplementaciones"),
    p("Despu\u00e9s de la separaci\u00f3n, habr\u00e1 m\u00f3dulos que quedaron hu\u00e9rfanos o supersededos. Haz una clasificaci\u00f3n LIPO:"),
    bullet("KEEP: M\u00f3dulos core del pipeline y la infraestructura"),
    bullet("REFACTOR: M\u00f3dulos que necesitan adaptaci\u00f3n pero no eliminaci\u00f3n"),
    bullet("DELETE: M\u00f3dulos supersededos o duplicados (cero imports en producci\u00f3n)"),
    bullet("TOOL: Utilidades puras que no son conocimiento ni agente"),
    p("Regla de oro para DELETE: solo eliminar si tiene CERO imports desde c\u00f3digo de producci\u00f3n (tests no cuentan). Si alg\u00fan archivo de producci\u00f3n lo importa, no borrar."),
    h2("8.2 Verificaci\u00f3n de integridad"),
    bullet("Correr todos los tests existentes \u2192 deben pasar igual que antes"),
    bullet("Build limpio \u2192 cero errores de compilaci\u00f3n"),
    bullet("API endpoints funcionales \u2192 mismo n\u00famero que antes"),
    bullet("Conocimiento preservado \u2192 KnowledgeRegistry.listIds() contiene todos los m\u00f3dulos originales"),
    bullet("Agente intercambiable \u2192 swapAgent() funciona sin perder conocimiento"),
    h2("8.3 Clean-room build"),
    p("Haz un build desde cero: rm -rf node_modules .next && npm install && npm run build. Si falla, algo se rompi\u00f3 en la migraci\u00f3n."),
  ];
}

function section9() { // Checklist
  return [
    h1("9. Checklist de Verificaci\u00f3n Final"),
    p("Despu\u00e9s de completar todas las fases, verifica cada punto:"),
    h2("Arquitectura"),
    bullet("\u2703 AgentAdapter definido e implementado por AGENTE-GENERAL"),
    bullet("\u2703 AdapterRegistry permite registrar y cambiar agentes en runtime"),
    bullet("\u2703 KreaHarness integra los 4 registros (agentes, bridges, skills, conocimiento)"),
    bullet("\u2703 Bootstrap monta el agente al arrancar la app"),
    h2("Desacoplamiento"),
    bullet("\u2703 Ning\u00fan m\u00f3dulo de conocimiento importa el SDK de IA directamente"),
    bullet("\u2703 Todo acceso al agente pasa por getAgent() o withAgent()"),
    bullet("\u2703 Bridges formalizan todas las conexiones externas"),
    bullet("\u2703 Skills usan el agente solo a trav\u00e9s del SkillContext"),
    h2("Preservaci\u00f3n del conocimiento"),
    bullet("\u2703 KnowledgeRegistry contiene todos los m\u00f3dulos originales"),
    bullet("\u2703 Cada m\u00f3dulo tiene healthCheck que reporta AVAILABLE"),
    bullet("\u2703 swapAgent() retorna knowledgePreserved: true"),
    bullet("\u2703 Los mismos API endpoints funcionan (mismo count)"),
    h2("Funcionalidad"),
    bullet("\u2703 Todos los tests pasan (mismo n\u00famero o m\u00e1s)"),
    bullet("\u2703 Build limpio sin errores"),
    bullet("\u2703 La app funciona igual que antes para el usuario final"),
    bullet("\u2703 Modo degradado funciona si el agente no est\u00e1 disponible"),
  ];
}

function section10() { // Referencia KREA
  return [
    h1("10. Referencia: C\u00f3digo KREA"),
    p("Fragmentos de la migraci\u00f3n real de KREA V2.1 como referencia. Este es el proyecto que ya fue migrado exitosamente."),
    h2("Estructura de archivos creados"),
    ...codeBlock([
      "src/lib/",
      "\u251C\u2500\u2500 krea-harness.ts          # KreaHarness orchestrator",
      "\u251C\u2500\u2500 agent-adapter.ts          # AgentAdapter contract + AdapterRegistry",
      "\u251C\u2500\u2500 bootstrap.ts              # Monta agente al arrancar",
      "\u251C\u2500\u2500 adapters/",
      "\u2502   \u2514\u2500\u2500 general-adapter.ts   # Implementaci\u00f3n para AGENTE-GENERAL",
      "\u251C\u2500\u2500 bridges/",
      "\u2502   \u251C\u2500\u2500 types.ts             # IBridge, BridgeRegistry, result types",
      "\u2502   \u251C\u2500\u2500 zai-sdk-bridge.ts   # Bridge al z-ai-web-dev-sdk",
      "\u2502   \u2514\u2500\u2500 python-bridge.ts    # Bridge a scripts Python",
      "\u2514\u2500\u2500 harness/",
      "    \u251C\u2500\u2500 types.ts               # ISkillPlugin, SkillRegistry, SkillContext",
      "    \u251C\u2500\u2500 infoproductos-plugin.ts # Infoproductos como SkillPlugin",
      "    \u2514\u2500\u2500 knowledge-registry.ts   # 29+ m\u00f3dulos de conocimiento",
    ]),
    h2("M\u00e9tricas de la migraci\u00f3n"),
    bullet("32 m\u00f3dulos de conocimiento registrados en 10 categor\u00edas"),
    bullet("3 bridges (ZAI SDK + 2 Python)"),
    bullet("1 skill plugin (Infoproductos con 8 operaciones)"),
    bullet("6 m\u00f3dulos eliminados (LIPO cleanup)"),
    bullet("278 tests pasando (+37 nuevos)"),
    bullet("57 API routes funcionales"),
    bullet("Build limpio, cero errores"),
    h2("Lo que cambi\u00f3 vs lo que no cambi\u00f3"),
    p("CAMBI\u00d3: C\u00f3mo se accede al agente (de import directo a getAgent()). C\u00f3mo se inicializa (de impl\u00edcito a bootstrap expl\u00edcito). C\u00f3mo se registran m\u00f3dulos (de strings a objetos con healthCheck)."),
    p("NO CAMBI\u00d3: La l\u00f3gica de negocio. Los pipelines de producto. Los schemas. La DB. La UI. Los API endpoints. Lo que el usuario final ve y usa."),
    p("Esta es la prueba definitiva de que la separaci\u00f3n fue exitosa: el proyecto funciona id\u00e9ntico, pero ahora el agente es intercambiable."),
  ];
}

// ─── Assemble Document ──────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    // Cover
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
      },
      children: buildCover(),
    },
    // Body
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary), font: { ascii: "Calibri" } }),
              ],
            }),
          ],
        }),
      },
      children: [
        ...section1(),
        ...section2(),
        ...section3(),
        ...section4(),
        ...section5(),
        ...section6(),
        ...section7(),
        ...section8(),
        ...section9(),
        ...section10(),
      ],
    },
  ],
});

// ─── Generate ───────────────────────────────────────────────────
Packer.toBuffer(doc).then(buf => {
  const outPath = "/home/z/my-project/download/PROMPT-MAESTRO-Migracion-Proyecto-Arnes.docx";
  fs.writeFileSync(outPath, buf);
  console.log("Generated:", outPath);
});
