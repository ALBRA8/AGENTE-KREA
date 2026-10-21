"""Arma la página de venta corta del infoproducto (US$0): texto para copiar, vista previa con tu marca y vista en celular.

Uso:  python pagina_venta.py infoproducto.json carpeta/

Crea en la carpeta:
  pagina-de-venta.txt          todos los campos en el orden en que se pegan en la herramienta (Hotmart, Gumroad,
                               Systeme.io, Carrd, Canva u otra) + el texto para publicar el episodio o la invitación
  pagina-de-venta.html         vista previa con tus colores y tipografías (estilo premium, como la landing del curso 07)
  pagina-de-venta-movil.png    la página a 390 px de ancho, sin marco
  pagina-de-venta-pc.png       la primera pantalla a 1280 px
Diseño (ESTANDAR-VISUAL-ENTREGABLES.md, landing): primera pantalla con la portada grande, titular de 48 a 64 px en la
tipografía de títulos, una línea de subtítulo y un solo botón; secciones con aire; precio en la tipografía de títulos;
preguntas sin cajas; botón de esquina recta. Sin sombras, degradados ni estrellas.
JSON: pagina_venta {titulo, subtitulo, para_quien [..], problema, que_incluye [..], sobre_ti, precios [{producto, precio,
      nota}], garantia, preguntas [{p, r}], boton {texto, enlace}}, portada (usa la imagen de portada si ya existe)
Varios precios: cada producto o plan va con su precio. Nunca un precio promedio.
"""
import sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import E, leer_json, marca, parrafos, resaltar  # noqa: E402
from render import render  # noqa: E402
import estilo_premium as ep  # noqa: E402


def texto_para_copiar(d):
    pv = d.get("pagina_venta", {})
    L = []

    def campo(nombre, valor):
        if valor:
            L.append(f"== {nombre} ==\n{valor}\n")
    campo("1. Título", pv.get("titulo"))
    campo("2. Subtítulo", pv.get("subtitulo"))
    campo("3. Para quién es", "\n".join(f"- {x}" for x in pv.get("para_quien", [])))
    campo("4. El problema que resuelve", pv.get("problema"))
    campo("5. Qué incluye", "\n".join(f"- {x}" for x in pv.get("que_incluye", [])))
    campo("6. Sobre ti", pv.get("sobre_ti"))
    campo("7. Precio", "\n".join(f"- {p.get('producto', '')}: {p.get('precio', '')}" + (f" ({p['nota']})" if p.get("nota") else "")
                                for p in pv.get("precios", [])))
    campo("8. Garantía o condición", pv.get("garantia"))
    campo("9. Preguntas frecuentes", "\n\n".join(f"P: {q.get('p', '')}\nR: {q.get('r', '')}" for q in pv.get("preguntas", [])))
    b = pv.get("boton", {})
    campo("10. Botón", f"Texto: {b.get('texto', '')}\nEnlace: {b.get('enlace', 'PENDIENTE')}" if b else "")
    pub = d.get("guion", {}).get("publicar")
    if pub:
        nombre = {"podcast": "Título y descripción del episodio", "webinar": "Invitación al webinar",
                  "minicurso": "Título y descripción de la lección"}.get(d.get("formato"), "Para publicar")
        campo(f"Extra. {nombre}", f"{pub.get('titulo', '')}\n\n{pub.get('descripcion', '')}")
    cab = (f"PÁGINA DE VENTA · {d.get('titulo', '')}\n"
           "Copia cada campo en tu herramienta en este orden. Antes de publicar, cambia todo [confirmar] y todo PENDIENTE.\n\n")
    return cab + "\n".join(L)


