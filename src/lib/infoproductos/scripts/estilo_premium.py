"""Estilo premium común para los entregables de los agentes (sin IA, US$0). Sin dependencias.

Aplica ESTANDAR-VISUAL-ENTREGABLES.md: retícula de 12, márgenes amplios, escala tipográfica fija, color 70/25/5,
tablas limpias, fotos grandes, sin cajas de color, sin íconos, sin degradados, sin sombras, esquinas de 0 a 2 px.
Toma la paleta (oscuro, claro, acento) y las 2 tipografías del archivo del negocio o de un dict. Si el negocio no
tiene marca, usa el par neutro: Instrument Sans + IBM Plex Mono, negro, blanco y gris cálido #8A8378.

Uso desde otro script de la misma carpeta:
  import estilo_premium as ep
  m = ep.marca_desde_archivo("archivo-de-mi-negocio.md")      # o ep.marca_desde_dict({...}) o ep.MARCA_NEUTRA
  paginas = [
      ep.portada("Informe de cliente y competencia", m, fecha="Octubre 2026"),
      ep.pagina(ep.encabezado_seccion("01", "Resumen") + ep.cifras([...]), m, numero=2),
  ]
  ep.guardar(ep.documento(paginas, m, titulo="Informe"), "informe.html")
  # después: python render.py informe.html informe.pdf  y  python revisar_estilo.py informe.pdf

Formatos (argumento formato= de documento y css):
  "a4"       informes, plan, manual, propuesta, kit, ebook impreso (A4 vertical, páginas de 210 x 297 mm)
  "pantalla" landing y páginas web (ancho máximo 1200 px, texto a 680 px)
  "correo"   correos (600 px, una columna; el script del curso pasa el CSS a estilos en línea si hace falta)
  "lamina"   láminas para mostrar piezas (1600 x 1000 px)

Componentes (todos devuelven HTML; el texto se escapa y **así** pasa a negrita de peso 600):
  portada, pagina, encabezado_seccion, parrafo, tabla, dato, cifras, cita, ficha, lista_numerada,
  opciones_precio, notas, foto, boton, pie, lamina

Desde la consola:
  python estilo_premium.py --marca archivo-de-mi-negocio.md     muestra la marca leída, contrastes y avisos
  python estilo_premium.py --css [archivo.md] [--formato a4]    imprime el CSS
  python estilo_premium.py --muestra salida.html [archivo.md]   arma una página de prueba
"""
import html as _html, re, sys, unicodedata
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

try:  # mismo cálculo que contraste.py (WCAG 2.x); se copia aquí por si el agente no lo trae
    from contraste import ratio
except Exception:
    def _lum(h):
        h = h.strip().lstrip("#")
        c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

    def ratio(a, b):
        la, lb = _lum(a), _lum(b)
        return round((max(la, lb) + 0.05) / (min(la, lb) + 0.05), 2)


# ---------------------------------------------------------------------------------------------------------------
# Tipografías
# ---------------------------------------------------------------------------------------------------------------
# Fuentes conocidas de Google Fonts: (tipo, ejes y pesos para la URL css2, pesos disponibles).
# Una fuente que no está aquí se pide en 400 y, aparte, en 500/600/700 (si no existen, ese enlace falla solo).
FUENTES = {
    "Instrument Sans": ("sans", "wght@400;500;600", (400, 500, 600)),
    "Instrument Serif": ("serif", "", (400,)),
    "IBM Plex Mono": ("mono", "wght@400;500", (400, 500)),
    "Cormorant Garamond": ("serif", "wght@400;500;600", (400, 500, 600)),
    "Manrope": ("sans", "wght@400;500;600", (400, 500, 600)),
    "Newsreader": ("serif", "wght@400;500;600", (400, 500, 600)),
    "Inter": ("sans", "wght@400;500;600", (400, 500, 600)),
    "Inter Tight": ("sans", "wght@400;500;600;700", (400, 500, 600, 700)),
    "DM Serif Display": ("serif", "", (400,)),
    "DM Sans": ("sans", "wght@400;500;600", (400, 500, 600)),
    "Bodoni Moda": ("serif", "wght@400;500;600", (400, 500, 600)),
    "Jost": ("sans", "wght@400;500;600", (400, 500, 600)),
    "Fraunces": ("serif", "wght@300;400;500", (300, 400, 500)),
    "Archivo": ("sans", "wdth,wght@62..125,100..900", (400, 500, 600, 700)),
    "Tenor Sans": ("sans", "", (400,)),
    "Karla": ("sans", "wght@400;500;600", (400, 500, 600)),
}
# Pares que el estándar no propone. Si la marca del alumno ya los tiene, se respetan y se avisa.
NO_PROPONER = ["poppins", "montserrat", "caveat", "pacifico", "lobster", "comic neue", "roboto", "playfair display"]
RESPALDO = {
    "serif": "Georgia, 'Times New Roman', serif",
    "sans": "'Helvetica Neue', Arial, sans-serif",
    "mono": "'Courier New', ui-monospace, monospace",
}
_PISTAS_SERIF = ("serif", "garamond", "bodoni", "baskerville", "caslon", "playfair", "lora", "merriweather",
                 "fraunces", "newsreader", "cormorant", "prata", "spectral", "crimson", "gloock", "marcellus")


def tipo_fuente(nombre):
    if nombre in FUENTES:
        return FUENTES[nombre][0]
    n = nombre.lower()
    if "mono" in n:
        return "mono"
    if any(p in n for p in _PISTAS_SERIF) and "sans" not in n:
        return "serif"
    return "sans"


def pila(nombre):
    """font-family con el respaldo seguro: 'Cormorant Garamond', Georgia, 'Times New Roman', serif."""
    return f"'{nombre}', {RESPALDO[tipo_fuente(nombre)]}"


def pesos(nombre):
    return FUENTES[nombre][2] if nombre in FUENTES else (400, 500, 600, 700)


