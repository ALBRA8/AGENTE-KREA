# Guía de modelos para la portada (fal.ai)

Precios de octubre de 2026 (panel de fal, 17-oct-2026). Cambian seguido: antes de recomendar, pide a fal el modelo recomendado para la tarea y su precio, y dilo como estimado.

**Ruta recomendada: portada con código (`portada.py`) y una foto de GPT Image 2 en calidad alta** (~US$0.25, un intento, con el sí del alumno). El código pone el título con la fuente de la marca sobre el color oscuro liso y la foto ocupa la mitad de abajo. Plan B: la portada solo con código, US$0, sin foto.

| Momento | Modelo (endpoint) | Costo aprox. | Por qué |
|---|---|---|---|
| **Portada completa con el título escrito por la IA (si el alumno lo pide)** | **GPT Image 2, calidad alta** (`openai/gpt-image-2`, `quality: "high"`, `image_size` 1024 x 1536) | ~US$0.25 por imagen (estimado; fal lo cobra en unidades) | **La mejor portada en las dos pruebas del 17-oct** (`prueba-comparativa/`, Barro y Lumbre y Mesa Clara): título correcto, paleta como se pidió y el título que mejor se lee en una lista de tienda. No usa la fuente de la marca: revisa letra por letra |
| **Foto de portada sin texto (para `portada.py`, la ruta recomendada)** y fotos de apertura de capítulo | GPT Image 2, calidad alta (mismo endpoint). Portada ebook: `image_size` 1600 x 1376; apertura de capítulo: 1536 x 1024 | ~US$0.25 por imagen (estimado) | También ganó la prueba de fondos de los cursos 06 y 17. En la corrida de Mesa Clara: una foto de portada y dos de apertura, todas al primer intento |
| Opción más barata (si el alumno lo pide) | Nano Banana Pro (`fal-ai/nano-banana-pro`) | US$0.15 por imagen | Escribió bien el título; en la prueba de Mesa Clara metió la foto en un recuadro y a 60 x 90 cuesta leerlo |
| Borrador barato | Nano Banana 2.1 (`google/nano-banana-2.1`) | ~US$0.08 por imagen 1K (estimado conservador) | Escribió bien el título; a 60 x 90 queda chico |
| Fondo con un objeto del negocio (por ejemplo, su producto) | Nano Banana 2.1 Edit (`google/nano-banana-2.1/edit`) con la foto del alumno en `image_urls` | ~US$0.08 por imagen 1K (estimado conservador) | Usa la foto real como referencia y no inventa el producto. La prueba no comparó la edición |

Ideogram 4.5 en calidad alta (`ideogram/v4.5`, ~US$0.15 estimado) también escribió bien el título, pero lo dejó chico y repitió el nombre del negocio.

## Cómo pedir el fondo

1. Si el título lo pone `portada.py`, el pedido dice **"sin texto, sin letras, sin logotipos"** y, si hay una persona, **"solo manos, sin caras"**. Si el alumno pidió que la IA escriba el título, ponlo entre comillas, exacto y con tildes, y revisa la imagen letra por letra antes de aprobarla.
2. Tamaño de la foto: 1600 x 1376 para la portada del ebook (la foto ocupa la mitad de abajo), cuadrada para podcast, 16:9 para webinar y minicurso (la foto ocupa la mitad derecha), 1536 x 1024 para aperturas de capítulo.
3. Dirección de foto: vista desde arriba o de lado, luz natural lateral, un solo material de fondo (lino, piedra, madera), el objeto ocupando un tercio a la mitad del cuadro y espacio vacío. El texto nunca va encima de la foto: va sobre el color oscuro liso.
4. Incluye los colores HEX de la marca en el pedido para que el fondo combine.
5. Revisa el texto del pedido antes de enviarlo.

## Control de costos (resumen del canon)

- Tope de gasto antes de la primera imagen: "Una portada con IA cuesta unos US$0.25 por intento con el mejor modelo de nuestra prueba (GPT Image 2), o unos US$0.08 con el más barato (estimados). ¿Cuánto quieres gastar como máximo?"
- Antes de **cada** generación: modelo, por qué, cuántas imágenes, costo estimado. Espera un "sí" explícito.
- Una imagen por vez. Nunca en lote ni reintentos sin preguntar.
- Después: "Llevas US$X de tu tope de US$Y." Anota el gasto con `guardar_en_archivo.py --gasto`.
- En `infoproducto.json` deja `portada.costo` y `portada.aprobado: true`: el revisor da ERROR si hay costo sin aprobación.
- fal cobra Nano Banana 2.1 en unidades fraccionarias (US$1 por unidad): el costo de cada imagen depende de la resolución, y `get_pricing` y `estimate_cost` no dan un precio por imagen. La página de compra de fal estima unos US$0.08 por imagen de Nano Banana 2 (US$10 = unas 125 imágenes). Por eso el agente usa **US$0.08 por imagen a 1K** como estimado conservador. El costo real puede ser menor y se mira en Settings > Usage & Billing > Usage (panel de fal, 17-oct-2026). Request History no muestra costos y el saldo tarda hasta 1 hora en actualizarse. Usa esta tabla y dilo como estimado.
