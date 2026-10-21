"""Revisa un HTML o un PDF rendido contra ESTANDAR-VISUAL-ENTREGABLES.md y marca ERROR, OJO u OK (sin IA, US$0).

Uso:
  python revisar_estilo.py informe.pdf                     revisa el PDF (lo que se entrega)
  python revisar_estilo.py informe.html                    revisa el CSS y, si hay Edge o Chrome, también lo rinde
                                                           a un PDF temporal y revisa lo rendido
  python revisar_estilo.py landing.html --pantalla         márgenes medidos para pantalla (px) y no para papel (mm)
  python revisar_estilo.py informe.pdf --paleta archivo-de-mi-negocio.md   además marca colores fuera de la marca
  python revisar_estilo.py informe.html --sin-render       solo la revisión del código

Qué revisa:
  1. Más de 3 colores (los grises y tonos que son mezcla de dos colores de la paleta no cuentan como colores nuevos)
  2. Texto con contraste bajo (4.5:1 en texto chico; 3:1 en texto de 18 pt o más), medido sobre el fondo real
  3. Márgenes chicos (A4: 22 mm a los lados, 24 arriba, 28 abajo; ERROR bajo 12 mm, OJO bajo 18 mm)
  4. Más de 2 familias tipográficas (una mono para cifras se permite como tercera)
  5. Emojis o íconos genéricos (emojis, ✓ ★ ① ➜, Font Awesome, Material Icons, SVG chicos repetidos)
  6. Cajas de fondo saturado (fondos de color fuerte detrás de bloques; los botones se aceptan)
  7. Líneas de más de 90 caracteres (OJO desde 80; el estándar pide 55 a 75 en texto corrido)
  En el HTML, además: degradados, sombras y border-radius mayor a 4 px.

Sale con código 1 si hay algún ERROR. El PDF necesita PyMuPDF (pip install pymupdf); sin él, solo revisa el HTML.
"""
import argparse, colorsys, math, re, sys, tempfile
from collections import Counter
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
try:
    from contraste import ratio
except Exception:
    def _l(h):
        c = [int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

    def ratio(a, b):
        la, lb = _l(a), _l(b)
        return round((max(la, lb) + 0.05) / (min(la, lb) + 0.05), 2)

MM = 72 / 25.4  # puntos por milímetro
EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F900-\U0001F9FF\U00002B00-\U00002BFF"
                   "\U00002460-\U000024FF\U00002190-\U000021FF\U0000FE0F\U0001F1E6-\U0001F1FF]")
PERMITIDOS = set("·→←↓↑×−–—“”‘’«»…©®°")  # flechas en datos y signos tipográficos no cuentan como íconos
ICONOS_HTML = re.compile(r"font-?awesome|fontawesome|material-icons|material-symbols|bootstrap-icons|ionicons|"
                         r"remixicon|feather-icons|lucide|class=\"[^\"]*\b(fa|fas|far|fab|bi|icon|icono)[- \"]", re.I)
GENERICAS = {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-monospace", "ui-sans-serif",
             "ui-serif", "inherit", "initial", "unset", "-apple-system", "blinkmacsystemfont"}
RESPALDOS = {"georgia", "times new roman", "times", "helvetica neue", "helvetica", "arial", "courier new", "courier",
             "segoe ui", "verdana", "tahoma"}


class Informe:
    def __init__(self):
        self.filas = []

    def add(self, nivel, que, detalle):
        self.filas.append((nivel, que, detalle))

    def imprimir(self):
        orden = {"ERROR": 0, "OJO": 1, "OK": 2}
        for nivel, que, det in sorted(self.filas, key=lambda f: orden[f[0]]):
            print(f"{nivel:5} {que}: {det}")
        n = Counter(f[0] for f in self.filas)
        print(f"\nResumen: {n['ERROR']} ERROR · {n['OJO']} OJO · {n['OK']} OK")
        return n["ERROR"]


# ---------------------------------------------------------------------------------------------------------------
# Color
# ---------------------------------------------------------------------------------------------------------------
def a_hex(v):
    v = v.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?", v)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return "#" + h.upper()
    m = re.fullmatch(r"rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)", v)
    if m:
        if m.group(4) and m.group(4) not in ("1", "100%") and float(m.group(4).rstrip("%")) < (1 if "%" not in m.group(4) else 100):
            return None  # transparente: se ignora
        return "#" + "".join(f"{int(x):02X}" for x in m.groups()[:3])
    nombres = {"white": "#FFFFFF", "black": "#000000", "red": "#FF0000", "green": "#008000", "blue": "#0000FF",
               "yellow": "#FFFF00", "orange": "#FFA500", "purple": "#800080", "pink": "#FFC0CB", "gray": "#808080",
               "grey": "#808080"}
    return nombres.get(v)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def dist(a, b):
    return math.dist(rgb(a), rgb(b))