def enlaces_fuentes(marca):
    """<link> de Google Fonts: uno por familia, para que una fuente que falla no tumbe a las otras."""
    out = ['<link rel="preconnect" href="https://fonts.googleapis.com">',
           '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>']
    for f in familias(marca):
        q = f.replace(" ", "+")
        if f in FUENTES:
            ejes = FUENTES[f][1]
            urls = [f"family={q}:{ejes}" if ejes else f"family={q}"]
        else:
            urls = [f"family={q}", f"family={q}:wght@500;600;700"]
        for u in urls:
            out.append(f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{u}&display=swap">')
    return "\n".join(out)


def familias(marca):
    vistas = []
    for k in ("titulos", "texto", "mono"):
        f = marca.get(k)
        if f and f not in vistas:
            vistas.append(f)
    return vistas


# ---------------------------------------------------------------------------------------------------------------
# Color
# ---------------------------------------------------------------------------------------------------------------
def _rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c))):02X}" for c in rgb)


def mezcla(a, b, t):
    """Color a mezclado con b: t=0 da a, t=1 da b."""
    ra, rb = _rgb(a), _rgb(b)
    return _hex([ra[i] + (rb[i] - ra[i]) * t for i in range(3)])


def luminancia(h):
    r, g, b = [x / 255 for x in _rgb(h)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in (r, g, b)]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def saturacion(h):
    r, g, b = _rgb(h)
    mx, mn = max(r, g, b), min(r, g, b)
    return 0 if mx == 0 else (mx - mn) / mx


def legible(color, fondo, hacia, minimo=4.5):
    """El mismo color, corrido hacia `hacia` (el oscuro o el claro de la marca) hasta llegar al contraste mínimo.
    Es un tono derivado de la paleta: no agrega un color nuevo."""
    if ratio(color, fondo) >= minimo:
        return color.upper()
    for i in range(1, 21):
        c = mezcla(color, hacia, i / 20)
        if ratio(c, fondo) >= minimo:
            return c
    return hacia.upper()


def derivados(m):
    """Grises y tonos de acento que salen de los 3 colores, con su contraste ya resuelto."""
    osc, cla, acc = m["oscuro"], m["claro"], m["acento"]
    g60 = mezcla(cla, osc, 0.60)  # el oscuro al 60% sobre el claro
    g60 = legible(g60, cla, osc)  # texto secundario: siempre 4.5:1 o más
    g15 = mezcla(cla, osc, 0.15)  # líneas finas
    g60_osc = legible(mezcla(osc, cla, 0.60), osc, cla)  # texto secundario sobre fondo oscuro
    g15_osc = mezcla(osc, cla, 0.18)
    return {
        "gris60": g60, "gris15": g15, "gris60_oscuro": g60_osc, "gris15_oscuro": g15_osc,
        # acento para texto chico (etiquetas, número de sección) sobre claro y sobre oscuro
        "acento_texto": legible(acc, cla, osc),
        "acento_texto_oscuro": legible(acc, osc, cla),
        # acento para cifras de 32 pt o más (alcanza con 3:1)
        "acento_grande": legible(acc, cla, osc, 3.0),
        "acento_grande_oscuro": legible(acc, osc, cla, 3.0),
    }


# ---------------------------------------------------------------------------------------------------------------
# Marca
# ---------------------------------------------------------------------------------------------------------------
MARCA_NEUTRA = {
    "nombre": "", "oscuro": "#111111", "claro": "#FFFFFF", "acento": "#8A8378",
    "titulos": "Instrument Sans", "texto": "Instrument Sans", "mono": "IBM Plex Mono",
    "peso_titulos": 500, "ancho_titulos": 100, "neutra": True, "avisos": [],
}


def _norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def _completar(m):
    """Pesos posibles, mono solo si se pide, avisos de fuentes no recomendadas y de contraste."""
    avisos = list(m.get("avisos") or [])
    for k in ("oscuro", "claro", "acento"):
        m[k] = m[k].upper()
    if luminancia(m["oscuro"]) > luminancia(m["claro"]):
        m["oscuro"], m["claro"] = m["claro"], m["oscuro"]
        avisos.append("El oscuro era más claro que el claro: los cambié de lugar.")
    m.setdefault("texto", m.get("titulos"))
    m["texto"] = m.get("texto") or m["titulos"]
    disp = pesos(m["titulos"])
    p = int(m.get("peso_titulos") or (500 if 500 in disp else 400))
    if p not in disp:
        p = min(disp, key=lambda x: abs(x - p))
    m["peso_titulos"] = p
    m["peso_texto_fuerte"] = 600 if 600 in pesos(m["texto"]) else max(pesos(m["texto"]))
    m.setdefault("ancho_titulos", 100)
    for k in ("titulos", "texto"):
        if any(_norm(m[k]).startswith(n) for n in NO_PROPONER):
            avisos.append(f"{m[k]} está en la lista de fuentes que el estándar no propone. Se respeta porque es "
                          "la marca del negocio; conviene revisarla en el curso 04.")
    r = ratio(m["oscuro"], m["claro"])
    if r < 7:
        avisos.append(f"Oscuro sobre claro da {r}:1. Se lee, pero el estándar busca 7:1 o más en texto largo.")
    m["avisos"] = avisos
    m.update(derivados(m))
    return m


def marca_desde_dict(d=None):
    """Acepta {"nombre", "oscuro", "claro", "acento", "titulos", "texto", "mono", "peso_titulos"} o la forma anidada
    {"colores": {"oscuro":..., "claro":..., "acento":...}, "tipografias": {"titulos":..., "texto":...}}.
    Lo que falta sale del par neutro. Sin colores, toda la paleta es la neutra."""
    d = dict(d or {})
    col = d.get("colores") or {}
    tip = d.get("tipografias") or {}
    m = dict(MARCA_NEUTRA, avisos=[])
    m["nombre"] = d.get("nombre", "")
    colores = {k: d.get(k) or col.get(k) for k in ("oscuro", "claro", "acento")}
    if any(colores.values()):
        m["neutra"] = False
        for k, v in colores.items():
            if v:
                m[k] = v
            else:
                m["avisos"].append(f"Falta el color {k}: uso el neutro {m[k]}.")
    fuentes = {k: d.get(k) or tip.get(k) for k in ("titulos", "texto", "mono")}
    if fuentes["titulos"] or fuentes["texto"]:
        m["neutra"] = False
        m["titulos"] = fuentes["titulos"] or fuentes["texto"]
        m["texto"] = fuentes["texto"] or m["titulos"]
        m["mono"] = fuentes["mono"] or ""  # con marca propia, la mono solo entra si la marca la trae o se pide
    for k in ("peso_titulos", "ancho_titulos"):
        if d.get(k):
            m[k] = d[k]
    return _completar(m)


