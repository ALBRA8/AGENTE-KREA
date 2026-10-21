# Guía del oficio: infoproductos para un negocio

16 de octubre de 2026. Lo que el agente necesita saber para elegir el formato, validarlo, escribirlo y venderlo. Léela antes de empezar.

## 1. Qué es un infoproducto aquí

Un producto hecho de lo que el dueño sabe: un ebook, un curso online corto (minicurso), un webinar (clase en vivo por internet) o un podcast. En un negocio casi siempre cumple una de dos funciones:

- **Atraer:** gratis a cambio del correo (imán). Junta personas interesadas y las lleva al producto o servicio principal.
- **Vender:** un producto chico pagado (por ejemplo, un minicurso) que se vende sin que el dueño tenga que estar.

Pregunta siempre **qué vendes después**. Un infoproducto sin siguiente paso se lee y se olvida.

## 2. Elegir el formato (elemento 1)

| Formato | Le conviene si | No le conviene si | Esfuerzo del dueño | Atrae o vende |
|---|---|---|---|---|
| Ebook | Escribe con soltura o tiene respuestas que repite por WhatsApp; poco tiempo | Su tema se entiende solo viendo (técnica con las manos) y no tiene fotos de los pasos | Se escribe una vez | Atrae muy bien (gratis); vende poco solo |
| Minicurso | El tema se aprende viendo cómo se hace; tiene celular y algo de luz | No quiere salir en cámara (puede ser pantalla o manos) | Grabar y editar | Vende mejor (pagado) |
| Webinar | Sabe explicar en vivo y vende algo al final (taller, servicio) | No tiene a quién invitar todavía | Una fecha, una hora en vivo | Atrae y vende en la misma sesión |
| Podcast | Habla mejor de lo que escribe; su cliente escucha mientras hace otra cosa | Necesita mostrar imágenes; quiere resultados rápidos | Un episodio por semana, constante | Atrae de a poco, construye confianza |

Criterios en este orden:
1. **Horas por semana** que tiene el dueño (pregúntalas). Un podcast semanal pide constancia; un ebook se hace una vez.
2. **Cómo consume su cliente ideal** (lee, mira, escucha), según el archivo del negocio.
3. **Lo que ya sabe hacer** (escribir, hablar, grabar).
4. **Si atrae o vende** y qué viene después.

**Fotos en el ebook:** el PDF admite las fotos del alumno, con pie, ajustadas al ancho de la hoja. El agente no las saca ni las inventa. Si el argumento para elegir el ebook es "paso a paso con fotos", confirma antes que el alumno las tiene o las puede sacar; si no, dilo al comparar formatos.

Recomienda uno. Si duda entre dos, primero el que mejor cabe en sus horas. Un mismo contenido sirve después en otro formato (el ebook se vuelve guion del webinar).

**Promesa:** una frase de 6 a 25 palabras con el resultado concreto para el cliente ideal. "Arma tu primer huerto en el balcón y cosecha tus primeras hierbas." Sin plazos ni cifras que el dueño no pueda sostener.

**Precio:** lo dice el dueño. Si vende varias cosas, cada una con su precio. Nunca un precio promedio.

## 3. Validar con la demanda (elemento 2)

