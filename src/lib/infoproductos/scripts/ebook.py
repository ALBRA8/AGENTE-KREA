"""Arma el ebook en PDF maquetado con tu marca desde infoproducto.json (sin IA, US$0).

Uso:  python ebook.py infoproducto.json mi-ebook.pdf [--imagen fondo-portada.png]            -> versión para pantalla
      python ebook.py infoproducto.json mi-ebook-para-imprimir.pdf --imprimir                   -> versión para imprimir

Qué arma (hoja A5, estilo de ESTANDAR-VISUAL-ENTREGABLES.md con estilo_premium.py):
  portada · página de derechos · índice sin puntos de relleno · introducción · capítulos · cierre con tu siguiente
  paso · sobre el autor · fuentes de las cifras.
Cada capítulo abre en hoja propia: número grande en el acento, título, entrada y, si el capítulo trae "foto", una foto a
sangre en la mitad de abajo (con "Imagen ilustrativa"). Dos versiones:
  pantalla (por defecto): sin hojas en blanco; se lee en el celular o la computadora hoja tras hoja.
  --imprimir: cada capítulo abre en hoja impar (a la derecha del libro abierto); si cae en par, va una hoja en blanco antes.
Después el texto corre a una columna. Recuadros, recetas, tablas, pasos y fotos nunca se parten entre dos hojas.
El índice se llena en pasadas: arma el PDF, lee en qué hoja cayó cada capítulo y lo vuelve a armar con los números.
Los [confirmar], los enlaces PENDIENTE y las fotos que faltan (FOTO PENDIENTE) salen resaltados en amarillo.
Fotos: bloque {"tipo": "imagen", "ruta": "fotos/paso-1.jpg", "pie": "...", "alt": "..."}; la ruta se busca desde la
carpeta del JSON. La foto se ajusta al ancho de la hoja y lleva su pie debajo.
Fuentes de las cifras: solo imprime las cifras de "origenes" que aparecen en el texto del ebook (las de la página de
venta o de la conversación quedan fuera). "en_pdf": false la saca siempre. El "origen" sale impreso tal cual: escríbelo
para el lector.

JSON (campos que usa; ejemplo completo en plantillas/infoproducto-ebook-ejemplo.json):
 titulo, subtitulo, negocio {nombre, autor, contacto, web}, marca {colores, tipografias, logo}, portada {etiqueta},
 ebook {introduccion {titulo, bloques}, capitulos [{titulo, en_este_capitulo, foto, foto_alt, bloques}],
        cierre {titulo, bloques, llamada {texto, boton, enlace}}, autor {nombre, bio, contacto}, aviso, version},
 origenes [{cifra, origen, enlace}]
Tipos de bloque: parrafo, subtitulo, lista, pasos, recuadro, ejercicio, tabla, resumen, receta, imagen (ver comun.py).
"""
import argparse, datetime as dt, re, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import E, bloques_html, css_contenido, leer_json, marca, parrafos, resaltar, ruta_archivo, textos_de_bloques  # noqa: E402
from portada import portada_css, portada_cuerpo  # noqa: E402
from render import render  # noqa: E402


# ---------- Números de página desde el PDF (sin librerías) ----------

def anclas_con_altura(pdf):
    """{ancla: (hoja, y)} desde los destinos del PDF de Chrome o Edge (y en puntos desde abajo). {} si no puede."""
    try:
        datos = Path(pdf).read_bytes()
        objs = {int(m.group(1)): m.group(2) for m in re.finditer(rb"(\d+) 0 obj\s*(.*?)\s*endobj", datos, re.S)}
        cat = next(v for v in objs.values() if re.search(rb"/Type\s*/Catalog", v))
        raiz = int(re.search(rb"/Pages\s+(\d+) 0 R", cat).group(1))
        orden = []

        def recorrer(n):
            o = objs[n]
            kids = re.search(rb"/Kids\s*\[(.*?)\]", o, re.S)
            if re.search(rb"/Type\s*/Pages", o) and kids:
                for k in re.findall(rb"(\d+) 0 R", kids.group(1)):
                    recorrer(int(k))
            else:
                orden.append(n)
        recorrer(raiz)
        hoja = {n: i + 1 for i, n in enumerate(orden)}
        return {nombre.decode(): (hoja.get(int(ref), 0), float(y))
                for nombre, ref, y in re.findall(rb"/([\w.-]+)\s*\[\s*(\d+) 0 R\s*/XYZ\s+[-\d.]+\s+([-\d.]+)", datos)}
    except Exception:
        return {}


