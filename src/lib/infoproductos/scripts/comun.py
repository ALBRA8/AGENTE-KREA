"""Piezas comunes de los scripts del agente de infoproductos: marca, textos, bloques de contenido y copias .bak.

No se usa solo: lo importan ebook.py, guion.py, portada.py, pagina_venta.py y armar_infoproducto.py.
"""
import datetime as dt, html, json, re, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from contraste import ratio  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

E = html.escape
FORMATOS = ("ebook", "minicurso", "webinar", "podcast")
PENDIENTE_RE = re.compile(r"\[confirmar[^\]]*\]", re.I)


def leer_json(ruta):
    """Lee el JSON y guarda en "_base" su carpeta: las rutas de fotos y logo se buscan desde ahí."""
    d = json.loads(Path(ruta).read_text(encoding="utf-8"))
    if isinstance(d, dict):
        d.setdefault("_base", str(Path(ruta).resolve().parent))
    return d


def ruta_archivo(ruta, base=None):
    """Ruta absoluta de una foto o un logo: relativa a la carpeta del JSON o tal cual. None si el archivo no está."""
    if not ruta:
        return None
    p = Path(ruta)
    candidatos = [p] if p.is_absolute() else ([Path(base) / p] if base else []) + [p]
    for c in candidatos:
        if c.is_file():
            return c.resolve()
    return None


def respaldar(ruta):
    """Copia ruta a ruta.AAAAMMDD-HHMMSS.bak sin pisar una copia anterior. Devuelve la ruta de la copia o None."""
    p = Path(ruta)
    if not p.exists():
        return None
    sello = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    copia = p.with_name(f"{p.name}.{sello}.bak")
    n = 2
    while copia.exists():
        copia = p.with_name(f"{p.name}.{sello}-{n}.bak")
        n += 1
    shutil.copy2(p, copia)
    return copia


# ---------- Marca ----------
# Desde el 17-oct-2026 la marca sale de estilo_premium.py (ESTANDAR-VISUAL-ENTREGABLES.md): 3 colores con rol
# (oscuro, claro, acento), 2 tipografías, grises derivados y contraste ya resuelto. Sin colores ni fuentes propias.
import estilo_premium as ep  # noqa: E402


def _hex(h, defecto=""):
    h = (h or "").strip()
    return h.upper() if re.fullmatch(r"#[0-9a-fA-F]{6}", h) else defecto


def _mezcla(a, b, t):
    return ep.mezcla(a, b, t)


def marca(d):
    """Marca del infoproducto con el estilo premium. Acepta marca.colores con {oscuro, claro, acento} (lo nuevo) o con
    {principal, acento, fondo, texto} (plantillas viejas): oscuro = el más oscuro entre texto y principal, claro = fondo,
    acento = acento (o el principal si no es el oscuro). Devuelve las claves que usan los demás scripts y "ep"."""
    m = d.get("marca", {})
    col, tip = m.get("colores", {}), m.get("tipografias", {})
    oscuro = _hex(col.get("oscuro"))
    claro = _hex(col.get("claro")) or _hex(col.get("fondo"))
    acento = _hex(col.get("acento"))
    principal, texto = _hex(col.get("principal")), _hex(col.get("texto"))
    if not oscuro:
        cand = [c for c in (texto, principal) if c]
        oscuro = min(cand, key=ep.luminancia) if cand else ""
    if not acento and principal and principal != oscuro:
        acento = principal
    neg = d.get("negocio", {})
    pm = ep.marca_desde_dict({"nombre": neg.get("nombre", ""), "oscuro": oscuro, "claro": claro, "acento": acento,
                              "titulos": tip.get("titulos"), "texto": tip.get("texto"), "mono": tip.get("mono")})
    familias = ep.familias(pm)
    link = "https://fonts.googleapis.com/css2?" + "&".join(
        f"family={f.replace(' ', '+')}" + (f":{ep.FUENTES[f][1]}" if f in ep.FUENTES and ep.FUENTES[f][1] else "")
        for f in familias) + "&display=swap"
    return {"ep": pm, "fondo": pm["claro"], "texto": pm["oscuro"], "principal": pm["oscuro"], "titulos": pm["oscuro"],
            "acento": pm["acento"], "acento_txt": pm["acento_texto"], "t_tit": pm["titulos"], "t_txt": pm["texto"],
            "fuentes": link, "links": ep.enlaces_fuentes(pm), "notas": list(pm["avisos"]),
            "claro": pm["gris15"], "gris": pm["gris60"], "linea": pm["gris15"], "peso": pm["peso_titulos"]}


def asegurar(color, fondo, minimo):
    return ep.legible(color, fondo, "#000000" if ep.luminancia(fondo) > 0.4 else "#FFFFFF", minimo)


def texto_sobre(fondo):
    """Blanco o casi negro, el que mejor se lea sobre el fondo."""
    return "#ffffff" if ratio("#ffffff", fondo) >= ratio("#1f2430", fondo) else "#1f2430"


