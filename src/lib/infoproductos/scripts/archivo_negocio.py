"""Lee y escribe el archivo de tu negocio (archivo-de-mi-negocio.md) de forma tolerante (sin IA, US$0).

Uso:
  python archivo_negocio.py archivo-de-mi-negocio.md --leer
        imprime los Datos básicos con su nombre canónico y de qué campo salió cada uno (y qué falta)
  python archivo_negocio.py archivo-de-mi-negocio.md --guardar "Videos" 10 contenido.md
        reemplaza (o crea) la subsección "### Videos (curso 10)" dentro de "## Piezas y contenido (cursos 06 a 18)"
  python archivo_negocio.py archivo-de-mi-negocio.md --guardar "Marca" 04 contenido.md
        cursos 03, 04 y 05: reemplaza el contenido de su sección de primer nivel "## Marca (curso 04)"

Desde otro script de la misma carpeta:
  from archivo_negocio import datos_basicos, seccion, campos, buscar, guardar_subseccion
  d = datos_basicos("archivo-de-mi-negocio.md")       # {"nombre": "...", "ciudad": "...", ...} ("" si falta)
  d.origen["ciudad"]                                   # nombre del campo de donde salió, ej. "donde (ciudad, pais)"

Nombres canónicos de "Datos básicos" (plantillas/archivo-de-mi-negocio.md). Acepta también los nombres viejos
y los sinónimos de cada campo, sin contar mayúsculas ni tildes:
  nombre    Nombre del negocio / Nombre / Negocio / Marca
  ciudad    Ciudad y país / Dónde (ciudad, país) / Dónde / Ciudad / Ubicación
  vende     Qué vendes y a cuánto / Qué vende / Productos / Servicios
  cliente   Cliente principal (a quién le vende) / Cliente principal / Público / A quién le vende
  canales   Canales de venta / Canales / Canal de venta / Canal
  whatsapp  WhatsApp / Teléfono / Celular (y el número dentro de "Contacto público")
  instagram Instagram (y el @ dentro de "Contacto público")
  web       Web / Página web / Sitio web (y la dirección dentro de "Contacto público")
  horario   Horario / Horarios / Horario de atención
  precios   Rango de precios / Precios (campo viejo; hoy los precios van en "Qué vendes y a cuánto")
Un campo vacío, "pendiente" o "[completar]" cuenta como que falta. Si un dato sacado de "Contacto público" tiene la
marca "(ejemplo)" al lado, la conserva ("984 111 222 (ejemplo)"), para que nadie lo publique como real.

Al escribir deja antes una copia con fecha y hora (archivo-de-mi-negocio.md.AAAAMMDD-HHMMSS.bak) sin pisar otra,
y no toca ninguna otra sección. Lee y escribe en UTF-8.
"""
import datetime as dt, re, shutil, sys, time, unicodedata
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

VACIO = re.compile(r"^(|por completar|pendiente|\[completar[^\]]*\]|completar|-|—|sin definir)$", re.I)
PADRE = "## Piezas y contenido (cursos 06 a 18)"
GASTOS = "## Gastos de IA"
PRIMER_NIVEL = {"03": "## Cliente y competencia (curso 03)", "04": "## Marca (curso 04)", "05": "## Plan de marketing (curso 05)"}

# Orden y nombre exacto de los campos de la plantilla común.
CANONICOS = {
    "nombre": "Nombre del negocio",
    "ciudad": "Ciudad y país",
    "vende": "Qué vendes y a cuánto",
    "cliente": "Cliente principal (a quién le vende)",
    "canales": "Canales de venta",
    "whatsapp": "WhatsApp",
    "instagram": "Instagram",
    "web": "Web",
    "horario": "Horario",
}