1. Si **ya tiene clientes**, empieza por ellos: escribe un mensaje corto para preguntarles (con permiso, uno a uno por el canal donde ya conversan) qué les gustaría aprender y en qué formato. Una lista de espera o una preventa con 5 a 10 personas vale más que cualquier búsqueda.
2. Mide primero con OpenSEO (`GUIA-OPENSEO.md`) cuántas personas buscan el tema al mes en el país del alumno: `research_keywords` con 1 o 2 temas cortos y `get_keyword_metrics` para las preguntas y señales de formato que elijas. Después corre `autocompletado.py` con los mismos temas cortos (2 o 3 palabras) en el país del alumno, con `--expandir`, para sumar preguntas. Agrega la ciudad después, en una segunda corrida sin `--expandir`. Si un tema trae 0 frases, acórtalo. Para las señales de formato, una corrida corta sin `--expandir` con "<tema> pdf", "curso de <tema>", "podcast de <tema>" y "webinar de <tema>".
3. Usa `--excluir` (palabras separadas por | o por coma) para sacar otros países y ruido. En la prueba con "huerto en casa" (Ecuador) salieron avisos inmobiliarios de España ("huerto con casa en venta en alzira"): súmalos a `--excluir` ("venta en", nombres de ciudades ajenas). Las frases que el script separa como "posibles nombres" son de otros negocios o autores ("un huerto en casa douglas candelario pdf"): no van en los textos del alumno.
   Listas de `--excluir` por país, separadas por comas (súmalas siempre y agrega el ruido nuevo que aparezca). El autocompletado mezcla países aunque pongas `--pais`:

   | País del alumno | `--excluir` |
   |---|---|
   | España (es) | `mexico, cdmx, monterrey, guadalajara, argentina, buenos aires, mar del plata, cordoba argentina, colombia, bogota, medellin, chile, santiago de chile, peru, office depot, officemax, walmart, liverpool, coppel, mercado libre, infantozzi, mosca` |
   | México (mx) | `españa, madrid, barcelona, sevilla, valencia, argentina, buenos aires, colombia, bogota, chile, peru, el corte ingles, carrefour` |
   | Perú (pe) | `españa, madrid, barcelona, mexico, cdmx, argentina, buenos aires, colombia, bogota, chile, santiago de chile, office depot` |
   | Colombia (co) | `españa, madrid, mexico, cdmx, argentina, buenos aires, chile, peru, office depot` |
   | Chile (cl) | `españa, madrid, mexico, cdmx, argentina, buenos aires, colombia, bogota, peru, office depot` |
   | Argentina (ar) | `españa, madrid, mexico, cdmx, colombia, bogota, chile, peru, office depot` |
   | Ecuador (ec) | `españa, madrid, alzira, venta en, mexico, cdmx, argentina, buenos aires, colombia, chile, peru` |

   Nunca excluyas la ciudad o el país del alumno. Tampoco "lima" fuera de Perú: también es la herramienta para lijar o limar. "Posibles nombres" a veces trae frases genéricas ("curso de pintura en ceramica online"): úsalas solo como preguntas.
4. Corre `validar_demanda.py`: agrupa preguntas, señales de formato (pdf, curso, video, podcast), compra y gratis, y da un veredicto orientativo.
5. Busca en la web 3 a 5 infoproductos parecidos (en su país o en español) con su precio y su enlace. Sirven para ver qué ya existe y qué falta, nunca para copiar.

Explica al alumno: OpenSEO dice **cuántas personas buscan** cada frase al mes; el autocompletado solo dice **qué tanto se repite una búsqueda**, sin el número. Una señal de formato en 0 (por ejemplo, nadie escribe "podcast de huertos") no descarta el formato: el formato se decide por cómo consume el cliente, y eso se pregunta.

Veredicto: **avanzar** (hay preguntas concretas y lo confirman los clientes), **ajustar el tema** (más amplio o con las palabras de los clientes) o **cambiar el formato**.

## 4. Estructuras (elementos 3 y 4)

### Ebook

- Imán gratis: 3 a 7 capítulos, unas 1,500 a 8,000 palabras. Pagado: más largo y más profundo, pero solo si el dueño lo puede sostener.
- Cada capítulo responde una pregunta de la validación. Orden: lo que se hace primero va primero.
- Estructura de un capítulo: título que dice qué logra el lector · "en este capítulo" (1 o 2 frases) · explicación corta · pasos numerados · un ejemplo o tabla · un consejo del oficio (recuadro) · ejercicio para aplicar.
- Cierre: resumen de lo aprendido y **un solo** siguiente paso con su enlace (el producto o servicio principal).
- Sobre el autor: 2 a 4 frases, en la voz elegida.
- Página de derechos: la arma el script. Si el tema toca salud, dinero o leyes, agrega un aviso en `ebook.aviso` y recomienda consultar a un profesional.

### Curso online (minicurso)