# Chrome mide la y del destino desde el borde de arriba del área de texto (arriba = 595 pt en A5).
# Alto útil de la hoja A5 en puntos: 210 mm menos márgenes de 18 mm arriba y 22 mm abajo.
_ALTO, _UTIL = 594.96, (210 - 18 - 22) / 25.4 * 72


def hojas_casi_vacias(alturas, secciones, umbral=0.4):
    """Secciones cuya última hoja quedó con menos del umbral de contenido y no es la hoja donde empiezan.
    La sección siguiente sigue en esa hoja en lugar de saltar a una nueva."""
    unir = set()
    for i, s in enumerate(secciones[:-1]):
        if secciones[i + 1].startswith("cap") or secciones[i + 1] == "cierre":  # capítulos y cierre abren hoja nueva
            continue
        ini, fin = alturas.get(s), alturas.get("fin-" + s)
        if not ini or not fin or fin[0] <= ini[0]:
            continue
        lleno = (_ALTO - fin[1]) / _UTIL
        if lleno < umbral:
            unir.add(secciones[i + 1])
    return unir


def paginas_de_anclas(pdf):
    """Lee el PDF que arma Chrome o Edge y devuelve {ancla: número de hoja}. Si no puede, devuelve {}."""
    try:
        datos = Path(pdf).read_bytes()
        objs = {int(m.group(1)): m.group(2) for m in re.finditer(rb"(\d+) 0 obj\s*(.*?)\s*endobj", datos, re.S)}
        cat = next(v for v in objs.values() if re.search(rb"/Type\s*/Catalog", v))
        raiz = int(re.search(rb"/Pages\s+(\d+) 0 R", cat).group(1))
        orden = []

        def recorrer(n):
            o = objs[n]
            kids = re.search(rb"/Kids\s*\[(.*?)\]", o, re.S)
            if re.search(rb"/Type\s*/Pages", o) and kids:
                for k in re.findall(rb"(\d+) 0 R", kids.group(1)):
                    recorrer(int(k))
            else:
                orden.append(n)
        recorrer(raiz)
        hoja = {n: i + 1 for i, n in enumerate(orden)}
        m = re.search(rb"/Dests\s+(\d+) 0 R", cat)
        dests = objs[int(m.group(1))] if m else (re.search(rb"/Dests\s*(<<.*?>>)", cat, re.S) or [b"", b""])[1]
        return {nombre.decode(): hoja.get(int(ref), 0)
                for nombre, ref in re.findall(rb"/([\w.-]+)\s*\[\s*(\d+) 0 R", dests)}
    except Exception:
        pass
    for lib in ("fitz", "pypdf"):  # respaldo si el PDF viene comprimido
        try:
            if lib == "fitz":
                import fitz
                doc = fitz.open(pdf)
                return {k: v["page"] + 1 for k, v in doc.resolve_names().items()}
            import pypdf
            r = pypdf.PdfReader(pdf)
            return {k.lstrip("/"): r.get_destination_page_number(v) + 1 for k, v in r.named_destinations.items()}
        except Exception:
            continue
    return {}


def contar_hojas(pdf):
    datos = Path(pdf).read_bytes()
    return len(re.findall(rb"/Type\s*/Page\b(?!s)", datos))


# ---------- Fuentes de las cifras ----------

def textos_del_ebook(d):
    """Todo el texto que sale impreso en el ebook (sin la página de venta)."""
    eb = d.get("ebook", {})
    partes = [d.get("titulo", ""), d.get("subtitulo", ""), eb.get("aviso", "")]
    if eb.get("introduccion"):
        partes += [eb["introduccion"].get("titulo", "")] + textos_de_bloques(eb["introduccion"].get("bloques"))
    for c in eb.get("capitulos", []):
        partes += [c.get("titulo", ""), c.get("en_este_capitulo", "")] + textos_de_bloques(c.get("bloques"))
    if eb.get("cierre"):
        ci = eb["cierre"]
        ll = ci.get("llamada", {})
        partes += [ci.get("titulo", ""), ll.get("texto", ""), ll.get("boton", "")] + textos_de_bloques(ci.get("bloques"))
    if eb.get("autor"):
        partes += [eb["autor"].get("bio", "")]
    return "\n".join(p for p in partes if p)