# ---------- Textos ----------

def resaltar(t):
    """Escapa el texto, marca [confirmar] y PENDIENTE en amarillo y convierte **negrita**."""
    s = E(t or "")
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = PENDIENTE_RE.sub(lambda m: f'<mark>{m.group(0)}</mark>', s)
    s = re.sub(r"\bPENDIENTE\b", '<mark>PENDIENTE</mark>', s)
    return s


def parrafos(t):
    return "".join(f"<p>{resaltar(x)}</p>" for x in re.split(r"\n\s*\n", t or "") if x.strip())


def imagen_html(b, base=None):
    """Foto grande con pie. "ilustrativa": true agrega "Imagen ilustrativa" (fotos hechas con IA).
    Si el archivo no está, deja un hueco FOTO PENDIENTE."""
    pie_txt = " · ".join(x for x in [b.get("pie", ""), "Imagen ilustrativa" if b.get("ilustrativa") else ""] if x)
    pie = f'<figcaption>{resaltar(pie_txt)}</figcaption>' if pie_txt else ""
    alt = b.get("alt") or b.get("pie") or ""
    ruta = ruta_archivo(b.get("ruta"), base)
    if ruta:
        return f'<figure class="foto"><img src="{ruta.as_uri()}" alt="{E(alt)}">{pie}</figure>'
    falta = E(b.get("ruta") or "sin archivo")
    return (f'<figure class="foto falta"><div class="hueco"><mark>FOTO PENDIENTE</mark>'
            f'<span>{E(alt) or "Describe qué muestra la foto"}</span><small>{falta}</small></div>{pie}</figure>')


def _pasos(items):
    return '<ol class="pasos">' + "".join(f'<li><span class="n">{i:02d}</span><span>{resaltar(x)}</span></li>'
                                          for i, x in enumerate(items, 1)) + "</ol>"


def bloques_html(bloques, base=None):
    """Bloques de contenido del ebook, la lección o el material. Tipos:
    parrafo {texto} · subtitulo {texto} · lista {items} · pasos {items} · recuadro {titulo, texto}
    ejercicio {titulo, texto, lineas} · tabla {encabezados, filas} · resumen {items}
    receta {titulo, tiempo, raciones, ingredientes [..], pasos [..], nota}
    imagen {ruta, pie, alt, ilustrativa}: foto (ruta relativa a la carpeta del JSON). Sin archivo sale FOTO PENDIENTE."""
    out = []
    for b in bloques or []:
        t = b.get("tipo", "parrafo")
        if t == "imagen":
            out.append(imagen_html(b, base))
        elif t == "parrafo":
            out.append(parrafos(b.get("texto", "")))
        elif t == "subtitulo":
            out.append(f"<h3>{resaltar(b.get('texto', ''))}</h3>")
        elif t == "lista":
            items = "".join(f"<li>{resaltar(x)}</li>" for x in b.get("items", []))
            out.append(f'<ul class="lista">{items}</ul>')
        elif t == "pasos":
            out.append(_pasos(b.get("items", [])))
        elif t == "recuadro":
            tit = f'<div class="etq">{resaltar(b["titulo"])}</div>' if b.get("titulo") else ""
            out.append(f'<div class="recuadro">{tit}{parrafos(b.get("texto", ""))}</div>')
        elif t == "ejercicio":
            lineas = "".join('<div class="linea"></div>' for _ in range(int(b.get("lineas", 3))))
            out.append(f'<div class="ejercicio"><div class="etq">{resaltar(b.get("titulo", "Ejercicio"))}</div>'
                       f'{parrafos(b.get("texto", ""))}{lineas}</div>')
        elif t == "tabla":
            enc = "".join(f"<th>{resaltar(x)}</th>" for x in b.get("encabezados", []))
            filas = "".join("<tr>" + "".join(f"<td>{resaltar(c)}</td>" for c in f) + "</tr>" for f in b.get("filas", []))
            out.append(f'<table class="tabla"><thead><tr>{enc}</tr></thead><tbody>{filas}</tbody></table>')
        elif t == "resumen":
            items = "".join(f"<li>{resaltar(x)}</li>" for x in b.get("items", []))
            out.append(f'<div class="resumen"><div class="etq">{resaltar(b.get("titulo", "En resumen"))}</div><ul>{items}</ul></div>')
        elif t == "receta":
            datos = " · ".join(x for x in [b.get("tiempo", ""), b.get("raciones", "")] if x)
            ing = "".join(f"<li>{resaltar(x)}</li>" for x in b.get("ingredientes", []))
            nota = f'<p class="nota-receta">{resaltar(b["nota"])}</p>' if b.get("nota") else ""
            dat = f'<div class="datos">{resaltar(datos)}</div>' if datos else ""
            out.append(f'<div class="receta"><div class="etq">Receta</div><h3 class="rt">{resaltar(b.get("titulo", ""))}</h3>'
                       f'{dat}<div class="ing"><div class="etq">Ingredientes</div><ul>{ing}</ul></div>'
                       f'{_pasos(b.get("pasos", []))}{nota}</div>')
    return "".join(out)