def css_venta(pm):
    return f"""
body{{background:var(--claro)}}
.venta{{max-width:1200px;margin:0 auto;padding:0 64px}}
.venta.movil{{max-width:390px;padding:0 24px}}
.cab{{display:flex;justify-content:space-between;align-items:center;padding:28px 0;border-bottom:0.5pt solid var(--gris15)}}
.wordmark{{font-family:var(--f-titulos);font-weight:var(--peso-titulos);font-size:22px;line-height:1;padding-bottom:5px;border-bottom:1.5px solid var(--oscuro)}}
.heroe{{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:64px;align-items:center;padding:88px 0 112px}}
.movil .heroe{{grid-template-columns:1fr;gap:40px;padding:48px 0 72px}}
.heroe h1{{font-size:60px;line-height:1.08;letter-spacing:-0.02em;margin:0 0 24px;max-width:13ch}}
.movil .heroe h1{{font-size:42px}}
.heroe .sub{{font-size:21px;line-height:1.45;max-width:30ch;margin:0 0 36px}}
.movil .heroe .sub{{font-size:18px}}
.heroe .tapa img{{display:block;width:100%;max-width:380px;margin-left:auto}}
.movil .heroe .tapa{{order:-1}} .movil .heroe .tapa img{{max-width:250px;margin:0}}
.precio-corto{{display:block;margin-top:14px}}
.bloque{{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:64px;padding:96px 0;border-top:0.5pt solid var(--gris15)}}
.movil .bloque{{grid-template-columns:1fr;gap:20px;padding:56px 0}}
.bloque h2{{font-size:32px;line-height:1.15;margin:0}}
.movil .bloque h2{{font-size:28px}}
.bloque p{{font-size:18px;max-width:640px}}
ul.rayas{{list-style:none;margin:0;padding:0;max-width:640px}}
ul.rayas li{{font-size:18px;padding:14px 0;border-top:0.5pt solid var(--gris15)}}
ul.rayas li:last-child{{border-bottom:0.5pt solid var(--gris15)}}
ol.incluye{{list-style:none;margin:0;padding:0;max-width:640px}}
ol.incluye li{{display:grid;grid-template-columns:44px 1fr;font-size:18px;padding:14px 0;border-top:0.5pt solid var(--gris15)}}
ol.incluye li:last-child{{border-bottom:0.5pt solid var(--gris15)}}
ol.incluye .n{{color:var(--acento-texto);font-size:12px;letter-spacing:0.08em;font-weight:500;padding-top:5px}}
.precios .precio{{padding:8px 0 24px;border-bottom:0.5pt solid var(--gris15);margin-bottom:24px}}
.precios .valor{{font-family:var(--f-titulos);font-weight:var(--peso-titulos);font-size:64px;line-height:1;letter-spacing:-0.02em;margin:10px 0 8px}}
.precios .prod{{font-size:18px}}
.faq h3{{font-size:20px;margin:0 0 8px;font-family:var(--f-titulos);font-weight:var(--peso-titulos)}}
.faq .q{{padding:20px 0;border-top:0.5pt solid var(--gris15);max-width:640px}}
.faq .q p{{font-size:17px;margin:0}}
.pie-venta{{padding:40px 0 56px;border-top:0.5pt solid var(--gris15);display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}}
.boton{{font-size:17px;padding:18px 30px}}
.pend{{display:inline-block;margin-left:12px;font-size:13px;color:var(--gris60)}}
.movil .pend{{display:block;margin:10px 0 0}}
mark{{background:none;color:var(--acento-texto);font-weight:600;border-bottom:1px dashed var(--acento-texto);padding:0}}
"""