- 3 a 6 módulos, 1 a 4 lecciones por módulo, lecciones de 3 a 15 minutos.
- El agente entrega el índice completo y el guion de la **primera lección** con su hoja de trabajo. Las demás lecciones se escriben igual cuando el alumno las pida.
- Guion de lección: gancho (qué vas a poder hacer al final) · paso a paso · error común · tarea · qué viene en la siguiente lección.

### Webinar

- 45 a 60 minutos. Bloques sugeridos: bienvenida (5) · historia o problema (5) · contenido en 3 enseñanzas (25 a 30) · oferta (5 a 8) · preguntas (10).
- La oferta es honesta: qué incluye, precio real, plazo real. Nada de cupos o plazos inventados.
- **Fecha:** revisa feriados y fechas especiales del país con la fuente oficial (boletín o sitio del gobierno) y anótala en `guion.fecha_fuente`. No pongas una fecha en semana de feriado sin avisar. `revisar_infoproducto.py` avisa si cae en Año Nuevo, 1 de mayo, 24, 25 o 31 de diciembre.
- Texto de invitación en `guion.publicar`.

### Podcast

- Episodios de 5 a 30 minutos para empezar. Temporada de 4 a 10 episodios.
- Guion del episodio: gancho (los primeros segundos) · presentación · tema en 2 o 3 partes · cierre con una tarea y el siguiente paso.
- Escribe para el oído: frases cortas, una idea por frase, repite lo importante al final.
- Descripción del episodio en `guion.publicar`: qué aprende, la tarea, el enlace. Guías de podcasting (no oficiales, revisadas en octubre de 2026) dicen que Apple Podcasts corta en 4,000 caracteres y que en el celular se ven unos 150 antes del "más": pon lo importante primero. Si el alumno necesita el límite exacto, búscalo en la ayuda oficial de su plataforma.
- El agente no genera audio. Si el alumno pregunta por voces con IA, dile que lo grabe con su voz (es lo que genera confianza) y que se ve en otro momento.

### Duración de un guion

`guion.py` y el revisor estiman los minutos con **140 palabras por minuto** (velocidad de conversación tranquila, valor aproximado). Pide al alumno que lea un bloque en voz alta con cronómetro y cambia `palabras_por_minuto` si habla más rápido o más lento.

## 5. Escribir el contenido

- Tono de la marca (archivo del negocio). Español neutro de tú. Frases cortas.
- **Una sola voz** en todo el infoproducto: "yo" (el dueño) o "la marca" (nosotros). Ponla en `voz`. El revisor avisa si se mezclan.
- Sin guiones largos, sin frases de contraste, sin voseo.
- **Tú o vosotros (España):** pregunta una vez si el alumno le habla a su público de tú o de vosotros y ponlo en `trato`. Sostén la elección en todo el infoproducto. El revisor marca OJO la forma que no corresponde.
- **Cifras con origen:** todo número, porcentaje, precio, plazo, frecuencia ("cada semana") o resultado viene del alumno o de una fuente citada, también en palabras ("medio centímetro", "dos días"). Anótalo en `origenes` ({cifra, origen, enlace}): sale OK en la revisión. La página "Fuentes de las cifras" del PDF imprime solo las cifras que aparecen en el texto del ebook, con su `origen` tal cual: escríbelo para el lector. Las notas internas (lo dijo el alumno, sus horas por semana, cifras de la página de venta) quedan en el archivo del negocio. `"en_pdf": false` saca una cifra del PDF. Si no tiene origen, sácala o ponla como [confirmar].
- **Dato técnico sin fuente oficial:** si el fabricante o una fuente oficial no dan la cifra (tiempos de secado, por ejemplo), sale como experiencia del dueño y el texto remite al envase o al fabricante. La seguridad siempre con fuente oficial del país (en España, el INSST).
- Ningún testimonio, caso o resultado que el alumno no haya dado. Un testimonio solo va con permiso del cliente.
- No copies textos de otros libros, cursos o podcasts. Una cita corta solo con su autor.

## 6. Portada (elemento 5)