def _norm(t):
    return re.sub(r"\s+", " ", (t or "").lower().replace("\u00a0", " ")).strip()


def origenes_del_pdf(d):
    """Las cifras de "origenes" que aparecen en el texto del ebook. "en_pdf": false las saca, true las fuerza."""
    texto = _norm(textos_del_ebook(d))
    try:
        from revisar_infoproducto import cifras
        halladas = [_norm(c) for c in cifras(textos_del_ebook(d))]
    except Exception:
        halladas = []
        cifras = None
    palabras_texto = set(re.findall(r"\w+", texto))
    out = []
    for o in d.get("origenes", []):
        if o.get("en_pdf") is False:
            continue
        k = _norm(o.get("cifra"))
        if not k:
            continue
        si = o.get("en_pdf") is True or k in texto or any(h == k or (len(h) > 2 and h in k) for h in halladas)
        if not si and cifras is not None and not cifras(o.get("cifra", "")):
            # Un dato sin número ("sílice cristalina y silicosis"): va si casi todas sus palabras están en el ebook.
            clave = [w for w in re.findall(r"\w+", k) if len(w) >= 4]
            si = bool(clave) and sum(w in palabras_texto for w in clave) >= 0.75 * len(clave)
        if si:
            out.append(o)
    return out


# ---------- HTML ----------