def html_pagina(d, k, movil=False):
    pm = k["ep"]
    pv = d.get("pagina_venta", {})
    neg = d.get("negocio", {})
    b = pv.get("boton", {})
    enlace = b.get("enlace", "")
    href = enlace if enlace.startswith("http") else "#"
    pend = '<span class="pend"><mark>Enlace PENDIENTE</mark>: cámbialo antes de publicar</span>' if b and not enlace.startswith("http") else ""
    boton = (f'<a class="boton" href="{E(href)}">{resaltar(b.get("texto", "Lo quiero"))}</a>{pend}') if b else ""
    precios = pv.get("precios", [])
    precio_corto = (f'<span class="etiqueta precio-corto">{resaltar(precios[0].get("producto", ""))} · {resaltar(precios[0].get("precio", ""))}</span>'
                    if len(precios) == 1 else "")
    img = ""
    port = d.get("portada", {}).get("archivo")
    if port and Path(port).exists():
        img = f'<div class="tapa"><img src="{Path(port).resolve().as_uri()}" alt="Portada de {E(d.get("titulo", ""))}"></div>'

    def bloque(titulo, cuerpo, etiqueta=""):
        e = f'<div class="etiqueta">{E(etiqueta)}</div>' if etiqueta else ""
        return f'<section class="bloque"><div>{e}<h2>{E(titulo)}</h2></div><div>{cuerpo}</div></section>'
    secciones = []
    if pv.get("para_quien"):
        secciones.append(bloque("Es para ti si", "<ul class=rayas>" + "".join(f"<li>{resaltar(x)}</li>" for x in pv["para_quien"]) + "</ul>"))
    if pv.get("problema"):
        secciones.append(bloque("El problema", parrafos(pv["problema"])))
    if pv.get("que_incluye"):
        secciones.append(bloque("Qué incluye", "<ol class=incluye>" + "".join(
            f'<li><span class="n">{i:02d}</span><span>{resaltar(x)}</span></li>' for i, x in enumerate(pv["que_incluye"], 1)) + "</ol>"))
    if pv.get("sobre_ti"):
        secciones.append(bloque("Quién te lo enseña", parrafos(pv["sobre_ti"])))
    if precios:
        filas = "".join(f'<div class="precio"><div class="prod">{resaltar(p.get("producto", ""))}</div>'
                        f'<div class="valor">{resaltar(p.get("precio", ""))}</div>'
                        f'{"<p class=nota>" + resaltar(p["nota"]) + "</p>" if p.get("nota") else ""}</div>' for p in precios)
        gar = f'<p>{resaltar(pv["garantia"])}</p>' if pv.get("garantia") else ""
        secciones.append(bloque("Precio", f'<div class="precios">{filas}</div>{gar}{boton}'))
    if pv.get("preguntas"):
        secciones.append(bloque("Preguntas frecuentes", '<div class="faq">' + "".join(
            f'<div class="q"><h3>{resaltar(q.get("p", ""))}</h3>{parrafos(q.get("r", ""))}</div>' for q in pv["preguntas"]) + "</div>"))
    ilustrativa = d.get("portada", {}).get("ilustrativa") or d.get("portada", {}).get("imagen")
    nota_img = '<span class="nota">Portada con imagen ilustrativa.</span>' if ilustrativa else ""
    cuerpo = f"""<div class="venta{' movil' if movil else ''}">
<header class="cab"><span class="wordmark">{E(d.get("portada", {}).get("wordmark") or neg.get("nombre", ""))}</span><span class="etiqueta">{E(d.get("portada", {}).get("etiqueta", ""))}</span></header>
<section class="heroe"><div><h1>{resaltar(pv.get("titulo", ""))}</h1><p class="sub">{resaltar(pv.get("subtitulo", ""))}</p>{boton}{precio_corto}</div>{img}</section>
{"".join(secciones)}
<footer class="pie-venta"><span class="etiqueta">{E(neg.get("nombre", ""))}</span><span class="nota">{resaltar(neg.get("contacto", ""))}</span>{nota_img}</footer>
</div>"""
    return ep.documento(cuerpo, pm, titulo=pv.get("titulo", ""), formato="pantalla").replace(
        "</style>", css_venta(pm) + "</style>", 1)


def armar_pagina(d, carpeta):
    k = marca(d)
    c = Path(carpeta)
    c.mkdir(parents=True, exist_ok=True)
    (c / "pagina-de-venta.txt").write_text(texto_para_copiar(d), encoding="utf-8")
    (c / "pagina-de-venta.html").write_text(html_pagina(d, k), encoding="utf-8")
    tmp = Path(tempfile.mkdtemp())
    (tmp / "movil.html").write_text(html_pagina(d, k, movil=True), encoding="utf-8")
    # El navegador sin ventana no baja de unos 500 px: se arma la versión de celular a 390 px y se recorta sin marco.
    movil = c / "pagina-de-venta-movil.png"
    render(tmp / "movil.html", movil, 600, 6000, espera_ms=6000)
    render(c / "pagina-de-venta.html", c / "pagina-de-venta-pc.png", 1280, 860, espera_ms=6000)
    try:
        from PIL import Image, ImageChops
        im = Image.open(movil).convert("RGB")
        x0 = (im.width - 390) // 2
        im = im.crop((x0, 0, x0 + 390, im.height))
        fondo = Image.new("RGB", im.size, k["ep"]["claro"])
        caja = ImageChops.difference(im, fondo).getbbox()
        if caja:
            im = im.crop((0, 0, im.width, min(im.height, caja[3] + 24)))
        im.save(movil)
    except ImportError:
        pass
    print(f"página de venta -> {c / 'pagina-de-venta.txt'} · .html · -movil.png · -pc.png")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    armar_pagina(leer_json(sys.argv[1]), sys.argv[2])
