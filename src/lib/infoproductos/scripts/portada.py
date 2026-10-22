"""Arma la portada del infoproducto con código (US$0): colores y tipografías de tu marca, al tamaño de cada plataforma.

Uso:
  python portada.py infoproducto.json portada.jpg
  python portada.py infoproducto.json portada.jpg --imagen fondo.png      (foto hecha con fal.ai, sin texto)
  python portada.py infoproducto.json portada.jpg --formato podcast       (si quieres otro formato que el del JSON)

Tamaños (octubre de 2026, ver GUIA-INFOPRODUCTOS.md):
  ebook 1600 x 2560 (Kindle: alto 1,6 veces el ancho) · podcast 3000 x 3000 (Apple Podcasts, cuadrada)
  webinar 1920 x 1080 (16:9) · minicurso 1280 x 720 (miniatura de video 16:9)
Guarda JPG (sin transparencia, lo piden Kindle y Apple) si tienes Pillow; si no, PNG. Siempre crea también
<nombre>-miniatura.png al tamaño en que la gente la ve en una lista, para revisar que el título se lea.

Diseño (ESTANDAR-VISUAL-ENTREGABLES.md, ebook): fondo oscuro de la marca, título grande en la tipografía de títulos
con peso 400 o 500, alineado a la izquierda, un filete fino y el nombre del negocio. Con --imagen, la foto ocupa la
parte de abajo a sangre (o la mitad derecha en 16:9) y el texto queda sobre el color liso: sin velos ni degradados.
El texto siempre lo pone este script con la fuente real de la marca; el modelo de IA no escribe nada.

JSON (campos que usa): titulo, subtitulo, formato, negocio.autor y negocio.nombre (el nombre del negocio siempre sale),
marca.colores, marca.tipografias, marca.logo, portada: {etiqueta: "Guía práctica", imagen: "ruta"}
"""
import argparse, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import E, leer_json, marca, ruta_archivo  # noqa: E402
from contraste import ratio  # noqa: E402
from render import render  # noqa: E402

TAMANOS = {"ebook": (1600, 2560), "podcast": (3000, 3000), "webinar": (1920, 1080), "minicurso": (1280, 720)}
MINIATURA = {"ebook": 160, "podcast": 200, "webinar": 320, "minicurso": 320}


def tam_titulo(titulo, forma, con_foto=False):
    """Tamaño del título en unidades de --u (1/100 del ancho). Grande: tiene que leerse a 120 x 180."""
    n = len(titulo)
    escala = {"vertical": (15, 12.5, 10.6, 9, 7.6), "cuadrada": (12, 10, 8.4, 7.2, 6.2),
              "horizontal": (7.4, 6.4, 5.6, 4.9, 4.3)}[forma]
    for lim, tam in zip((12, 22, 36, 52), escala):
        if n <= lim:
            return tam * (0.9 if con_foto and forma != "horizontal" else 1)
    return escala[-1]


def forma_de(formato):
    return {"ebook": "vertical", "podcast": "cuadrada"}.get(formato, "horizontal")


def portada_cuerpo(d, k, formato, imagen=None):
    """HTML de la portada. Usa la unidad --u (1/100 del ancho), así sirve igual para una imagen o una hoja del PDF."""
    forma = forma_de(formato)
    pm = k["ep"]
    p = d.get("portada", {})
    titulo, sub = d.get("titulo", ""), d.get("subtitulo", "")
    neg = d.get("negocio", {})
    autor = (neg.get("autor") or "").strip()
    nombre = (neg.get("nombre") or "").strip()
    etiqueta = p.get("etiqueta", "")
    oscuro, claro = pm["oscuro"], pm["claro"]
    filete = pm["acento"] if ratio(pm["acento"], oscuro) >= 2 else claro
    gris = pm["gris60_oscuro"]
    foto = ""
    con_foto = bool(imagen and Path(imagen).exists())
    if con_foto:
        foto = f'<div class="foto" style="background-image:url(\'{Path(imagen).resolve().as_uri()}\')"></div>'
    logo = ruta_archivo(d.get("marca", {}).get("logo"), d.get("_base"))
    marca_html = (f'<img class="logo" src="{logo.as_uri()}" alt="{E(nombre)}">' if logo else
                  f'<div class="wordmark">{E(p.get("wordmark") or nombre)}</div>')
    tam = tam_titulo(titulo, forma, con_foto)
    firma = E(autor) if autor and nombre and nombre.lower() not in autor.lower() else ""
    return f"""<div class="portada {forma}{' con-foto' if con_foto else ''}" style="background:{oscuro};color:{claro}">{foto}
<div class="txt">
<div class="arriba">{marca_html}</div>
<div class="bloque">
<div class="filete" style="border-top-color:{filete}"></div>
{f'<div class="etq" style="color:{gris}">{E(etiqueta)}</div>' if etiqueta else ''}
<div class="tit" style="font-size:calc(var(--u)*{tam:.2f})">{E(titulo)}</div>
{f'<div class="sub">{E(sub)}</div>' if sub else ''}
{f'<div class="firma" style="color:{gris}">{firma}</div>' if firma else ''}
</div>
</div>
</div>"""