Tamaños (verificados en octubre de 2026):

| Formato | Tamaño | Fuente |
|---|---|---|
| Ebook | 1600 x 2560 px (alto 1,6 veces el ancho), JPG o TIFF, RGB | Ayuda de Kindle Direct Publishing: kdp.amazon.com/help/topic/G200645690 |
| Podcast | 3000 x 3000 px cuadrada (mínimo 1,400 x 1,400), JPG o PNG sin transparencia; deja libre el quinto de abajo | Apple Podcasts: podcasters.apple.com/support/artwork-requirements |
| Webinar | 1920 x 1080 px (16:9) | Medida estándar de video y diapositivas |
| Minicurso | 1280 x 720 px (16:9) | Miniatura de video estándar |

Reglas:
- La portada vende en una lista chica. El título se tiene que leer en la miniatura (`portada-miniatura.png`, 160 px de ancho en ebook). Título de 8 palabras o menos.
- El texto siempre lo pone `portada.py` con la fuente real de la marca. Si el alumno pide un fondo con IA, el modelo genera **solo la imagen, sin texto** (ver `GUIA-MODELOS.md`).
- Primero la portada con código: pone el título exacto con la tipografía de la marca y se lee en la miniatura, que es lo que más pesa. Si el tema se vende mejor con una imagen o el alumno la pide, muestra al lado la opción con fondo de IA (el modelo que ganó la prueba, en `GUIA-MODELOS.md`), con su costo, y recomienda la que se vea mejor en la miniatura.
- **Colores:** con 3 colores de marca, `principal` = el más fuerte, `fondo` = el más claro, `texto` = el más oscuro y `acento` vacío (el script deriva un tono de apoyo del principal y lo avisa). El acento igual al principal deja los adornos invisibles.
- El pie de la portada lleva `negocio.autor` y, debajo, `negocio.nombre`. El nombre del negocio siempre sale.

## 7. Página de venta corta (elemento 6)

Orden: título (el resultado) · subtítulo (para quién y cómo) · botón · para quién es (3 puntos) · el problema (2 o 3 frases con las palabras del cliente) · qué incluye (3 a 8 puntos, cada uno existe en el producto) · quién lo enseña · precio por producto · garantía o condición real · botón · preguntas frecuentes (3 a 6, las objeciones del cliente ideal).

- Un solo botón (repetido arriba y abajo), texto corto (30 caracteres o menos).
- Si el enlace aún no existe: `"enlace": "PENDIENTE"`. Sale marcado en rojo y el revisor lo avisa. Nunca inventes un enlace.
- Si es gratis a cambio del correo, la condición dice que puede darse de baja cuando quiera.
- `pagina-de-venta.txt` trae los campos en el orden en que se pegan en la herramienta (Hotmart, Gumroad, Systeme.io, Carrd, Canva u otra). No afirmes comisiones ni funciones de una plataforma sin mirar su ayuda oficial.

## 8. Errores comunes

1. Elegir el formato que está de moda y no el que cabe en las horas del dueño.
2. Escribir el ebook antes de validar: nadie lo busca o nadie lo pidió.
3. Un ebook sin siguiente paso: el lector termina y no sabe qué hacer.
4. Prometer resultados ("vende el doble", "baja 5 kilos") sin prueba.
5. Portada con el título chico o en una letra que no es de la marca.
6. Webinar en una semana de feriado.
7. Página de venta con tres botones distintos o con cosas en "qué incluye" que el producto no trae.
8. Mezclar "yo" y "nosotros".

## 9. Ejemplos cortos

- Promesa floja: "Todo sobre huertos." Mejor: "Arma tu primer huerto en el balcón y cosecha tus primeras hierbas."
- Título de capítulo flojo: "Introducción a la luz." Mejor: "Mira tu balcón antes de comprar nada."
- Cifra sin origen: "El 80% de los huertos fallan por la luz." Mejor: sacarla, o citar la fuente, o "[confirmar: dato de dónde]".
- Botón flojo: "Enviar." Mejor: "Quiero la guía gratis."