# Sinónimos ya normalizados (sin tildes, en minúsculas). El primero de cada lista es el canónico.
SINONIMOS = {
    "nombre": ["nombre del negocio", "nombre", "negocio", "marca", "nombre comercial"],
    "ciudad": ["ciudad y pais", "donde (ciudad, pais)", "donde", "ciudad", "ciudad, pais", "ubicacion", "pais y ciudad"],
    "vende": ["que vendes y a cuanto", "que vendes", "que vende", "productos", "servicios", "productos o servicios", "oferta"],
    "cliente": ["cliente principal (a quien le vende)", "cliente principal", "a quien le vende", "a quien le vendes",
                "publico", "cliente"],
    "canales": ["canales de venta", "canales", "canal de venta", "canal"],
    "whatsapp": ["whatsapp", "telefono", "celular"],
    "instagram": ["instagram"],
    "web": ["web", "pagina web", "sitio web", "sitio"],
    "horario": ["horario", "horarios", "horario de atencion", "dias y horario"],
    "precios": ["rango de precios", "precios", "precio", "lista de precios"],
    "contacto": ["contacto publico (instagram, whatsapp, web)", "contacto publico", "contacto", "whatsapp", "telefono",
                 "celular", "canales", "canales de venta", "canal de venta", "canal", "redes"],
    "zona": ["atencion", "zona", "zona de servicio", "direccion", "local"],
    "dueno": ["dueno o duena", "dueno", "duena"],
    "frase": ["frase del negocio", "frase"],
}


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip()


def leer(md):
    """Texto del archivo en UTF-8 (acepta BOM), con saltos de línea normalizados."""
    return Path(md).read_text(encoding="utf-8-sig")


def seccion(txt, palabras, nivel="##"):
    """Primera sección de ese nivel cuyo título contiene todas las palabras (sin tildes ni mayúsculas)."""
    patron = rf"^{nivel} ([^\n]*)\n(.*?)(?=^#{{1,{len(nivel)}}} |\Z)"
    for m in re.finditer(patron, txt, re.S | re.M):
        if all(norm(p) in norm(m.group(1)) for p in palabras):
            return m.group(2)
    return ""


def campos(bloque):
    """{clave normalizada: valor} de las viñetas '- Clave: valor' (también '- **Clave**: valor')."""
    out = {}
    for m in re.finditer(r"^[ \t]*[-*][ \t]+\**([^:\n*]{2,60}?)\**[ \t]*:[ \t]*(.*)$", bloque, re.M):
        k = norm(m.group(1))
        v = m.group(2).strip()
        if k not in out and not VACIO.match(v.rstrip(".").strip()):
            out[k] = v
    return out


def buscar(cs, tipo):
    """Valor del primer sinónimo que existe. Devuelve (valor, nombre_del_campo)."""
    for s in SINONIMOS[tipo]:
        if s in cs:
            return cs[s], s
    for s in SINONIMOS[tipo]:  # "Ciudad y país de la tienda", "WhatsApp del negocio"...
        for k, v in cs.items():
            if k.startswith(s + " ") or k.startswith(s + "("):
                return v, k
    return "", ""


class Datos(dict):
    """dict con los 9 campos canónicos ("" si falta) y .origen = {campo: nombre del campo leído}."""
    origen = None


def datos_basicos(md_o_texto):
    """Lee "## Datos básicos" con sinónimos. Acepta una ruta o el texto ya leído."""
    txt = md_o_texto
    if "\n" not in str(md_o_texto) and Path(str(md_o_texto)).exists():
        txt = leer(md_o_texto)
    cs = campos(seccion(txt, ["Datos"]))
    d, origen = Datos(), {}
    for k in CANONICOS:
        v, de = buscar(cs, k)
        d[k], origen[k] = v, de
    # Archivos viejos: WhatsApp, Instagram y web dentro de "Contacto público (...)"; precios en "Rango de precios".
    contacto, de_c = buscar(cs, "contacto")

    def con_marca(m, valor):
        """Conserva "(ejemplo)" si va pegado al dato, dentro del mismo tramo (hasta la próxima coma, ; · | o /)."""
        tramo = re.split(r"[,;·|/]", contacto[m.end():], maxsplit=1)[0]
        return f"{valor} (ejemplo)" if "ejemplo" in norm(tramo) else valor

    if contacto:
        if not d["whatsapp"]:
            m = re.search(r"\+?\d[\d \-().]{6,}\d", contacto)
            if m and 8 <= len(re.sub(r"\D", "", m.group(0))) <= 15:
                d["whatsapp"], origen["whatsapp"] = con_marca(m, m.group(0).strip()), de_c
        if not d["instagram"]:
            m = re.search(r"@[\w.]+", contacto)
            if m:
                d["instagram"], origen["instagram"] = con_marca(m, m.group(0).rstrip(".")), de_c
        if not d["web"]:
            m = re.search(r"(?:https?://)?(?:www\.)?[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|pe|mx|co|cl|ar|es|ec|uy|la|io|app|site|store)\b[^\s,;]*",
                          contacto, re.I)
            if m and "@" not in contacto[max(0, m.start() - 1):m.start()]:
                d["web"], origen["web"] = m.group(0).rstrip("."), de_c
    precios, de_p = buscar(cs, "precios")
    if precios and precios not in d["vende"]:
        d["vende"] = f"{d['vende']}; {precios}" if d["vende"] else precios
        origen["vende"] = (origen["vende"] + " + " if origen["vende"] else "") + de_p
    d.origen = origen
    return d


