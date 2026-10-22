# OpenSEO: cuántas personas buscan lo que vendes

17 de octubre de 2026. Guía común para los agentes que miden demanda de búsquedas (cursos 03, 08, 09, 10, 11, 12, 13, 15, 16 y 18) y para el curso 02, donde el alumno crea la cuenta y la conecta.

## Por qué OpenSEO va primero

El autocompletado de Google dice qué frases escribe la gente, sin decir cuántas veces. OpenSEO da el **volumen real de búsquedas al mes** por país (datos de DataForSEO, que salen de Google), la dificultad para salir arriba, la intención de la búsqueda y el costo por clic estimado. Con ese dato el alumno elige las palabras que traen clientes. Por eso es la herramienta principal (regla de costos del canon, sección 4).

`autocompletado.py` sigue en los agentes con dos usos:
- **Complemento:** encuentra frases y preguntas que después se miden con OpenSEO (`get_keyword_metrics`).
- **Plan B:** si el alumno no tiene OpenSEO conectado o se quedó sin saldo. El agente le dice qué se pierde: la lista sale sin volumen, y la elección de palabras queda a criterio.

## Cuánto cuesta (web oficial, 17-oct-2026)

| Concepto | Dato | Fuente |
|---|---|---|
| Prueba gratis | US$0.50 en créditos al crear la cuenta | openseo.so/pricing |
| Plan | Un solo plan, **Base Plan**, US$10 al mes con US$10 en créditos de uso que se renuevan cada ciclo | openseo.so/pricing |
| Recargas | Se compran cuando quieras. No vencen y pasan de un mes a otro. Para usarlas hace falta la suscripción activa | openseo.so/pricing |
| Equivalencia | 1,000 créditos = US$1 | código oficial de OpenSEO (`AUTUMN_SEO_DATA_CREDITS_PER_USD = 1000`, repositorio every-app/open-seo) |
| Datos de Search Console | No gastan créditos | openseo.so/pricing |
| Si se acaba el saldo | La consulta da error de créditos insuficientes y no se cobra | código oficial (`INSUFFICIENT_CREDITS`) |

### Créditos por consulta típica

Sale de la descripción de cada herramienta de OpenSEO en Claude y del documento de costos del repositorio oficial (specs/0004), revisados el 17-oct-2026. Son estimados: el costo final lo muestra OpenSEO.

| Herramienta | Para qué | Créditos | En US$ |
|---|---|---|---|
| `research_keywords` | Ideas de palabras con volumen, dificultad y costo por clic, desde 1 a 5 temas (semillas) | ~54 por semilla con 150 resultados (hasta ~95 más si el tema es raro y necesita una segunda búsqueda) | ~US$0.05 por semilla |
| `research_keywords` con `locationName` | Volumen de una ciudad o región | ~116 más por semilla | ~US$0.12 más |
| `get_keyword_metrics` | Medir una lista que ya tienes (del autocompletado o del curso 13) | ~26 por 100 palabras; ~103 por 700 | ~US$0.03 por 100 |
| `get_serp_results` | Ver quién sale en los primeros 20 resultados de Google | ~5 por palabra | ~US$0.005 |
| `get_domain_overview` | Tráfico estimado de una web (la del alumno o un competidor) | ~100 a 300 | ~US$0.10 a 0.30 |
| `includeClickstreamData: true` | Separa plurales y variantes que Google junta | dobla el costo de la consulta | |
| Países con datos de Google Ads (por ejemplo República Dominicana) | Sin dificultad ni intención | ~96 fijos por consulta | ~US$0.10 |

**Sin créditos:** `whoami` (cuenta y saldo), `list_projects`, `create_project`, `save_keywords`, `list_saved_keywords`, `search_serp_locations`.

### Costo estimado por curso

Con las consultas que hace cada agente en una corrida normal. Todo cabe en los US$10 de créditos del mes.

| Curso | Qué mide | Consultas típicas | Créditos | US$ |
|---|---|---|---|---|
| 03 Tu cliente y competencia | Estudio de mercado | 3 semillas + medir hasta 100 frases | ~190 | ~US$0.20 |
| 08 Tu negocio en Google | Palabras de la descripción, en tu ciudad | 2 semillas + 2 con ciudad + medir la lista | ~370 | ~US$0.40 |
| 09 Tus redes y marca personal | Ideas de publicaciones | 2 semillas + medir la lista | ~140 | ~US$0.15 |
| 10 Tus videos | Palabras del texto de publicación | medir hasta 100 frases (1 semilla si hace falta) | ~26 a 80 | ~US$0.03 a 0.08 |
| 11 Tus miniaturas y portadas | Título del video | medir hasta 100 frases | ~26 | ~US$0.03 |
| 12 Tu blog | Banco de 10 temas | 3 semillas + medir la lista + 1 SERP por artículo | ~190 | ~US$0.20 |
| 13 Tu SEO | Palabras clave y página | 5 semillas + 2 mediciones + 5 SERP (más ~100 a 300 si revisa el tráfico de su web) | ~350 a 650 | ~US$0.35 a 0.65 |
| 15 Tus anuncios | Palabras de compra y costo por clic | 2 semillas + medir 20 palabras | ~140 | ~US$0.15 |
| 16 Tus ventas y WhatsApp | Preguntas frecuentes | 1 semilla | ~54 | ~US$0.05 |
| 18 Tus infoproductos | Validación con la demanda | 2 semillas + medir la lista | ~140 | ~US$0.15 |
| **Los 10 cursos** | | | **~1,600 a 2,000** | **~US$1.60 a 2.00** |