_ROL_ACENTO = ("acento", "detalle", "boton", "resalt", "cta", "destac")
_ROL_OSCURO = ("texto", "oscuro", "tinta", "titul")
_ROL_CLARO = ("fondo claro", "claro", "fondo", "papel")


def _colores_marca(txt):
    """[(nombre, HEX, contexto en minúsculas)] para cada #RRGGBB de la sección Marca. Sirve para tablas
    (| Musgo | #2E3A2C | Fondo y texto |) y para líneas (Musgo **#2E3A2C** (fondo y texto) · Hueso ...)."""
    out, vistos = [], set()
    for linea in txt.splitlines():
        hexes = list(re.finditer(r"#[0-9A-Fa-f]{6}\b", linea))
        for i, mh in enumerate(hexes):
            hx = mh.group(0).upper()
            if hx in vistos:
                continue
            vistos.add(hx)
            fin = hexes[i + 1].start() if i + 1 < len(hexes) else len(linea)
            ini = hexes[i - 1].end() if i > 0 else 0
            antes = linea[ini:mh.start()]
            despues = linea[mh.end():fin]
            if len(hexes) > 1:  # varios colores en la línea: el nombre es lo último antes del HEX
                antes = re.split(r"[·;|]", antes)[-1]
                despues = re.split(r"[·;]", despues)[0]
            nombre = re.sub(r"[*|:`]", " ", antes).strip(" -,").split("  ")[-1].strip()
            out.append((nombre[-40:], hx, _norm(despues + " " + nombre)))
    return out


def _roles(cols, avisos):
    """Elige oscuro, claro y acento. Primero por lo que dice el uso; después por luminancia."""
    if not cols:
        return None
    acento = next((c for c in cols if "acento" in c[2]), None) or \
        next((c for c in cols if any(p in c[2] for p in _ROL_ACENTO)), None)
    resto = [c for c in cols if c is not acento]
    if not resto:
        return None
    oscuro = min(resto, key=lambda c: luminancia(c[1]))
    claro = max(resto, key=lambda c: luminancia(c[1]))
    if oscuro is claro:
        claro = ("Blanco", "#FFFFFF", "")
        avisos.append("La marca no trae un color claro: uso blanco de fondo.")
    if acento is None:
        quedan = [c for c in cols if c not in (oscuro, claro)]
        acento = max(quedan, key=lambda c: saturacion(c[1])) if quedan else ("Gris", "#8A8378", "")
    if len(cols) > 3:
        sobran = [c[0] or c[1] for c in cols if c not in (oscuro, claro, acento)]
        avisos.append(f"La marca tiene {len(cols)} colores; el estándar usa 3. Dejé fuera: {', '.join(sobran)}.")
    return oscuro[1], claro[1], acento[1]


def _fuentes_marca(txt):
    """{"titulos", "texto", "mono", "peso_titulos", "ancho_titulos"} desde la parte de tipografías."""
    m = re.search(r"^.*tipograf.*$", txt, re.I | re.M)
    bloque = txt
    if m:  # desde la línea que dice "Tipografías" hasta el próximo subtítulo
        resto = txt[m.start():]
        fin = re.search(r"\n#{2,4} ", resto[1:])
        bloque = resto[: fin.start() + 1] if fin else resto
    out = {}
    for trozo in re.split(r"\n|·|;", bloque):
        n = _norm(trozo)
        es_t = bool(re.search(r"titul", n))
        es_x = bool(re.search(r"texto|cuerpo|parrafo", n))
        es_m = "mono" in n or "dato" in n or "cifra" in n
        if not (es_t or es_x or es_m):
            continue
        nombre = ""
        for cand in re.findall(r"\*\*([^*]+)\*\*", trozo):
            c = cand.strip(" :")
            if not re.search(r"t[íi]tulos?|textos?|tipograf", c, re.I) and re.match(r"^[A-Z][\w ]+$", c):
                nombre = c
                break
        if not nombre:
            mm = re.search(r"(?i:t[íi]tulos?|textos?)\**\s*:?\**\s*([A-Z][\w]*(?: [A-Z][\w]*)*)", trozo) or \
                re.search(r"([A-Z][\w]*(?: [A-Z][\w]*)*)\s*\((?i:para )?(?i:t[íi]tulos?|textos?)", trozo)
            nombre = mm.group(1).strip() if mm else ""
        nombre = re.sub(r"\s+(Google Fonts|Bold|Regular|Medium)$", "", nombre).strip()
        if not nombre or len(nombre) < 3:
            continue
        peso = re.search(r"\b([1-9]00)\b", trozo)
        if tipo_fuente(nombre) == "mono" and not es_t:
            out.setdefault("mono", nombre)
            continue
        if es_t and "titulos" not in out:
            out["titulos"] = nombre
            if peso:
                out["peso_titulos"] = int(peso.group(1))
            if "expandid" in n or "ancho" in n:
                out["ancho_titulos"] = 125
        if es_x and "texto" not in out and (not es_t or "titulos" in out):
            out["texto"] = nombre
    return out


def marca_desde_archivo(md, nombre=None):
    """Lee la sección "## Marca (curso 04)" del archivo del negocio. Si no hay colores ni tipografías, devuelve la
    marca neutra con un aviso. Toma el nombre del negocio de "Datos básicos" si archivo_negocio.py está a mano."""
    txt = Path(md).read_text(encoding="utf-8-sig")
    try:
        from archivo_negocio import seccion, datos_basicos
        marca_txt = seccion(txt, ["Marca"])
        nombre = nombre or datos_basicos(txt).get("nombre", "")
    except Exception:
        mm = re.search(r"^## [^\n]*Marca[^\n]*\n(.*?)(?=^## |\Z)", txt, re.S | re.M)
        marca_txt = mm.group(1) if mm else ""
        mn = re.search(r"^[-*]\s*\**Nombre(?: del negocio)?\**\s*:\s*(.+)$", txt, re.M | re.I)
        nombre = nombre or (mn.group(1).strip() if mn else "")
    avisos = []
    roles = _roles(_colores_marca(marca_txt), avisos)
    f = _fuentes_marca(marca_txt)
    d = {"nombre": re.sub(r"[*_]", "", nombre or "").strip()}
    if roles:
        d.update(oscuro=roles[0], claro=roles[1], acento=roles[2])
    d.update(f)
    m = marca_desde_dict(d)
    if not roles and not f:
        m["avisos"].insert(0, "El archivo no trae marca (curso 04): uso la paleta y el par neutro.")
    m["avisos"] = avisos + m["avisos"]
    return m