def respaldo(p):
    """Copia con fecha y hora, sin pisar una anterior."""
    p = Path(p)
    sello = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = p.with_name(f"{p.name}.{sello}.bak")
    i = 1
    while bak.exists():
        bak = p.with_name(f"{p.name}.{sello}-{i}.bak")
        i += 1
    shutil.copy2(p, bak)
    return bak


def _fin_de(txt, ini, nivel):
    """Índice donde termina la sección que empieza en ini (siguiente título de ese nivel o mayor)."""
    fin_linea = txt.find("\n", ini)
    if fin_linea < 0:
        return len(txt)
    m = re.compile(rf"^#{{1,{nivel}}} ", re.M).search(txt, fin_linea + 1)
    return m.start() if m else len(txt)


def guardar_subseccion(md, tema, curso, contenido):
    """Reemplaza (o crea) la subsección del curso. Devuelve la ruta de la copia .bak.
    Cursos 06 a 18: "### <tema> (curso NN)" dentro de "## Piezas y contenido (cursos 06 a 18)".
    Cursos 03, 04 y 05: el contenido de su sección de primer nivel (el título del tema se ignora)."""
    p = Path(md)
    curso = f"{int(curso):02d}"
    txt = leer(p)
    bak = respaldo(p)
    cuerpo = contenido.strip("\n") + "\n"
    if curso in PRIMER_NIVEL:
        titulo = PRIMER_NIVEL[curso]
        m = re.search(rf"^{re.escape(titulo)}[ \t]*$", txt, re.M)
        if m:
            fin = _fin_de(txt, m.start(), 2)
            txt = txt[:m.end()] + "\n" + cuerpo + "\n" + txt[fin:]
        else:
            txt = _antes_de_gastos(txt, f"{titulo}\n{cuerpo}")
    else:
        titulo = f"### {tema.strip()} (curso {curso})"
        m = re.search(rf"^{re.escape(titulo)}[ \t]*$", txt, re.M)
        if m:
            fin = _fin_de(txt, m.start(), 3)
            txt = txt[:m.start()] + titulo + "\n" + cuerpo + "\n" + txt[fin:]
        else:
            mp = re.search(rf"^{re.escape(PADRE)}[ \t]*$", txt, re.M)
            if mp:
                fin = _fin_de(txt, mp.start(), 2)
                txt = txt[:fin].rstrip("\n") + "\n\n" + titulo + "\n" + cuerpo + "\n" + txt[fin:]
            else:
                txt = _antes_de_gastos(txt, f"{PADRE}\n\n{titulo}\n{cuerpo}")
    txt = re.sub(r"\n{3,}", "\n\n", txt)
    p.write_text(txt, encoding="utf-8", newline="\n")
    return bak


def _antes_de_gastos(txt, bloque):
    m = re.search(rf"^{re.escape(GASTOS)}", txt, re.M)
    if m:
        return txt[:m.start()] + bloque.rstrip("\n") + "\n\n" + txt[m.start():]
    return txt.rstrip("\n") + "\n\n" + bloque


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) == 2 and a[1] == "--leer":
        d = datos_basicos(a[0])
        falta = []
        for k, nombre in CANONICOS.items():
            if d[k]:
                print(f"- {nombre}: {d[k]}   (de '{d.origen[k]}')")
            else:
                falta.append(nombre)
        print("Falta: " + (", ".join(falta) if falta else "nada"))
    elif len(a) == 5 and a[1] == "--guardar":
        bak = guardar_subseccion(a[0], a[2], a[3], Path(a[4]).read_text(encoding="utf-8-sig"))
        print(f"listo: {a[0]} (curso {int(a[3]):02d}; copia en {bak.name})")
    else:
        sys.exit(__doc__)