def armar_html(d, k, numeros, imagen=None, unir=(), blancos=()):
    """Ebook A5 con el estándar visual: portada, derechos, índice sin puntos de relleno, apertura de cada capítulo en
    hoja impar (número grande en el acento, título y foto a sangre si el capítulo trae "foto"), texto a una columna."""
    eb = d.get("ebook", {})
    base = d.get("_base")
    pm = k["ep"]
    origenes = origenes_del_pdf(d)

    def clase(ancla, extra=""):
        return "parte" + (" " + extra if extra else "") + (" sigue" if ancla in unir else "")

    def fin(ancla):
        return f'<i class="fin" id="fin-{ancla}"></i>'
    neg = d.get("negocio", {})
    autor = neg.get("autor") or neg.get("nombre", "")
    caps = eb.get("capitulos", [])
    anio = dt.date.today().year
    entradas = []
    if eb.get("introduccion"):
        entradas.append(("intro", eb["introduccion"].get("titulo", "Antes de empezar"), ""))
    for i, c in enumerate(caps, 1):
        entradas.append((f"cap{i}", c.get("titulo", ""), f"{i:02d}"))
    if eb.get("cierre"):
        entradas.append(("cierre", eb["cierre"].get("titulo", "Tu siguiente paso"), ""))
    if eb.get("autor"):
        entradas.append(("autor", "Sobre " + (eb["autor"].get("nombre") or autor), ""))
    if origenes:
        entradas.append(("fuentes", "Fuentes", ""))
    indice = "".join(
        f'<a class="ent" href="#{a}"><span class="num">{n}</span><span class="tt">{E(t)}</span>'
        f'<span class="pg">{numeros.get(a, "")}</span></a>' for a, t, n in entradas)

    def foto_ruta(c):
        r = ruta_archivo(c.get("foto"), base) if c.get("foto") else None
        return r.as_uri() if r else ""

    def capitulo(i, c):
        f = foto_ruta(c)
        resumen = f'<p class="entrada">{resaltar(c["en_este_capitulo"])}</p>' if c.get("en_este_capitulo") else ""
        foto = (f'<div class="ap-foto"><img src="{f}" alt="{E(c.get("foto_alt", ""))}"></div>'
                f'<div class="ap-pie">{"Imagen ilustrativa" if c.get("foto_ilustrativa", True) else ""}</div>') if f else ""
        blanco = '<section class="blanco"></section>' if f"cap{i}" in blancos else ""
        return (blanco + f'<section class="apertura{" con-foto" if f else ""}" id="cap{i}"><div class="ap-txt">'
                f'<div class="ap-num">{i:02d}</div><div class="etq">Capítulo {i}</div>'
                f'<h1>{resaltar(c.get("titulo", ""))}</h1>{resumen}</div>{foto}</section>'
                f'<section class="parte cuerpo">{bloques_html(c.get("bloques"), base)}{fin(f"cap{i}")}</section>')

    intro = ""
    if eb.get("introduccion"):
        it = eb["introduccion"]
        intro = (f'<section class="{clase("intro")}" id="intro"><div class="etq">Introducción</div>'
                 f'<h1>{resaltar(it.get("titulo", "Antes de empezar"))}</h1><div class="filete"></div>'
                 f'{bloques_html(it.get("bloques"), base)}{fin("intro")}</section>')
    cierre = ""
    if eb.get("cierre"):
        ci = eb["cierre"]
        ll = ci.get("llamada", {})
        boton = ""
        if ll:
            enlace = ll.get("enlace", "")
            href = enlace if enlace.startswith("http") else "#"
            boton = (f'<div class="llamada">{parrafos(ll.get("texto", ""))}'
                     f'<a class="boton" href="{E(href)}">{resaltar(ll.get("boton", "Quiero el siguiente paso"))}</a>'
                     f'<div class="enl">{resaltar(enlace)}</div></div>')
        cierre = (f'<section class="{clase("cierre")}" id="cierre"><div class="etq">Cierre</div>'
                  f'<h1>{resaltar(ci.get("titulo", "Tu siguiente paso"))}</h1><div class="filete"></div>'
                  f'{bloques_html(ci.get("bloques"), base)}{boton}{fin("cierre")}</section>')
    sobre = ""
    if eb.get("autor"):
        au = eb["autor"]
        sobre = (f'<section class="{clase("autor", "corto")}" id="autor"><div class="etq">Quién lo escribe</div>'
                 f'<h1>Sobre {E(au.get("nombre") or autor)}</h1><div class="filete"></div>'
                 f'{parrafos(au.get("bio", ""))}<p class="contacto">{resaltar(au.get("contacto") or neg.get("contacto", ""))}</p>{fin("autor")}</section>')
    fuentes = ""
    if origenes:
        filas = "".join(f'<li><span class="cf">{resaltar(o.get("cifra", ""))}</span>. {resaltar(o.get("origen", ""))}'
                        f'{"<br><span class=url>" + E(o["enlace"]) + "</span>" if o.get("enlace") else ""}</li>' for o in origenes)
        fuentes = (f'<section class="{clase("fuentes", "corto")}" id="fuentes"><div class="etq">Fuentes</div>'
                   f'<h1>Fuentes de las cifras y los consejos</h1><div class="filete"></div><ol class="fuentes">{filas}</ol></section>')
    aviso = f'<p>{resaltar(eb["aviso"])}</p>' if eb.get("aviso") else ""
    marcas_fin = '<div class="marcas">' + "".join(f'<a href="#fin-{x}">.</a>' for x, _, _ in entradas) + "</div>"
    version = eb.get("version") or dt.date.today().strftime("%Y-%m-%d")
    nombre_neg = E(neg.get("nombre", ""))
    pie_txt = "font:500 6.5pt '" + k["t_txt"] + "',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:" + pm["gris60"]
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{E(d.get("titulo", ""))}</title>
{k["links"]}<style>
@page{{size:148mm 210mm;margin:18mm 18mm 22mm;background:{pm["claro"]};
 @bottom-left{{content:"{nombre_neg}";{pie_txt};vertical-align:top;padding-top:6mm}}
 @bottom-right{{content:counter(page, decimal-leading-zero);{pie_txt};vertical-align:top;padding-top:6mm}}}}
@page tapa{{margin:0;background:{pm["oscuro"]};@bottom-left{{content:none}}@bottom-right{{content:none}}}}
@page apertura{{margin:0;@bottom-left{{content:none}}@bottom-right{{content:none}}}}
@page legal{{@bottom-left{{content:none}}@bottom-right{{content:none}}}}
@page :blank{{@bottom-left{{content:none}}@bottom-right{{content:none}}}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:'{k["t_txt"]}',sans-serif;font-size:10pt;line-height:1.5;color:{pm["oscuro"]};background:{pm["claro"]};
 -webkit-print-color-adjust:exact;print-color-adjust:exact;font-variant-numeric:lining-nums}}