def marca(fuente=None):
    """Atajo: ruta al archivo del negocio, dict o nada (neutra)."""
    if fuente is None:
        return marca_desde_dict({})
    if isinstance(fuente, dict):
        return fuente if "gris60" in fuente else marca_desde_dict(fuente)
    return marca_desde_archivo(fuente)


# ---------------------------------------------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------------------------------------------
# Escala de la sección 3 del estándar: (A4 en pt, pantalla en px)
ESCALA = {
    "portada": ("54pt", "84px"), "h1": ("32pt", "48px"), "h2": ("20pt", "32px"), "h3": ("13pt", "22px"),
    "texto": ("10.5pt", "17px"), "nota": ("8pt", "13px"), "etiqueta": ("7.5pt", "11.5px"),
}
FORMATOS = {
    # ancho de página, alto, márgenes (arriba, lados, abajo), medianil, unidad del ritmo vertical, escala
    "a4": dict(ancho="210mm", alto="297mm", arriba="24mm", lados="22mm", abajo="28mm", medianil="5mm", u="4mm",
               esc=0, medida="112mm", pie_abajo="13mm"),
    "pantalla": dict(ancho="100%", alto="auto", arriba="96px", lados="64px", abajo="96px", medianil="24px",
                     u="8px", esc=1, medida="680px", pie_abajo="32px"),
    "correo": dict(ancho="600px", alto="auto", arriba="40px", lados="40px", abajo="40px", medianil="0",
                   u="8px", esc=1, medida="520px", pie_abajo="24px"),
    "lamina": dict(ancho="1600px", alto="1000px", arriba="80px", lados="96px", abajo="96px", medianil="32px",
                   u="8px", esc=1, medida="680px", pie_abajo="40px"),
}