def textos_de_bloques(bloques):
    """Todo el texto de una lista de bloques, para revisarlo o contar palabras."""
    partes = []
    for b in bloques or []:
        for k in ("texto", "titulo", "pie"):
            if b.get(k):
                partes.append(b[k])
        partes += [x for x in b.get("items", []) if isinstance(x, str)]
        partes += b.get("encabezados", [])
        for f in b.get("filas", []):
            partes += [c for c in f if isinstance(c, str)]
    return partes


def textos_de_recetas(bloques):
    """Texto de los bloques "receta" (título, tiempo, raciones, ingredientes, pasos y nota). Las medidas de una receta
    son instrucciones de la propia receta: el revisor revisa su copy, pero no les pide origen."""
    partes = []
    for b in bloques or []:
        if b.get("tipo") != "receta":
            continue
        partes += [b.get(k, "") for k in ("titulo", "tiempo", "raciones", "nota") if b.get(k)]
        partes += [x for x in b.get("ingredientes", []) + b.get("pasos", []) if isinstance(x, str)]
    return partes


def palabras(textos):
    return sum(len(re.findall(r"\w+", t or "")) for t in textos)


def css_contenido(k):
    """Estilos de bloques compartidos por el ebook y el guion (estándar visual: sin cajas de color, sin esquinas
    redondeadas, números "01" en el acento, tablas con líneas finas)."""
    return f"""
h3{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};color:{k["texto"]};font-size:13pt;line-height:1.25;margin:7mm 0 2mm;break-after:avoid}}
p{{margin:0 0 3mm}} ul,ol{{margin:1mm 0 4mm;padding-left:5mm}} li{{margin:1mm 0}}
.etq{{font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;font-weight:500;color:{k["gris"]};margin-bottom:2mm}}
ol.pasos{{list-style:none;padding-left:0;margin:2mm 0 4mm}}
ol.pasos li{{display:grid;grid-template-columns:9mm 1fr;break-inside:avoid;margin:0;padding:1.6mm 0;border-top:.5pt solid {k["linea"]}}}
ol.pasos li:last-child{{border-bottom:.5pt solid {k["linea"]}}}
ol.pasos .n{{font-size:7.5pt;letter-spacing:.08em;font-weight:500;color:{k["acento_txt"]};padding-top:.3em;font-variant-numeric:tabular-nums}}
.recuadro,.ejercicio,.resumen{{break-inside:avoid;margin:5mm 0;padding:3mm 0 1mm;border-top:1pt solid {k["texto"]}}}
.ejercicio .linea{{border-bottom:.5pt solid {k["linea"]};height:7mm}}
.receta{{break-inside:avoid;margin:6mm 0 4mm;padding-top:3mm;border-top:1pt solid {k["texto"]}}}
.receta .rt{{margin:0 0 1mm;font-size:15pt}} .receta .datos{{font-size:8pt;color:{k["gris"]};margin-bottom:3mm;font-variant-numeric:tabular-nums}}
.receta .ing ul{{list-style:none;padding:0;margin:0 0 3mm;columns:2;column-gap:6mm;font-variant-numeric:tabular-nums}}
.receta .ing li{{break-inside:avoid;margin:0 0 1mm}} .nota-receta{{font-size:8.5pt;color:{k["gris"]}}}
table.tabla{{border-collapse:collapse;width:100%;margin:2mm 0 5mm;break-inside:avoid;font-size:9.5pt;font-variant-numeric:tabular-nums}}
table.tabla th{{font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;font-weight:500;color:{k["gris"]};text-align:left;
 padding:0 2mm 2mm 0;border-bottom:1pt solid {k["texto"]}}}
table.tabla td{{padding:2mm 2mm 2mm 0;border-bottom:.5pt solid {k["linea"]};vertical-align:top}}
mark{{background:none;color:{k["acento_txt"]};font-weight:600;border-bottom:1pt dashed {k["acento_txt"]};padding:0}}
figure.foto{{break-inside:avoid;margin:5mm 0}}
figure.foto img{{display:block;width:100%;max-height:120mm;object-fit:cover}}
figure.foto figcaption{{font-size:8pt;color:{k["gris"]};margin-top:2mm;break-before:avoid}}
figure.foto .hueco{{display:flex;flex-direction:column;gap:1mm;align-items:center;justify-content:center;height:52mm;
 border:1pt dashed {k["gris"]};background:none;padding:2mm;color:{k["texto"]}}}
figure.foto .hueco mark{{font-weight:600;letter-spacing:.06em}} figure.foto .hueco small{{color:{k["gris"]};word-break:break-all}}
"""