p,li{{max-width:112mm}}
.tapa{{page:tapa;width:148mm;height:210mm;--u:1.48mm;break-after:page}}
{portada_css(k)}
.legal{{page:legal;height:166mm;display:flex;flex-direction:column;justify-content:flex-end;font-size:8pt;line-height:1.45;color:{pm["gris60"]};break-after:page}}
.legal .t{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};font-size:14pt;color:{pm["oscuro"]};margin-bottom:2mm}}
h1{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};color:{pm["oscuro"]};font-size:24pt;line-height:1.08;letter-spacing:-.015em;margin:0 0 4mm;break-after:avoid}}
.etq{{font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;font-weight:500;color:{pm["gris60"]};margin-bottom:3mm}}
.filete{{width:14mm;border-top:1.2pt solid {pm["acento"]};margin:0 0 7mm}}
.indice{{break-after:page;padding-top:10mm}}
.ent{{display:grid;grid-template-columns:10mm 1fr 10mm;align-items:baseline;color:inherit;text-decoration:none;padding:2.6mm 0;border-bottom:.5pt solid {pm["gris15"]}}}
.ent:first-of-type{{border-top:1pt solid {pm["oscuro"]}}}
.ent .num{{font-size:7.5pt;letter-spacing:.08em;font-weight:500;color:{pm["acento_texto"]}}}
.ent .tt{{font-size:10.5pt;line-height:1.3;padding-right:3mm}}
.ent .pg{{text-align:right;font-variant-numeric:tabular-nums;color:{pm["gris60"]};font-size:9pt}}
.parte{{break-before:page}} .parte.corto{{break-inside:avoid}}
.parte.sigue{{break-before:auto;margin-top:12mm;padding-top:8mm;border-top:.5pt solid {pm["gris15"]}}}
.parte.cuerpo{{break-before:page}}
.blanco{{page:apertura;break-before:page;height:210mm}}
.apertura{{page:apertura;break-before:page;height:210mm;position:relative;overflow:hidden;background:{pm["claro"]}}}
.apertura .ap-txt{{padding:24mm 18mm 0}}
.apertura .ap-num{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};font-size:64pt;line-height:1;color:{pm["acento_grande"]};margin-bottom:6mm;font-variant-numeric:lining-nums}}
.apertura h1{{font-size:28pt;max-width:108mm}}
.apertura .entrada{{font-size:11pt;line-height:1.45;max-width:100mm;margin-top:5mm}}
.apertura.con-foto .ap-txt{{padding-top:20mm}}
.apertura .ap-foto{{position:absolute;left:0;right:0;bottom:0;height:98mm}}
.apertura .ap-foto img{{width:100%;height:100%;object-fit:cover;display:block}}
.apertura .ap-pie{{position:absolute;left:18mm;bottom:101mm;font-size:6.5pt;letter-spacing:.08em;text-transform:uppercase;color:{pm["gris60"]}}}
.entrada{{font-size:11pt;line-height:1.45}}
.fin{{display:block;height:0;break-before:avoid}} .parte > :nth-last-child(2){{margin-bottom:0}} .marcas{{font-size:1pt;line-height:0;color:transparent;height:0;overflow:hidden}}
{css_contenido(k)}
.llamada{{break-inside:avoid;margin-top:8mm;padding-top:5mm;border-top:1pt solid {pm["oscuro"]}}}
.boton{{display:inline-block;background:{pm["oscuro"]};color:{pm["claro"]};text-decoration:none;font-weight:500;
 padding:3mm 6mm;border-radius:2px;margin:2mm 0}}