def css(m=None, formato="a4"):
    """CSS base del estándar con la marca aplicada."""
    m = marca(m)
    f = FORMATOS[formato]
    e = {k: v[f["esc"]] for k, v in ESCALA.items()}
    u = f["u"]
    imprenta = formato == "a4"
    mono = pila(m["mono"]) if m.get("mono") else pila(m["texto"])
    pagina_css = (f"""
@page {{ size: A4; margin: 0; }}
.pagina {{ width: {f['ancho']}; height: {f['alto']}; box-sizing: border-box; position: relative; overflow: hidden;
  padding: {f['arriba']} {f['lados']} {f['abajo']}; background: var(--claro); break-after: page; page-break-after: always; }}
.pagina:last-child {{ break-after: auto; page-break-after: auto; }}""" if imprenta else f"""
.pagina {{ max-width: {'1200px' if formato == 'pantalla' else f['ancho']}; {'height: ' + f['alto'] + ';' if formato == 'lamina' else ''}
  margin: 0 auto; box-sizing: border-box; position: relative; overflow: hidden;
  padding: {f['arriba']} {f['lados']} {f['abajo']}; background: var(--claro); }}
@media (max-width: 720px) {{ .pagina {{ padding: 56px 24px 64px; }} .reticula {{ grid-template-columns: 1fr; }}
  .reticula > * {{ grid-column: 1 / -1 !important; }} }}""")
    return f""":root {{
  --oscuro: {m['oscuro']}; --claro: {m['claro']}; --acento: {m['acento']};
  --gris60: {m['gris60']}; --gris15: {m['gris15']};
  --gris60-oscuro: {m['gris60_oscuro']}; --gris15-oscuro: {m['gris15_oscuro']};
  --acento-texto: {m['acento_texto']}; --acento-texto-oscuro: {m['acento_texto_oscuro']};
  --acento-grande: {m['acento_grande']}; --acento-grande-oscuro: {m['acento_grande_oscuro']};
  --f-titulos: {pila(m['titulos'])}; --f-texto: {pila(m['texto'])}; --f-mono: {mono};
  --peso-titulos: {m['peso_titulos']}; --peso-fuerte: {m['peso_texto_fuerte']}; --ancho-titulos: {m.get('ancho_titulos', 100)}%;
  --u: {u}; --medida: {f['medida']}; --medianil: {f['medianil']}; --lados: {f['lados']};
}}
* {{ box-sizing: border-box; }}
html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin: 0; background: var(--claro); color: var(--oscuro); font-family: var(--f-texto); font-size: {e['texto']};
  line-height: 1.5; font-weight: 400; font-kerning: normal; text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased; }}
{pagina_css}
.pagina.oscura {{ background: var(--oscuro); color: var(--claro); }}
.reticula {{ display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: var(--medianil); row-gap: calc(var(--u) * 2); }}
.c-3 {{ grid-column: span 3; }} .c-4 {{ grid-column: span 4; }} .c-5 {{ grid-column: span 5; }} .c-6 {{ grid-column: span 6; }}
.c-7 {{ grid-column: span 7; }} .c-8 {{ grid-column: span 8; }} .c-12 {{ grid-column: 1 / -1; }}
.medida {{ max-width: var(--medida); }}

h1, h2, h3, .titulo-portada, .cifra-valor {{ font-family: var(--f-titulos); font-weight: var(--peso-titulos);
  font-stretch: var(--ancho-titulos); margin: 0; }}
.titulo-portada {{ font-size: {e['portada']}; line-height: 1.08; letter-spacing: -0.02em; }}
h1 {{ font-size: {e['h1']}; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: calc(var(--u) * 2); }}
h2 {{ font-size: {e['h2']}; line-height: 1.15; letter-spacing: -0.01em; margin-bottom: var(--u); }}
h3 {{ font-size: {e['h3']}; line-height: 1.25; margin-bottom: calc(var(--u) / 2); }}
p {{ margin: 0 0 calc(var(--u) * 1.5); max-width: var(--medida); }}
strong, b {{ font-weight: var(--peso-fuerte); }}
em, i {{ font-style: normal; font-weight: var(--peso-fuerte); }}
.entrada {{ font-size: {e['h3']}; line-height: 1.45; max-width: var(--medida); color: var(--oscuro); }}
.nota, .fuente {{ font-size: {e['nota']}; line-height: 1.4; color: var(--gris60); max-width: calc(var(--medida) * 0.86); }}
.etiqueta {{ font-family: var(--f-texto); font-size: {e['etiqueta']}; line-height: 1.3; letter-spacing: 0.08em;
  text-transform: uppercase; font-weight: 500; color: var(--gris60); }}
.oscura .etiqueta, .oscura .nota, .oscura .fuente {{ color: var(--gris60-oscuro); }}
.num {{ font-family: var(--f-mono); font-variant-numeric: tabular-nums lining-nums; }}
.filete {{ width: calc(var(--u) * 6); height: 0; border-top: 1.5pt solid var(--acento); margin: 0 0 calc(var(--u) * 2); }}
.linea {{ border: 0; border-top: 0.5pt solid var(--gris15); margin: calc(var(--u) * 3) 0; }}
.oscura .linea {{ border-top-color: var(--gris15-oscuro); }}
.espacio {{ height: calc(var(--u) * 4); }}
.abajo {{ position: absolute; left: var(--lados); right: var(--lados); bottom: {f['abajo']}; }}

/* Portada */
.portada {{ display: flex; flex-direction: column; justify-content: space-between; }}
.portada .marca-nombre {{ font-family: var(--f-titulos); font-weight: var(--peso-titulos); font-stretch: var(--ancho-titulos);
  font-size: {e['h3']}; letter-spacing: 0.18em; text-transform: uppercase; }}
.portada .bloque-titulo {{ max-width: 80%; }}
.portada .bloque-titulo .etiqueta {{ margin-bottom: var(--u); }}  /* rótulo separado del título */
.portada .subtitulo {{ font-size: {e['h3']}; line-height: 1.4; margin-top: calc(var(--u) * 2); max-width: var(--medida); }}
.portada.oscura .subtitulo {{ color: var(--claro); }}
.portada.oscura .filete {{ border-top-color: var(--acento); }}
.portada .datos {{ display: flex; justify-content: space-between; align-items: flex-end; }}
.portada.con-foto {{ justify-content: flex-end; gap: calc(var(--u) * 2); }}  /* con 4 el título de 3 líneas tocaba la foto */
.portada .foto-portada {{ position: absolute; left: 0; right: 0; top: 0; height: 52%; }}
.portada .foto-portada img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}

/* Encabezado de sección */
.seccion {{ margin-bottom: calc(var(--u) * 4); }}
.seccion .etiqueta.numero {{ color: var(--acento-texto); margin-bottom: calc(var(--u) * 1.5); display: block; }}
.oscura .seccion .etiqueta.numero {{ color: var(--acento-texto-oscuro); }}

/* Tabla limpia (sección 6) */
table.limpia {{ width: 100%; border-collapse: collapse; font-size: {e['texto']}; margin: 0 0 calc(var(--u) * 2); }}
table.limpia th {{ font-size: {e['etiqueta']}; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;
  color: var(--gris60); text-align: left; padding: 0 3mm 2.5mm 0; border-bottom: 1pt solid var(--oscuro); }}
table.limpia td {{ padding: 2.8mm 3mm 2.8mm 0; border-bottom: 0.5pt solid var(--gris15); vertical-align: top; }}
table.limpia th:last-child, table.limpia td:last-child {{ padding-right: 0; }}
table.limpia .derecha {{ text-align: right; font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }}
table.limpia tr.total td {{ font-weight: var(--peso-fuerte); border-top: 1pt solid var(--oscuro); border-bottom: 0; }}
table.limpia .clave {{ color: var(--acento-texto); font-weight: var(--peso-fuerte); }}

/* Cifras y dato destacado */
.cifras {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--medianil);
  row-gap: calc(var(--u) * 3); }}
.cifras.tres {{ grid-template-columns: repeat(3, minmax(0, 1fr)); }}
.cifra {{ border-top: 0.5pt solid var(--gris15); padding-top: calc(var(--u) * 1.5); }}
.oscura .cifra {{ border-top-color: var(--gris15-oscuro); }}
.cifra-valor {{ font-size: {e['h1']}; line-height: 1.0; letter-spacing: -0.02em; font-variant-numeric: lining-nums; }}
.cifra-valor .unidad {{ font-family: var(--f-texto); font-size: {e['h3']}; letter-spacing: 0; font-weight: 400;
  margin-left: 0.25em; color: var(--gris60); }}
.cifra-texto {{ margin: var(--u) 0 calc(var(--u) / 2); max-width: 70mm; }}
.cifra.clave .cifra-valor {{ color: var(--acento-grande); }}
.oscura .cifra.clave .cifra-valor {{ color: var(--acento-grande-oscuro); }}
.dato {{ margin: calc(var(--u) * 2) 0 calc(var(--u) * 3); }}
.dato .cifra-valor {{ font-size: {e['portada']}; }}
.dato.clave .cifra-valor {{ color: var(--acento-grande); }}

/* Cita */
.cita {{ margin: calc(var(--u) * 3) 0; max-width: 130mm; }}
.cita blockquote {{ margin: 0 0 calc(var(--u) * 1.5); font-family: var(--f-titulos); font-weight: var(--peso-titulos);
  font-stretch: var(--ancho-titulos); font-size: {e['h2']}; line-height: 1.3; letter-spacing: -0.01em; }}

/* Ficha: retrato tipográfico, bloques separados por aire y una línea fina */
.ficha .ficha-nombre {{ font-family: var(--f-titulos); font-weight: var(--peso-titulos); font-stretch: var(--ancho-titulos);
  font-size: {e['h1']}; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 var(--u); }}
.ficha .ficha-frase {{ font-family: var(--f-titulos); font-size: {e['h2']}; line-height: 1.3; margin: calc(var(--u) * 2) 0 calc(var(--u) * 4);
  max-width: 130mm; font-weight: var(--peso-titulos); }}
.ficha .bloques {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: calc(var(--medianil) * 2);
  row-gap: calc(var(--u) * 3); }}
.ficha .bloque {{ border-top: 0.5pt solid var(--gris15); padding-top: calc(var(--u) * 1.5); }}
.ficha .bloque p {{ margin: calc(var(--u) / 2) 0 0; }}

/* Lista con número */
ol.numerada {{ list-style: none; margin: 0 0 calc(var(--u) * 2); padding: 0; max-width: 140mm; }}
ol.numerada li {{ display: grid; grid-template-columns: 14mm 1fr; border-top: 0.5pt solid var(--gris15);
  padding: calc(var(--u) * 1.5) 0; }}
ol.numerada li:last-child {{ border-bottom: 0.5pt solid var(--gris15); }}
ol.numerada .etiqueta {{ color: var(--acento-texto); padding-top: 0.35em; }}
ol.numerada h3 {{ margin-bottom: 1mm; }}
ol.numerada p {{ margin: 0; }}

/* Opciones de precio en 3 columnas sin cajas */
.opciones {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: calc(var(--medianil) * 1.5); }}
.opcion {{ border-top: 0.5pt solid var(--gris60); padding-top: calc(var(--u) * 2); }}
.opcion.recomendada {{ border-top: 2pt solid var(--acento); padding-top: calc(var(--u) * 2 - 1.5pt); }}
.opcion .etiqueta {{ display: block; min-height: 1.3em; margin-bottom: var(--u); }}
.opcion.recomendada .etiqueta {{ color: var(--acento-texto); }}
.opcion .precio {{ font-family: var(--f-titulos); font-weight: var(--peso-titulos); font-stretch: var(--ancho-titulos);
  font-size: {e['h1']}; line-height: 1.0; letter-spacing: -0.02em; margin: var(--u) 0 calc(var(--u) / 2);
  font-variant-numeric: tabular-nums lining-nums; }}
.opcion .moneda {{ font-family: var(--f-texto); font-size: {e['nota']}; letter-spacing: 0.08em; color: var(--gris60); }}
.opcion ul {{ list-style: none; margin: calc(var(--u) * 2) 0 0; padding: 0; }}
.opcion li {{ padding: 1.6mm 0; border-top: 0.5pt solid var(--gris15); }}

/* Notas al pie y pie de página */
ol.notas {{ margin: calc(var(--u) * 3) 0 0; padding: 0 0 0 4mm; font-size: {e['nota']}; line-height: 1.4; color: var(--gris60); max-width: calc(var(--medida) * 0.86); }}
ol.notas li {{ margin-bottom: 1mm; overflow-wrap: anywhere; }}
.pie {{ position: absolute; left: var(--lados); right: var(--lados); bottom: {f['pie_abajo']}; display: flex;
  justify-content: space-between; }}

/* Fotos: grandes o ninguna */
figure.foto {{ margin: 0 0 calc(var(--u) * 3); }}
figure.foto img {{ display: block; width: 100%; height: 100%; object-fit: cover; }}
figure.foto.media {{ height: 120mm; margin-left: calc(var(--lados) * -1); margin-right: calc(var(--lados) * -1); }}
figure.foto.columna {{ height: 100%; }}
figure.foto.sangre {{ position: absolute; inset: 0; margin: 0; }}
figure.foto figcaption {{ margin-top: 2mm; }}
figure.foto.media figcaption {{ padding: 0 var(--lados); }}

/* Botón: rectángulo, esquina de 2 px, sin sombra ni degradado */
.boton {{ display: inline-block; background: var(--oscuro); color: var(--claro); text-decoration: none;
  font-family: var(--f-texto); font-weight: 500; font-size: {e['texto']}; padding: 0.85em 1.6em; border-radius: 2px; }}
.oscura .boton {{ background: var(--claro); color: var(--oscuro); }}

/* Lámina de piezas */
.piezas {{ display: flex; gap: var(--medianil); align-items: flex-end; }}
.piezas figure {{ margin: 0; flex: 1 1 0; }}
.piezas img {{ display: block; width: 100%; height: auto; }}
.piezas figcaption {{ margin-top: 12px; }}
"""