def portada_css(k):
    pm = k["ep"]
    return f"""
.portada{{position:relative;overflow:hidden;width:100%;height:100%;font-family:'{k["t_txt"]}',sans-serif}}
.portada .foto{{position:absolute;left:0;right:0;bottom:0;height:46%;background-size:cover;background-position:center}}
.portada.cuadrada .foto{{height:42%}}
.portada.horizontal .foto{{top:0;left:auto;width:46%;height:100%}}
.portada .txt{{position:relative;box-sizing:border-box;height:100%;display:flex;flex-direction:column;
 justify-content:space-between;padding:calc(var(--u)*10.5) calc(var(--u)*10) calc(var(--u)*10)}}
.portada.con-foto .txt{{height:54%;padding-bottom:calc(var(--u)*6)}}
.portada.cuadrada.con-foto .txt{{height:58%}}
.portada.horizontal .txt{{width:54%;height:100%;padding:calc(var(--u)*5.5) calc(var(--u)*5) calc(var(--u)*5.5) calc(var(--u)*5.5)}}
.portada .wordmark{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};font-size:calc(var(--u)*4.2);line-height:1;
 display:inline-block;padding-bottom:calc(var(--u)*1.1);border-bottom:calc(var(--u)*.22) solid {pm["claro"]}}}
.portada.horizontal .wordmark{{font-size:calc(var(--u)*2.6)}}
.portada .logo{{max-height:calc(var(--u)*7);max-width:calc(var(--u)*34)}}
.portada .filete{{width:calc(var(--u)*10);border-top:calc(var(--u)*.35) solid;margin-bottom:calc(var(--u)*4)}}
.portada.horizontal .filete{{width:calc(var(--u)*6);border-top-width:calc(var(--u)*.25);margin-bottom:calc(var(--u)*2.4)}}
.portada .etq{{font-weight:500;letter-spacing:.12em;text-transform:uppercase;font-size:calc(var(--u)*2.4);margin-bottom:calc(var(--u)*3)}}
.portada.horizontal .etq{{font-size:calc(var(--u)*1.5);margin-bottom:calc(var(--u)*1.8)}}
.portada .tit{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};line-height:1.08;letter-spacing:-.02em;text-wrap:balance;max-width:96%}}
.portada .sub{{font-size:calc(var(--u)*3.6);line-height:1.35;margin-top:calc(var(--u)*4);max-width:88%;text-wrap:pretty}}
.portada.con-foto .sub{{font-size:calc(var(--u)*3.1);margin-top:calc(var(--u)*3)}}
.portada.horizontal .sub{{font-size:calc(var(--u)*2.1);margin-top:calc(var(--u)*2.4)}}
.portada .firma{{font-size:calc(var(--u)*2.4);letter-spacing:.12em;text-transform:uppercase;font-weight:500;margin-top:calc(var(--u)*5)}}
.portada.con-foto .firma{{margin-top:calc(var(--u)*3)}}
.portada.horizontal .firma{{font-size:calc(var(--u)*1.4);margin-top:calc(var(--u)*3)}}
"""


def doc_portada(d, k, formato, ancho, alto, imagen=None):
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">{k["links"]}
<style>html,body{{margin:0;width:{ancho}px;height:{alto}px;overflow:hidden}}body{{--u:{ancho / 100}px}}{portada_css(k)}</style></head>
<body>{portada_cuerpo(d, k, formato, imagen)}</body></html>"""


def armar_portada(d, salida, formato=None, imagen=None):
    k = marca(d)
    formato = formato or d.get("formato", "ebook")
    if formato not in TAMANOS:
        sys.exit(f"formato '{formato}' no válido. Usa: {', '.join(TAMANOS)}")
    imagen = imagen or d.get("portada", {}).get("imagen")
    if imagen and not Path(imagen).is_absolute() and d.get("_base"):
        cand = Path(d["_base"]) / imagen
        imagen = str(cand) if cand.exists() else imagen
    ancho, alto = TAMANOS[formato]
    salida = Path(salida)
    tmp = Path(tempfile.mkdtemp())
    (tmp / "portada.html").write_text(doc_portada(d, k, formato, ancho, alto, imagen), encoding="utf-8")
    png = tmp / "portada.png"
    render(tmp / "portada.html", png, ancho, alto)
    final = salida
    try:
        from PIL import Image
        im = Image.open(png).convert("RGB")
        if salida.suffix.lower() in (".jpg", ".jpeg"):
            im.save(salida, "JPEG", quality=92)
        else:
            im.save(salida)
    except ImportError:
        final = salida.with_suffix(".png")
        png.replace(final)
        print("Aviso: sin Pillow no puedo guardar JPG. Quedó en PNG. Kindle pide JPG o TIFF: instala Pillow (curso 02).")
    # Miniatura: la misma portada reducida al tamaño en que se ve en una lista.
    w = MINIATURA[formato]
    h = round(w * alto / ancho)
    mini = final.with_name(final.stem + "-miniatura.png")
    try:
        from PIL import Image
        Image.open(final).convert("RGB").resize((w, h), Image.LANCZOS).save(mini)
    except ImportError:
        (tmp / "mini.html").write_text(doc_portada(d, k, formato, w, h, imagen), encoding="utf-8")
        render(tmp / "mini.html", mini, w, h, espera_ms=6000)
    for n in k["notas"]:
        print("Nota de color:", n)
    print(f"portada {formato}: {ancho} x {alto} px -> {final}")
    return final, mini


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("json"); ap.add_argument("salida")
    ap.add_argument("--imagen"); ap.add_argument("--formato", choices=list(TAMANOS))
    a = ap.parse_args()
    armar_portada(leer_json(a.json), a.salida, a.formato, a.imagen)