.enl{{font-size:7.5pt;color:{pm["gris60"]};word-break:break-all}}
.contacto{{font-weight:500}}
ol.fuentes{{font-size:8pt;line-height:1.45;color:{pm["oscuro"]};padding-left:5mm}} ol.fuentes li{{margin:0 0 2.5mm;max-width:112mm}}
ol.fuentes .cf{{font-weight:600}} ol.fuentes .url{{color:{pm["gris60"]};word-break:break-all}}
</style></head><body>
<div class="tapa">{portada_cuerpo(d, k, "ebook", imagen)}</div>
<div class="legal"><div class="t">{E(d.get("titulo", ""))}</div><p>{E(d.get("subtitulo", ""))}</p>
<p>© {anio} {E(autor)}. Todos los derechos reservados. Puedes leerlo e imprimirlo para tu uso personal. No lo copies ni lo revendas sin permiso.</p>
{aviso}<p>Versión {E(version)} · {resaltar(neg.get("web") or neg.get("contacto", ""))}</p></div>
<section class="indice"><div class="etq">Contenido</div><h1>Índice</h1><div class="filete"></div>{indice}{marcas_fin}</section>
{intro}{"".join(capitulo(i, c) for i, c in enumerate(caps, 1))}{cierre}{sobre}{fuentes}
</body></html>"""


def secciones_de(d):
    eb = d.get("ebook", {})
    s = (["intro"] if eb.get("introduccion") else []) + [f"cap{i}" for i in range(1, len(eb.get("capitulos", [])) + 1)]
    s += (["cierre"] if eb.get("cierre") else []) + (["autor"] if eb.get("autor") else [])
    return s + (["fuentes"] if origenes_del_pdf(d) else [])


def armar_ebook(d, salida, imagen=None, imprimir=False):
    k = marca(d)
    imagen = imagen or d.get("portada", {}).get("imagen")
    tmp = Path(tempfile.mkdtemp())
    secciones = secciones_de(d)
    numeros, unir, blancos = {}, set(), set()
    for vuelta in range(1, 8):
        html = tmp / f"ebook{vuelta}.html"
        html.write_text(armar_html(d, k, numeros, imagen, unir, blancos), encoding="utf-8")
        pdf = tmp / f"ebook{vuelta}.pdf"
        render(html, pdf, espera_ms=9000)
        alturas = anclas_con_altura(pdf)
        nuevos = {a: v[0] for a, v in alturas.items() if not a.startswith("fin-")} or paginas_de_anclas(pdf)
        mas = hojas_casi_vacias(alturas, secciones) - unir if vuelta < 4 else set()
        # Para imprimir, cada capítulo abre en hoja impar: si cae en par, va una hoja en blanco antes (Chrome ignora
        # break-before: right). En pantalla no hay hojas en blanco.
        pares = ({a for a, pg in nuevos.items() if a.startswith("cap") and pg and pg % 2 == 0} - blancos
                 if imprimir and vuelta < 7 else set())
        if nuevos == numeros and not mas and not pares:
            break
        numeros, unir, blancos = nuevos, unir | mas, blancos | pares
    Path(salida).parent.mkdir(parents=True, exist_ok=True)
    Path(salida).write_bytes(pdf.read_bytes())
    if not numeros:
        print("Aviso: no pude leer en qué hoja cae cada capítulo. El índice queda con enlaces y sin números.")
    if unir:
        print("hojas casi vacías evitadas: " + ", ".join(sorted(unir)) + " sigue en la hoja anterior")
    fotos = [b for b in todos_los_bloques(d) if b.get("tipo") == "imagen"]
    from comun import ruta_archivo
    faltan = [b.get("ruta") or "sin archivo" for b in fotos if not ruta_archivo(b.get("ruta"), d.get("_base"))]
    if fotos:
        print(f"fotos: {len(fotos) - len(faltan)} puestas" + (f", {len(faltan)} PENDIENTE ({', '.join(faltan)})" if faltan else ""))
    hojas = contar_hojas(salida)
    for n in k["notas"]:
        print("Nota de color:", n)
    print(f"ebook {'para imprimir' if imprimir else 'para pantalla'}: {hojas} hojas A5"
          + (f", {len(blancos)} en blanco para abrir capítulos en impar" if imprimir and blancos else "") + f" -> {salida}")
    if numeros:
        print("índice: " + " · ".join(f"{a} p.{p}" for a, p in sorted(numeros.items(), key=lambda x: x[1])))
    return hojas, numeros


def todos_los_bloques(d):
    eb = d.get("ebook", {})
    bl = list((eb.get("introduccion") or {}).get("bloques", []))
    for c in eb.get("capitulos", []):
        bl += c.get("bloques", [])
    return bl + list((eb.get("cierre") or {}).get("bloques", []))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("json"); ap.add_argument("salida"); ap.add_argument("--imagen")
    ap.add_argument("--imprimir", action="store_true", help="capítulos en hoja impar, con hojas en blanco si hace falta")
    a = ap.parse_args()
    armar_ebook(leer_json(a.json), a.salida, a.imagen, imprimir=a.imprimir)