def head(m=None, titulo="", formato="a4"):
    m = marca(m)
    return (f'<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f"<title>{esc(titulo or m.get('nombre') or 'Documento')}</title>\n{enlaces_fuentes(m)}\n"
            f"<style>\n{css(m, formato)}</style>\n</head>")


def documento(paginas, m=None, titulo="", formato="a4", idioma="es"):
    """HTML completo. `paginas` es una lista de HTML (de portada(), pagina(), etc.) o un solo string."""
    cuerpo = "\n".join(paginas) if isinstance(paginas, (list, tuple)) else paginas
    return f'<!doctype html>\n<html lang="{idioma}">\n{head(m, titulo, formato)}\n<body>\n{cuerpo}\n</body>\n</html>\n'


def guardar(html_txt, ruta):
    p = Path(ruta)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(html_txt, encoding="utf-8")
    return p


# ---------------------------------------------------------------------------------------------------------------
# Componentes
# ---------------------------------------------------------------------------------------------------------------
def esc(t):
    """Escapa el texto y pasa **así** a negrita."""
    s = _html.escape(str(t or ""), quote=True)
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)


def pie(m=None, numero=None, izquierda=None):
    """Nombre del negocio a la izquierda y número de página a la derecha, en etiqueta."""
    m = marca(m) if not isinstance(m, dict) or "gris60" not in m else m
    izq = izquierda if izquierda is not None else m.get("nombre", "")
    der = f"{int(numero):02d}" if isinstance(numero, int) else (numero or "")
    return f'<footer class="pie etiqueta"><span>{esc(izq)}</span><span class="num">{esc(der)}</span></footer>'


def pagina(contenido, m=None, numero=None, oscura=False, clase="", con_pie=True):
    """Una página A4 (o una sección en pantalla) con su pie."""
    cls = " ".join(x for x in ["pagina", "oscura" if oscura else "", clase] if x)
    p = pie(m, numero) if con_pie else ""
    return f'<section class="{cls}">\n{contenido}\n{p}\n</section>'