def en_segmento(c, a, b, tol=14):
    """¿c es una mezcla de a y b (está cerca del segmento entre ellos en RGB)?"""
    pc, pa, pb = rgb(c), rgb(a), rgb(b)
    ab = [pb[i] - pa[i] for i in range(3)]
    n2 = sum(x * x for x in ab)
    if n2 == 0:
        return math.dist(pc, pa) <= tol
    t = max(0, min(1, sum((pc[i] - pa[i]) * ab[i] for i in range(3)) / n2))
    return math.dist(pc, [pa[i] + ab[i] * t for i in range(3)]) <= tol


def colores_base(usos):
    """Reduce los colores usados a los que no son mezcla de otros. usos: Counter {hex: peso}."""
    base = []
    for c, _ in usos.most_common():
        if any(dist(c, b) <= 12 for b in base):
            continue
        if any(en_segmento(c, a, b) for i, a in enumerate(base) for b in base[i + 1:]):
            continue
        base.append(c)
    # Segunda pasada: un color que quedó como base pero es mezcla de otros dos (un tono del acento que apareció
    # antes que el acento mismo) se saca.
    cambio = True
    while cambio and len(base) > 2:
        cambio = False
        for c in base:
            otros = [x for x in base if x != c]
            if any(en_segmento(c, a, b) for i, a in enumerate(otros) for b in otros[i + 1:]):
                base.remove(c)
                cambio = True
                break
    return base


def sat(h):
    r, g, b = [x / 255 for x in rgb(h)]
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    return ss, ll


def saturado(h):
    """Nivel de 'color chillón' de un fondo: 'alto', 'medio' o ''."""
    s, l = sat(h)
    if 0.18 < l < 0.88 and s >= 0.55:
        return "alto"
    if 0.18 < l < 0.9 and s >= 0.38:
        return "medio"
    return ""


def revisar_colores(inf, usos, paleta=None, donde=""):
    base = colores_base(usos)
    lista = ", ".join(base[:8])
    if len(base) > 4:
        inf.add("ERROR", "Colores", f"{len(base)} colores distintos{donde} ({lista}). El estándar usa 3 de la marca más grises.")
    elif len(base) == 4:
        inf.add("ERROR" if not _es_neutro_extremo(base) else "OJO", "Colores",
                f"4 colores{donde} ({lista}). El estándar usa 3: oscuro, claro y acento.")
    else:
        inf.add("OK", "Colores", f"{len(base)} colores base{donde} ({lista}); los demás son grises o tonos derivados")
    if paleta:
        fuera = [c for c in base if not any(dist(c, p) <= 14 for p in paleta)
                 and not any(en_segmento(c, a, b) for i, a in enumerate(paleta) for b in paleta[i + 1:])]
        if fuera:
            inf.add("ERROR", "Paleta", f"colores fuera de la marca: {', '.join(fuera)} (paleta: {', '.join(paleta)})")
        else:
            inf.add("OK", "Paleta", "todos los colores salen de la marca")


def _es_neutro_extremo(base):
    """4 colores donde uno es blanco o negro puro (fondo de página del navegador): solo OJO."""
    return any(c in ("#FFFFFF", "#000000") for c in base)


# ---------------------------------------------------------------------------------------------------------------
# Tipografías
# ---------------------------------------------------------------------------------------------------------------
def familia_pdf(nombre):
    n = nombre.split("+", 1)[-1]
    n = re.split(r"[-,]", n)[0]
    n = re.sub(r"(Regular|Medium|Bold|SemiBold|Semibold|Light|Italic|Book|Variable|VF|MT|PS)$", "", n)
    n = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", n).strip()
    return n