La prueba gratis (US$0.50) alcanza para uno o dos cursos. Para hacer todos, el alumno necesita el Base Plan (US$10 al mes).

## Crear la cuenta (lo hace el alumno)

1. Entra a **app.openseo.so/sign-up** (en openseo.so, botón **Get Started**) y crea tu cuenta. Recibes US$0.50 de prueba.
2. Para seguir después de la prueba, suscríbete al **Base Plan** (US$10 al mes, con US$10 en créditos). El pago lo haces tú en la página de OpenSEO.
3. Tu tope: son los créditos del mes más lo que recargues. Cada agente además te muestra el costo de cada consulta y espera tu "sí".

## Conectar OpenSEO con Claude

**Claude Desktop, pestaña Code (el camino del curso 02):** conector propio, igual que fal.
1. **Customize > Connectors** (si no lo ves, busca Connectors en Settings).
2. **Add** (o **+**) > **Add custom connector**.
3. Nombre: `openseo`. URL: `https://app.openseo.so/mcp`.
4. Aprueba el inicio de sesión de OpenSEO en el navegador.
5. En Code, al lado del cuadro de texto: **+ > Connectors** y revisa que openseo esté encendido.

**Con las habilidades de OpenSEO incluidas (opcional, plan pago de Claude):** en **Customize > Cowork > Plugins**, **Add marketplace > Add from a repository**, escribe `https://github.com/every-app/open-seo`, instala **OpenSEO** e inicia sesión. Si ya tienes el conector, quítalo en Customize > Connectors para no tenerlo dos veces.

**Claude Code en una terminal (opcional):**
```
claude mcp add --transport http --scope user openseo https://app.openseo.so/mcp
```
O como plugin: `/plugin marketplace add every-app/open-seo` y `/plugin install openseo@openseo`. Después `/mcp` para aprobar el inicio de sesión.

Fuentes: openseo.so/docs/mcp y openseo.so/docs/claude-code-plugin (17-oct-2026).

**Prueba de "listo" (no gasta créditos):**
```
Revisa mi cuenta de OpenSEO y dime cuántos créditos me quedan
```
El agente usa `whoami`. Si responde con tu correo y tu saldo, quedó conectado.

## Cómo lo usa cada agente

1. **Revisa la conexión sin gastar:** `whoami`. Si no está, ofrece el paso 7b del curso 02 y, mientras tanto, el plan B (`autocompletado.py`), diciendo qué se pierde.
2. **Proyecto:** `list_projects`. Si no hay uno del negocio, `create_project` con el nombre del negocio, su web si tiene y el mercado del país (`locationCode` y `languageCode` "es"). No gasta créditos.
3. **Antes de cada consulta paga:** herramienta, cuántas semillas o palabras, créditos y US$ estimados. Espera un "sí" explícito. Nunca consulta en lote ni reintenta sin preguntar.
4. **Orden de trabajo:**
   a. `research_keywords` con 1 a 5 temas cortos (1 a 3 palabras) del negocio, en el país del alumno.
   b. `autocompletado.py` para sumar frases y preguntas que no salieron (gratis).
   c. `get_keyword_metrics` para medir en una sola llamada todas las frases elegidas (hasta 700).
   d. Volumen de ciudad (`locationName`, buscado antes con `search_serp_locations`) solo si el negocio atiende en una ciudad y el volumen del país no sirve para decidir.
5. **Cómo mostrar el dato:** "búsquedas al mes en <país> (OpenSEO, <fecha>)". Si una frase sale sin volumen o en 0, dilo así: "sin búsquedas medidas en <país>". No se suman volúmenes de variantes parecidas.
6. **Guarda las palabras elegidas** con `save_keywords` (sin créditos) para que los cursos siguientes las lean sin volver a pagar.
7. **Anota el gasto** en "Gastos de IA" del archivo del negocio: fecha, curso, herramienta, créditos y US$ (1,000 créditos = US$1). Al final pide al alumno que confirme el saldo con "¿cuántos créditos me quedan en OpenSEO?".

## Códigos de país (locationCode)

| País | Código | | País | Código |
|---|---|---|---|---|
| Argentina | 2032 | | México | 2484 |
| Bolivia | 2068 | | Panamá | 2591 |
| Chile | 2152 | | Paraguay | 2600 |
| Colombia | 2170 | | Perú | 2604 |
| Costa Rica | 2188 | | República Dominicana | 2214 (datos de Google Ads) |
| Ecuador | 2218 | | Uruguay | 2858 |
| El Salvador | 2222 | | Venezuela | 2862 |
| España | 2724 | | Estados Unidos | 2840 |
| Guatemala | 2320 | | | |

Idioma: `languageCode` "es". Fuente: `src/shared/keyword-locations.ts` del repositorio oficial (17-oct-2026).

## Lo que no hace el agente

- No crea la cuenta, no suscribe, no compra créditos ni toca la facturación. Eso lo hace el alumno en openseo.so.
- No pide ni guarda claves de OpenSEO. Si el alumno pega una clave en el chat, le dice que la borre en Settings > API keys y cree otra.
- No escribe un volumen que no salga de OpenSEO o de otra fuente citada.