def portada(titulo, m=None, fecha="", subtitulo="", etiqueta="", foto=None, para=""):
    """Portada a página completa en el oscuro de la marca: nombre del negocio, título grande, mes y año.
    foto: ruta o URL de una foto grande (ocupa la mitad de arriba, a sangre). para: "Propuesta para Café Ochre"."""
    m = marca(m)
    nombre = m.get("nombre", "")
    foto_html = (f'<div class="foto-portada"><img src="{esc(foto)}" alt=""></div>' if foto else "")
    arriba = "" if foto else f'<div class="marca-nombre">{esc(nombre)}</div>'
    eti = f'<div class="etiqueta">{esc(etiqueta)}</div>' if etiqueta else ""
    sub = f'<p class="subtitulo">{esc(subtitulo)}</p>' if subtitulo else ""
    para_html = f'<p class="subtitulo">{esc(para)}</p>' if para else ""
    abajo_der = f'<span class="etiqueta">{esc(nombre)}</span>' if foto else '<span></span>'
    return f"""<section class="pagina oscura portada{' con-foto' if foto else ''}">
{foto_html}{arriba}
<div class="bloque-titulo">
<div class="filete"></div>
{eti}<h1 class="titulo-portada">{esc(titulo)}</h1>
{sub}{para_html}
</div>
<div class="datos"><span class="etiqueta">{esc(fecha)}</span>{abajo_der}</div>
</section>"""


def encabezado_seccion(numero, titulo, entrada=""):
    """Número de sección en etiqueta con el acento ("01"), título H1 y una entrada opcional."""
    n = f"{int(numero):02d}" if str(numero).isdigit() else numero
    ent = f'<p class="entrada">{esc(entrada)}</p>' if entrada else ""
    return f'<header class="seccion"><span class="etiqueta numero num">{esc(n)}</span><h1>{esc(titulo)}</h1>{ent}</header>'


def parrafo(*textos, clase=""):
    c = f' class="{clase}"' if clase else ""
    return "\n".join(f"<p{c}>{esc(t)}</p>" for t in textos)


def subtitulo(texto, nivel=2):
    return f"<h{nivel}>{esc(texto)}</h{nivel}>"


def tabla(columnas, filas, numericas=None, total=None, clave=None, nota=""):
    """Tabla limpia. numericas: índices de columnas con cifras (se alinean a la derecha). Si no se dan, se detectan.
    total: fila final en peso 600 con línea arriba. clave: (fila, columna) de la cifra clave (va en el acento)."""
    if len(columnas) > 6:
        raise ValueError("Máximo 6 columnas (sección 6 del estándar). Parte la tabla o pásala a Excel.")
    if numericas is None:
        numericas = [j for j in range(len(columnas)) if filas and all(
            re.fullmatch(r"[\s$€S/.,%+\-–0-9A-Z]*\d[\s.,%0-9a-zA-Z/]*", str(f[j]) or "0") and re.search(r"\d", str(f[j]))
            for f in filas if j < len(f))]
    def celda(v, j, tag="td", extra=""):
        cls = " ".join(x for x in ["derecha" if j in numericas else "", extra] if x)
        return f'<{tag}{f" class={chr(34)}{cls}{chr(34)}" if cls else ""}>{esc(v)}</{tag}>'
    cab = "".join(celda(c, j, "th") for j, c in enumerate(columnas))
    cuerpo = []
    for i, f in enumerate(filas):
        cuerpo.append("<tr>" + "".join(celda(v, j, extra="clave" if clave == (i, j) else "") for j, v in enumerate(f)) + "</tr>")
    if total:
        cuerpo.append('<tr class="total">' + "".join(celda(v, j) for j, v in enumerate(total)) + "</tr>")
    n = f'<p class="nota">{esc(nota)}</p>' if nota else ""
    return f'<table class="limpia"><thead><tr>{cab}</tr></thead><tbody>{"".join(cuerpo)}</tbody></table>{n}'


def _valor(cifra, unidad):
    u = f'<span class="unidad">{esc(unidad)}</span>' if unidad else ""
    return f'<div class="cifra-valor">{esc(cifra)}{u}</div>'


def dato(cifra, texto="", unidad="", fuente="", clave=True):
    """Una cifra protagonista (54 pt) con su unidad chica, una línea y la fuente en gris."""
    f = f'<p class="fuente">{esc(fuente)}</p>' if fuente else ""
    t = f'<p class="entrada">{esc(texto)}</p>' if texto else ""
    return f'<div class="dato{" clave" if clave else ""}">{_valor(cifra, unidad)}{t}{f}</div>'


def cifras(items, columnas=2):
    """Resumen en 3 a 5 cifras. items: [{"cifra": "410", "unidad": "clientes", "texto": "...", "fuente": "...",
    "clave": True}]. Solo una cifra debería llevar clave=True (el acento marca una sola cosa por página)."""
    out = []
    for it in items:
        f = f'<p class="fuente">{esc(it.get("fuente"))}</p>' if it.get("fuente") else ""
        out.append(f'<div class="cifra{" clave" if it.get("clave") else ""}">{_valor(it["cifra"], it.get("unidad"))}'
                   f'<p class="cifra-texto">{esc(it.get("texto"))}</p>{f}</div>')
    return f'<div class="cifras{" tres" if columnas == 3 else ""}">{"".join(out)}</div>'


def cita(texto, autor="", detalle=""):
    """Cita grande en la tipografía de títulos, con nombre y ciudad en etiqueta. Sin estrellas ni comillas gigantes."""
    a = " · ".join(x for x in [autor, detalle] if x)
    return f'<figure class="cita"><blockquote>“{esc(texto)}”</blockquote>' + \
        (f'<figcaption class="etiqueta">{esc(a)}</figcaption>' if a else "") + "</figure>"


def ficha(nombre, bloques, frase="", etiqueta=""):
    """Retrato tipográfico: nombre en grande, una frase entre comillas y bloques sin cajas.
    bloques: {"Quién es": "...", "Qué busca": "...", ...} o lista de (título, texto)."""
    pares = bloques.items() if isinstance(bloques, dict) else bloques
    b = "".join(f'<div class="bloque"><div class="etiqueta">{esc(k)}</div><p>{esc(v)}</p></div>' for k, v in pares)
    e = f'<div class="etiqueta">{esc(etiqueta)}</div>' if etiqueta else ""
    fr = f'<p class="ficha-frase">“{esc(frase)}”</p>' if frase else ""
    return f'<div class="ficha">{e}<p class="ficha-nombre">{esc(nombre)}</p>{fr}<div class="bloques">{b}</div></div>'