def revisar_familias(inf, fams, donde=""):
    fams = [f for f in dict.fromkeys(fams) if f]
    mono = [f for f in fams if "mono" in f.lower() or "courier" in f.lower()]
    resto = [f for f in fams if f not in mono]
    respaldo = [f for f in resto if f.lower() in RESPALDOS]
    if respaldo:
        inf.add("OJO", "Fuentes", f"aparece {', '.join(respaldo)}: puede ser que una fuente de Google no cargó{donde}")
    if len(resto) > 2:
        inf.add("ERROR", "Familias", f"{len(resto)} familias{donde}: {', '.join(resto)}. Máximo 2, más una mono para cifras.")
    elif len(mono) > 1:
        inf.add("ERROR", "Familias", f"{len(mono)} familias mono{donde}: {', '.join(mono)}")
    else:
        inf.add("OK", "Familias", f"{', '.join(fams) or 'ninguna'}{donde}")


# ---------------------------------------------------------------------------------------------------------------
# HTML (código)
# ---------------------------------------------------------------------------------------------------------------
def _vars(css):
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"(--[\w-]+)\s*:\s*([^;}{]+)", css)}


def _resolver(v, vs, n=0):
    return re.sub(r"var\((--[\w-]+)(?:,\s*([^)]+))?\)", lambda m: _resolver(vs.get(m.group(1), m.group(2) or ""), vs, n + 1)
                  if n < 5 else "", v)