def lista_numerada(items, desde=1):
    """Lista con "01", "02" en etiqueta y en el acento. items: ["texto"] o [("título", "texto")]."""
    out = []
    for i, it in enumerate(items, desde):
        if isinstance(it, (list, tuple)):
            cuerpo = f"<div><h3>{esc(it[0])}</h3><p>{esc(it[1])}</p></div>" if len(it) > 1 and it[1] else f"<div><h3>{esc(it[0])}</h3></div>"
        else:
            cuerpo = f"<div><p>{esc(it)}</p></div>"
        out.append(f'<li><span class="etiqueta num">{i:02d}</span>{cuerpo}</li>')
    return f'<ol class="numerada">{"".join(out)}</ol>'


def opciones_precio(opciones, moneda=""):
    """3 columnas sin cajas. opciones: [{"nombre", "precio", "incluye": [...], "recomendada": bool, "nota"}].
    La recomendada lleva el filete del acento arriba y la palabra "Recomendada" en etiqueta."""
    out = []
    for o in opciones:
        rec = o.get("recomendada")
        inc = "".join(f"<li>{esc(x)}</li>" for x in o.get("incluye", []))
        nota = f'<p class="nota">{esc(o["nota"])}</p>' if o.get("nota") else ""
        mon = f'<div class="moneda">{esc(o.get("moneda", moneda))}</div>' if (o.get("moneda") or moneda) else ""
        out.append(f'<div class="opcion{" recomendada" if rec else ""}"><span class="etiqueta">{"Recomendada" if rec else ""}</span>'
                   f'<h3>{esc(o["nombre"])}</h3>{mon}<div class="precio">{esc(o["precio"])}</div>{nota}<ul>{inc}</ul></div>')
    return f'<div class="opciones">{"".join(out)}</div>'


def notas(lista):
    """Fuentes como notas numeradas al pie, en 8 pt gris. Las URL largas van aquí y no en el texto."""
    return '<ol class="notas">' + "".join(f"<li>{esc(x)}</li>" for x in lista) + "</ol>"


def foto(src, modo="media", pie_foto="", ilustrativa=False):
    """Foto grande: modo "media" (media página a lo ancho, a sangre de lado a lado), "columna" o "sangre"
    (página completa). ilustrativa=True agrega "Imagen ilustrativa" (fotos hechas con IA)."""
    texto = " · ".join(x for x in [pie_foto, "Imagen ilustrativa" if ilustrativa else ""] if x)
    cap = f'<figcaption class="nota">{esc(texto)}</figcaption>' if texto and modo != "sangre" else ""
    return f'<figure class="foto {modo}"><img src="{esc(src)}" alt="{esc(pie_foto)}">{cap}</figure>'


def boton(texto, href="#"):
    return f'<a class="boton" href="{esc(href)}">{esc(texto)}</a>'


def lamina(titulo, piezas, m=None, etiqueta=""):
    """Lámina para mostrar piezas (formato "lamina"). piezas: [(ruta_imagen, "Post 4:5"), ...]."""
    figs = "".join(f'<figure><img src="{esc(s)}" alt="{esc(t)}"><figcaption class="etiqueta">{esc(t)}</figcaption></figure>'
                   for s, t in piezas)
    e = f'<span class="etiqueta numero">{esc(etiqueta)}</span>' if etiqueta else ""
    return pagina(f'<header class="seccion">{e}<h2>{esc(titulo)}</h2></header><div class="piezas">{figs}</div>', m, con_pie=False)


# ---------------------------------------------------------------------------------------------------------------
# Consola
# ---------------------------------------------------------------------------------------------------------------
def resumen(m):
    print(f"Negocio: {m.get('nombre') or '(sin nombre)'}{'  [marca neutra]' if m.get('neutra') else ''}")
    print(f"Colores: oscuro {m['oscuro']} · claro {m['claro']} · acento {m['acento']}")
    print(f"Derivados: gris60 {m['gris60']} · gris15 {m['gris15']} · acento para texto {m['acento_texto']} · "
          f"acento sobre oscuro {m['acento_texto_oscuro']}")
    print(f"Tipografías: títulos {m['titulos']} {m['peso_titulos']} · texto {m['texto']}"
          f"{' · mono ' + m['mono'] if m.get('mono') else ''}")
    print(f"Contraste: oscuro sobre claro {ratio(m['oscuro'], m['claro'])} · acento sobre claro {ratio(m['acento'], m['claro'])}"
          f" · acento sobre oscuro {ratio(m['acento'], m['oscuro'])} · gris60 sobre claro {ratio(m['gris60'], m['claro'])}")
    for a in m["avisos"]:
        print(f"OJO: {a}")


def _muestra(m):
    paginas = [
        portada("Documento de prueba", m, fecha="Octubre 2026", subtitulo="Cómo se ve el estilo premium con tu marca."),
        pagina(encabezado_seccion(1, "Resumen en cifras", "Cuatro números que cuentan cómo va el negocio.") +
               cifras([{"cifra": "410", "unidad": "clientes", "texto": "En 14 meses de venta online.", "clave": True},
                       {"cifra": "38", "unidad": "%", "texto": "Vuelve a comprar."},
                       {"cifra": "8.900", "texto": "Seguidores en Instagram."},
                       {"cifra": "1.150", "texto": "Personas en la lista de correo."}]), m, numero=2),
    ]
    return documento(paginas, m, "Muestra")


if __name__ == "__main__":
    a = sys.argv[1:]
    formato = "a4"
    if "--formato" in a:
        i = a.index("--formato")
        formato = a[i + 1]
        del a[i:i + 2]
    if len(a) == 2 and a[0] == "--marca":
        resumen(marca_desde_archivo(a[1]))
    elif a and a[0] == "--css":
        print(css(marca(a[1]) if len(a) > 1 else marca(), formato))
    elif len(a) >= 2 and a[0] == "--muestra":
        mm = marca(a[2]) if len(a) > 2 else marca()
        print(f"listo: {guardar(_muestra(mm), a[1])}")
    else:
        print(__doc__)