def _reglas(css):
    """[(selector, cuerpo)] de un CSS (sin anidar @media: se toman igual las reglas de adentro)."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"@(media|supports)[^{]*\{", "", css)
    return [(m.group(1).strip(), m.group(2)) for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css)]


def revisar_html(inf, ruta, paleta=None):
    txt = Path(ruta).read_text(encoding="utf-8", errors="replace")
    css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", txt, re.S | re.I))
    inline = re.findall(r'style="([^"]*)"', txt, re.I)
    css_todo = css + "\n" + "\n".join(f"[inline] {{{s}}}" for s in inline)
    vs = _vars(css)
    reglas = _reglas(css_todo)
    cuerpo_html = re.sub(r"<(style|script|head)[^>]*>.*?</\1>", " ", txt, flags=re.S | re.I)
    texto = re.sub(r"<[^>]+>", " ", cuerpo_html)

    # Colores declarados (resueltas las variables), con peso por uso
    usos = Counter()
    for sel, cuerpo in reglas:
        for prop, val in re.findall(r"([\w-]+)\s*:\s*([^;]+)", cuerpo):
            if prop.startswith("--"):
                continue
            val = _resolver(val, vs)
            for c in re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black|red|green|blue|yellow|orange|purple|pink)\b", val):
                h = a_hex(c)
                if h:
                    usos[h] += 3 if "background" in prop else 2 if prop == "color" else 1
    if usos:
        revisar_colores(inf, usos, paleta, " en el CSS")

    # Familias: la primera de cada font-family
    fams = []
    for sel, cuerpo in reglas:
        for val in re.findall(r"font-family\s*:\s*([^;]+)", cuerpo):
            val = _resolver(val, vs)
            primera = val.split(",")[0].strip().strip("'\"")
            if primera and primera.lower() not in GENERICAS:
                fams.append(primera)
    for f in re.findall(r"fonts\.googleapis\.com/css2?\?([^\"']+)", txt):
        for fam in re.findall(r"family=([^:&]+)", f):
            fams.append(fam.replace("+", " "))
    revisar_familias(inf, fams, " en el CSS")

    # Adornos prohibidos
    grad = [s for s, c in reglas if re.search(r"(linear|radial|conic)-gradient", _resolver(c, vs))]
    inf.add("ERROR" if grad else "OK", "Degradados", f"en {', '.join(grad[:4])}" if grad else "ninguno")
    sombras = [s for s, c in reglas if re.search(r"(box|text)-shadow\s*:\s*(?!none)", c) or "drop-shadow" in c]
    inf.add("OJO" if sombras else "OK", "Sombras", f"en {', '.join(sombras[:4])}" if sombras else "ninguna")
    radios = []
    for s, c in reglas:
        for v in re.findall(r"border-radius\s*:\s*([^;]+)", c):
            v = _resolver(v, vs)
            nums = [float(x) for x in re.findall(r"([\d.]+)px", v)] + [99 for _ in re.findall(r"[\d.]+%|[\d.]+r?em", v)]
            if nums and max(nums) > 4:
                radios.append(f"{s} ({v.strip()})")
    inf.add("ERROR" if radios else "OK", "Esquinas", "border-radius de más de 4 px en " + "; ".join(radios[:4]) if radios else "rectas o de hasta 4 px")

    # Cajas de fondo saturado (los botones se aceptan)
    cajas = []
    for s, c in reglas:
        for prop, val in re.findall(r"(background(?:-color)?)\s*:\s*([^;]+)", c):
            for col in re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)", _resolver(val, vs)):
                h = a_hex(col)
                nivel = saturado(h) if h else ""
                if nivel and not re.search(r"bot[oó]n|btn|button|cta|\ba\b", s, re.I):
                    cajas.append((nivel, f"{s} {h}"))
    if any(n == "alto" for n, _ in cajas):
        inf.add("ERROR", "Cajas de color", "fondos saturados en " + "; ".join(x for _, x in cajas[:4]))
    elif cajas:
        inf.add("OJO", "Cajas de color", "fondos de color en " + "; ".join(x for _, x in cajas[:4]))
    else:
        inf.add("OK", "Cajas de color", "sin fondos saturados detrás de bloques")

    # Emojis e íconos
    em = sorted({ch for ch in EMOJI.findall(texto) if ch not in PERMITIDOS})
    ico = ICONOS_HTML.findall(txt)
    svgs = re.findall(r"<svg[^>]*\b(?:width|height)=\"(\d+)", txt)
    chicos = [s for s in svgs if int(s) <= 48]
    if em or ico:
        inf.add("ERROR", "Íconos", (f"emojis o símbolos: {' '.join(em[:12])}" if em else "") +
                (f"; fuente de íconos ({len(ico)} usos)" if ico else ""))
    elif len(chicos) >= 3:
        inf.add("OJO", "Íconos", f"{len(chicos)} SVG chicos (48 px o menos): pueden ser íconos genéricos")
    else:
        inf.add("OK", "Íconos", "sin emojis ni íconos genéricos")
    return txt


# ---------------------------------------------------------------------------------------------------------------
# PDF (lo rendido)
# ---------------------------------------------------------------------------------------------------------------
def _hex_int(c):
    return "#%06X" % (c & 0xFFFFFF)


def revisar_pdf(inf, ruta, paleta=None, pantalla=False, desde_html=False):
    try:
        import fitz
    except ImportError:
        inf.add("OJO", "PDF", "sin PyMuPDF no puedo revisar lo rendido (pip install pymupdf)")
        return
    doc = fitz.open(ruta)
    usos, fams, bajos, largas, emojis, cajas, encimados = Counter(), [], [], [], set(), [], []
    margenes = {"izquierda": 1e9, "derecha": 1e9, "arriba": 1e9, "abajo": 1e9}
    donde_margen = {}
    for np_, page in enumerate(doc, 1):
        W, H = page.rect.width, page.rect.height
        pix = page.get_pixmap(dpi=72)
        n = pix.n

        def px(x, y):
            x = max(0, min(pix.width - 1, int(x)))
            y = max(0, min(pix.height - 1, int(y)))
            i = (y * pix.width + x) * n
            return "#%02X%02X%02X" % tuple(pix.samples[i:i + 3])

        # Fondo y bloques de color (rectángulos rellenos)
        imgs = [fitz.Rect(i["bbox"]) for i in page.get_image_info()]
        for d in page.get_drawings():
            if d.get("fill") and d["rect"].width * d["rect"].height > 0:
                h = "#%02X%02X%02X" % tuple(int(x * 255) for x in d["fill"][:3])
                area = d["rect"].width * d["rect"].height / (W * H)
                usos[h] += max(1, int(area * 400))
                nivel = saturado(h)
                if nivel and 0.01 < area < 0.9:  # el fondo de toda la página es el claro u oscuro de la marca, no una caja
                    cajas.append((nivel, f"p{np_} {h} ({area:.0%} de la página)"))
        # Texto
        cajas_texto = []
        for b in page.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            for ln in b["lines"]:
                linea = "".join(s["text"] for s in ln["spans"]).strip()
                if len(linea) > 80:
                    largas.append((len(linea), np_, linea[:60]))
                for s in ln["spans"]:
                    t = s["text"].strip()
                    if not t:
                        continue
                    col = _hex_int(s["color"])
                    usos[col] += len(t)
                    fams.append(familia_pdf(s["font"]))
                    for ch in EMOJI.findall(t):
                        if ch not in PERMITIDOS:
                            emojis.add(ch)
                    if "emoji" in s["font"].lower():
                        emojis.add("(fuente de emoji)")
                    r = fitz.Rect(s["bbox"])
                    # Núcleo de la letra: de la altura de las mayúsculas a un poco bajo la línea base. El recuadro
                    # de PyMuPDF suma el alto de línea de la fuente (muy alto en Outfit o en serif display) y
                    # hacía ver encimado un rótulo chico que está arriba de un título grande sin tocarlo.
                    base_y, tam = s.get("origin", (r.x0, r.y1))[1], s["size"]
                    nucleo = fitz.Rect(r.x0, max(r.y0, base_y - 0.72 * tam), r.x1, min(r.y1, base_y + 0.12 * tam))
                    if nucleo.is_empty:
                        nucleo = fitz.Rect(r)
                    cajas_texto.append((r, s["size"], t[:30], nucleo))
                    # Fondo real: el color más común en el borde del recuadro del texto
                    muestras = Counter(px(x, y) for x in (r.x0 - 1, (r.x0 + r.x1) / 2, r.x1 + 1)
                                       for y in (r.y0 - 1, r.y1 + 1))
                    muestras += Counter(px(r.x0 - 2, (r.y0 + r.y1) / 2) for _ in range(2))
                    fondo = muestras.most_common(1)[0][0]
                    grande = s["size"] >= 18 or (s["size"] >= 14 and s["flags"] & 16)
                    minimo = 3.0 if grande else 4.5
                    rr = ratio(col, fondo)
                    sobre_foto = any(r.intersects(i) for i in imgs)
                    if rr < minimo:
                        bajos.append((rr, minimo, np_, t[:40], col, fondo, sobre_foto))
                    # Márgenes (lo que toca el borde es a sangre a propósito y no cuenta)
                    if s["size"] <= 8.5 and r.y0 > H * 0.9:
                        continue  # pie de página y notas: tienen su propia zona abajo
                    for lado, d_ in (("izquierda", r.x0), ("derecha", W - r.x1), ("arriba", r.y0), ("abajo", H - r.y1)):
                        if d_ > 1 and d_ < margenes[lado]:
                            margenes[lado], donde_margen[lado] = d_, f"p{np_} «{t[:30]}»"
        # Texto que se sale de la página o que se encima con otro (por ejemplo, el último párrafo sobre el pie)
        pies = [r for r, s, t, _ in cajas_texto if s <= 8.5 and r.y0 > H - 22 * MM]
        if pies and not pantalla:
            tope = min(r.y0 for r in pies)
            for r, s, t, _ in cajas_texto:
                if s > 8.5 and r.y1 > tope - 4 * MM and r.y0 < tope + 10:
                    encimados.append(f"p{np_} «{t}» pegado al pie (a menos de 4 mm)")
        for i, (ra, sa, ta, na) in enumerate(cajas_texto):
            if ra.y1 > H + 1 or ra.x1 > W + 1:
                encimados.append(f"p{np_} «{ta}» se sale de la página")
            for rb, sb, tb, nb in cajas_texto[i + 1:]:
                inter = na & nb  # se pisan las letras, no los recuadros de línea
                if inter.is_empty:
                    continue
                if abs(na.y1 - nb.y1) < 0.15 * min(sa, sb):
                    # misma línea: dos trozos seguidos (negrita, punto final) se tocan por el kerning sin pisarse
                    if inter.width < max(0.3 * min(na.width, nb.width), 0.25 * min(sa, sb)):
                        continue
                menor = min(na.width * na.height, nb.width * nb.height) or 1
                if inter.width * inter.height / menor > 0.05:  # con el núcleo, un 5% ya es letra sobre letra
                    encimados.append(f"p{np_} «{ta}» sobre «{tb}»")
    # Colores
    if usos:
        revisar_colores(inf, usos, paleta, " en lo rendido")
    tipo3 = [f for f in fams if f.lower().startswith("type3")]
    if tipo3 and len(tipo3) == len(fams):
        hermano = Path(ruta).with_suffix(".html")
        if hermano.exists() and not desde_html:
            sub = Informe()
            revisar_html(sub, hermano, paleta)
            for fila in sub.filas:
                if fila[1] in ("Familias", "Fuentes"):
                    inf.add(fila[0], fila[1], fila[2].replace("en el CSS", f"en {hermano.name}"))
        elif not desde_html:
            inf.add("OJO", "Familias", "el PDF guarda las fuentes como Type3 (sin nombre); revisa el HTML de origen")
    else:
        revisar_familias(inf, [f for f in fams if not f.lower().startswith("type3")], " en lo rendido")
    # Contraste
    reales = [b for b in bajos if not b[6]]
    if reales:
        peor = sorted(reales)[:5]
        inf.add("ERROR", "Contraste", "; ".join(f"p{p} «{t}» {c} sobre {f}: {r}:1 (pide {m})" for r, m, p, t, c, f, _ in peor) +
                (f" y {len(reales) - 5} más" if len(reales) > 5 else ""))
    else:
        inf.add("OK", "Contraste", "todo el texto llega a 4.5:1 (o 3:1 en texto grande)")
    sobre = [b for b in bajos if b[6]]
    if sobre:
        inf.add("OJO", "Texto sobre foto", f"{len(sobre)} textos sobre una foto con contraste dudoso: revísalos en el PNG")
    # Márgenes
    if pantalla:
        lim_err, lim_ojo, unidad, f = 16 * 0.75, 32 * 0.75, "px", 1 / 0.75
    else:
        lim_err, lim_ojo, unidad, f = 12 * MM, 18 * MM, "mm", 1 / MM
    for lado, v in margenes.items():
        if v == 1e9:
            continue
        val = f"{v * f:.0f} {unidad} ({donde_margen[lado]})"
        inf.add("ERROR" if v < lim_err else "OJO" if v < lim_ojo else "OK", f"Margen {lado}", val)
    # Íconos
    inf.add("ERROR" if emojis else "OK", "Emojis en lo rendido", " ".join(sorted(emojis)) if emojis else "ninguno")
    # Cajas
    if any(n == "alto" for n, _ in cajas):
        inf.add("ERROR", "Cajas de color", "; ".join(x for _, x in cajas[:4]))
    elif cajas:
        inf.add("OJO", "Cajas de color", "; ".join(x for _, x in cajas[:4]))
    else:
        inf.add("OK", "Cajas de color", "sin bloques de fondo saturado")
    # Líneas
    muy = [x for x in largas if x[0] > 90]
    if muy:
        inf.add("ERROR", "Largo de línea", "; ".join(f"p{p} {n} caracteres «{t}…»" for n, p, t in sorted(muy, reverse=True)[:3]))
    elif largas:
        inf.add("OJO", "Largo de línea", f"{len(largas)} líneas de 81 a 90 caracteres (ideal 55 a 75)")
    else:
        inf.add("OK", "Largo de línea", "ninguna línea pasa de 80 caracteres")
    if encimados:
        inf.add("ERROR", "Texto encimado", "; ".join(encimados[:4]) + (f" y {len(encimados) - 4} más" if len(encimados) > 4 else "")
                + ". Corta texto o pásalo a otra página.")
    else:
        inf.add("OK", "Texto encimado", "nada se sale ni se pisa")
    inf.add("OK", "Páginas", f"{len(doc)} revisadas")


def paleta_de(ruta):
    try:
        import estilo_premium as ep
        m = ep.marca(ruta)
        return [m["oscuro"], m["claro"], m["acento"]]
    except Exception:
        txt = Path(ruta).read_text(encoding="utf-8-sig")
        return list(dict.fromkeys(h.upper() for h in re.findall(r"#[0-9A-Fa-f]{6}\b", txt)))[:3]


def main():
    ap = argparse.ArgumentParser(description="Revisión de estilo premium")
    ap.add_argument("archivo")
    ap.add_argument("--paleta", help="archivo del negocio (o .md con la marca) para marcar colores fuera de la marca")
    ap.add_argument("--pantalla", action="store_true", help="márgenes para pantalla (landing, correo)")
    ap.add_argument("--sin-render", action="store_true", help="en un HTML, no rendir a PDF")
    a = ap.parse_args()
    p = Path(a.archivo)
    paleta = paleta_de(a.paleta) if a.paleta else None
    inf = Informe()
    print(f"Revisión de estilo: {p.name}\n")
    if p.suffix.lower() == ".pdf":
        revisar_pdf(inf, p, paleta, a.pantalla)
    else:
        txt = revisar_html(inf, p, paleta)
        pantalla = a.pantalla or "@page" not in txt
        if not a.sin_render:
            try:
                from render import render
                tmp = Path(tempfile.mkdtemp(prefix="revisar-")) / (p.stem + ".pdf")
                render(p, tmp)
                revisar_pdf(inf, tmp, paleta, pantalla, desde_html=True)
            except SystemExit as e:
                inf.add("OJO", "Render", f"no pude rendir el HTML ({e}); revisé solo el código")
            except Exception as e:
                inf.add("OJO", "Render", f"no pude rendir el HTML ({e}); revisé solo el código")
    errores = inf.imprimir()
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
