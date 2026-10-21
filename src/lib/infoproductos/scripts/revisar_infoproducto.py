"""Revisa el infoproducto antes de armarlo: reglas de copy, cifras con origen, pendientes, largos y una sola voz (US$0).

Uso:
  python revisar_infoproducto.py infoproducto.json                    -> revisa todo
  python revisar_infoproducto.py infoproducto.json --salida revision.txt
  python revisar_infoproducto.py --texto "Un texto suelto..."         -> revisa un texto y mide su largo (6 a 25 palabras,
                                                                        el de la promesa; cambia con --min y --max)
  python revisar_infoproducto.py --texto "..." --trato vosotros       -> si el alumno eligió tratar de vosotros a su público

Niveles:
  ERROR  hay que corregir antes de armar (guion largo, voseo, falta una parte, largo fuera de rango, precio promedio).
  OJO    revisa con el alumno: cada cifra sin origen, cada [confirmar], cada enlace PENDIENTE, contrastes "X, no Y",
         mezcla de "yo" y "nosotros", forma de vosotros (escribís, tenéis, os) si el trato es tú, fecha sin fuente oficial,
         duración que no calza, foto que falta (FOTO PENDIENTE) o sin pie, origen que parece nota interna y sale en el PDF.
  OK     lo que pasó la revisión (largos medidos, cifras con su origen en "origenes").
Cifras: números con unidad (también en palabras: "medio centímetro", "dos días"), porcentajes, precios ("9 €",
"12 EUR", "US$5"), plazos, frecuencias ("cada semana", "a diario") y "más de N". Si la cifra está en "origenes"
[{cifra, origen, enlace}], sale OK con su origen. Si no, OJO: di de dónde sale o ponla como [confirmar].
Termina con código 1 si hay errores.
"""
import argparse, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import FORMATOS, leer_json, palabras, textos_de_bloques, textos_de_recetas  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

VOSEO = (r"\b(vos|tenés|podés|querés|sabés|hacés|ponés|decís|sentís|vivís|acabás|mirá|pegá|hacé|andá|comprá|dejá|fijate|"
         r"mandá|cerrá|tomá|vení|sentate|poné|traé|contame|escribime|mandame|avisame|seguime|llamame|probá|aprovechá|reservá|"
         r"agendá|consultá|conocé|sumate|animate|guardá|comentá|buscá|contá|empezá|pensá|preguntá|usá|llamá|pagá|descargá|"
         r"leé|aprendé|escuchá|anotate|registrate|inscribite|seguinos|escribinos|contanos)\b")
# Pueden ser voseo (una orden) o pasado en primera persona ("la escribí para ti"): solo OJO.
VOSEO_DUDOSO = r"\b(elegí|abrí|escribí|pedí|decí|salí|descubrí|compartí)\b"
CONTRASTE = [
    (r"\bno es\b[^.!?\n]{0,60}\bes\b", "contraste 'no es X, es Y'"),
    (r"\bno son\b[^.!?\n]{0,60}\bson\b", "contraste 'no son X, son Y'"),
    (r"\bno solo\b[^.!?\n]{0,80}\bsino\b", "contraste 'no solo X sino Y'"),
    (r"\bsino\b", "posible contraste con 'sino'"),
    (r"\ben lugar de\b", "posible contraste 'en lugar de'"),
    (r",\s*no\s+(un|una|el|la|los|las|solo|para|por)\b", "posible contraste 'X, no Y'"),
]
CONFIRMAR = r"\[confirmar[^\]]*\]"
_NUM = (r"(?:\d+(?:[.,]\d+)*|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|"
        r"cuarenta|cincuenta|cien|mil|media|medio)")
UNIDADES = (r"segundos?|minutos?|horas?|d[ií]as?|semanas?|meses|mes|años?|clientes?|alumnos?|alumnas?|personas?|"
            r"seguidores|ventas|pedidos|veces|kilos?|kg|gramos?|g|litros?|metros?|m2|cm|mm|cent[ií]metros?|mil[ií]metros?|"
            r"capas?|plantas?|cosechas?|páginas?|"
            r"descargas?|suscriptores|oyentes|reproducciones|inscritos")
CIFRAS = [
    r"(?:US\$|S/|\$|€|USD|MXN|COP|CLP|PEN|ARS|EUR)\s?\d(?:[\d.,]*\d)?",
    r"\b\d+(?:[.,]\d+)?\s?(?:€|(?:EUR|euros?|USD|d[oó]lares|soles|pesos)\b)",
    r"\b(?:un|una)\s+(?:cent[ií]metro|mil[ií]metro|metro|kilo|litro|gramo|capa)\b",
    r"\b\d+(?:[.,]\d+)?\s?%",
    rf"\b{_NUM}\s+por\s?ciento\b",
    rf"\b{_NUM}\s+(?:{UNIDADES})\b",
    rf"\b(?:más|menos) de\s+{_NUM}\b",
    r"\b\d{2,}\b",
]
# Frecuencias: también son cifras. "Cada semana me escribe alguien" solo si el alumno lo dijo así.
FRECUENCIA = (r"\b(?:cada|todos los|todas las)\s+(?:d[ií]as?|semanas?|mes(?:es)?|años?|lunes|martes|mi[eé]rcoles|jueves|"
              r"viernes|s[aá]bados?|domingos?|mañanas?|tardes?|noches?|temporadas?)\b|\b(?:a diario|diariamente|"
              r"semanalmente|mensualmente)\b|\b(?:\w+\s+)?veces\s+(?:al|por|a la)\s+(?:d[ií]a|semana|mes|año)\b")
CIFRAS.append(FRECUENCIA)
# Forma de vosotros (España). Si el trato elegido es tú, es OJO de persona; si es vosotros, lo que se marca es el tú.
VOSOTROS = (r"\b(vosotros|vosotras|os|vuestr[oa]s?|sois|veis|escribís|vivís|pedís|salís|abrís|recibís|subís|compartís|"
            r"elegís|seguís|venís|decidís|añadís|repetís|servís|medís|partís|sentís|decís|mirad|tened|haced|escribid|"
            r"venid|decid|probad|comprad|apuntaos|escribidme|contadme|\w+[áé]is)\b")
TU = r"\b(tú|tienes|puedes|quieres|sabes|haces|necesitas|escribes|contigo|te|tus?)\b"
DUDOSOS_VOSOTROS = {"decís", "sentís", "vivís"}  # voseo para el tú, forma correcta para vosotros
CONF = {"trato": "tú"}
INTERNAS = (r"\b(lo dijo|me dijo|dijo|según (?:el|la) alumn[oa]|(?:el|la) alumn[oa]|conversaci[oó]n|p[aá]gina de venta|"
            r"no sale en|nota interna|horas (?:por|a la) semana)\b")
YO = (r"\b(escríbeme|llámame|avísame|pregúntame|sígueme|contáctame|me escribes|mi negocio|mi tienda|mi experiencia|"
      r"aprendí|empecé|me pasó|yo)\b")
NOS = r"\b(nosotros|escríbenos|llámanos|avísanos|pregúntanos|síguenos|contáctanos|nos escribes|nuestr[oa]s?|te esperamos|atendemos|aprendimos|empezamos)\b"
REFERENCIAS = r"\b(cap[ií]tulo|paso|m[oó]dulo|lecci[oó]n|episodio|bloque|parte|semana|d[ií]a)\s+\d+\b"


class Reporte:
    def __init__(self):
        self.lineas, self.n = [], {"ERROR": 0, "OJO": 0, "OK": 0}

    def __call__(self, nivel, donde, msg):
        self.n[nivel] += 1
        self.lineas.append(f"{nivel:<6} {donde}: {msg}")


def cifras(texto):
    limpio = re.sub(r"\[[^\]]*\]", " ", texto or "")
    limpio = re.sub(r"https?://\S+|@\w+|#\w+", " ", limpio)
    limpio = re.sub(REFERENCIAS, " ", limpio, flags=re.I)
    limpio = re.sub(r"\b\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|"
                    r"noviembre|diciembre)( de \d{4})?\b", " ", limpio, flags=re.I)
    limpio = re.sub(r"\b\d{1,2}[:.]\d{2}\s?(hs|h|am|pm)?\b|\b\d{1,2}\s?(hs|h|am|pm)\b|\b20\d{2}\b", " ", limpio, flags=re.I)
    hall = []
    for pat in CIFRAS:
        for m in re.finditer(pat, limpio, re.I):
            hall.append((m.start(), m.end(), m.group(0).strip()))
    hall.sort(key=lambda x: (x[0], -x[1]))
    out, fin = [], -1
    for ini, f, t in hall:
        if ini >= fin:
            if t.lower() not in (x.lower() for x in out):
                out.append(t)
            fin = f
    return out


MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
# Solo las fechas que son feriado o fiesta en todos los países hispanos. Los feriados de cada país se buscan con fuente oficial.
COMUNES = {(1, 1): "Año Nuevo", (5, 1): "Día del Trabajo", (12, 24): "Nochebuena", (12, 25): "Navidad", (12, 31): "fin de año"}


def feriado_comun(fecha):
    f = (fecha or "").lower().replace("setiembre", "septiembre")
    m = re.search(r"\b(\d{1,2}) de (" + "|".join(MESES) + r")\b", f)
    if m:
        return COMUNES.get((MESES.index(m.group(2)) + 1, int(m.group(1))))
    m = re.search(r"\b20\d{2}-(\d{2})-(\d{2})\b", f)
    if m:
        return COMUNES.get((int(m.group(1)), int(m.group(2))))
    return None


def con_origen(cifra, origenes):
    c = cifra.lower()
    for o in origenes:
        k = (o.get("cifra") or "").lower()
        if k and (k == c or k in c or c in k):
            return o
    return None


def estilo(r, donde, texto, origenes, vistas, medidas=False):
    if not texto:
        return
    for c in ([] if medidas else cifras(texto)):
        o = con_origen(c, origenes)
        clave = (c.lower(), donde.split(" ")[0])
        if o:
            if clave not in vistas:
                r("OK", donde, f"cifra '{c}': {o.get('origen', '')}")
        elif re.fullmatch(FRECUENCIA, c, re.I):
            r("OJO", donde, f"frecuencia '{c}' sin origen: ¿el alumno lo dijo así? Si dijo 'mucha gente', escribe eso. "
                            "Si es cierto, súmala a 'origenes'")
        else:
            r("OJO", donde, f"cifra '{c}' sin origen: di de dónde sale (alumno o fuente) y súmala a 'origenes', o ponla como [confirmar]")
        vistas.add(clave)
    if "—" in texto or "–" in texto:
        r("ERROR", donde, "tiene guion largo o medio. Cámbialo por punto, coma o dos puntos")
    vosotros = CONF.get("trato") == "vosotros"
    for m in re.finditer(VOSEO, texto, re.I):
        if vosotros and m.group(0).lower() in DUDOSOS_VOSOTROS:
            continue
        r("ERROR", donde, f"voseo: '{m.group(0)}'. Usa la forma de tú")
    clave = ("persona", donde.split(" ")[0])
    if clave not in vistas:
        if not vosotros:
            hall = sorted({m.group(0).lower() for m in re.finditer(VOSOTROS, texto, re.I)})
            if hall:
                r("OJO", donde, f"persona: forma de vosotros ({', '.join(hall[:4])}) y el trato elegido es tú. "
                                "Usa la forma de tú (me escribes, tienes, te) o, si el alumno prefiere vosotros para su público, "
                                "pon \"trato\": \"vosotros\" y úsalo en todo el texto")
                vistas.add(clave)
        else:
            hall = sorted({m.group(0).lower() for m in re.finditer(TU, texto, re.I)})
            if hall:
                r("OJO", donde, f"persona: el trato elegido es vosotros y aparece tú ({', '.join(hall[:4])}). Usa una sola forma")
                vistas.add(clave)
    for m in re.finditer(VOSEO_DUDOSO, texto, re.I):
        r("OJO", donde, f"'{m.group(0)}' puede ser voseo. Si es una orden al lector, usa la forma de tú (elige, abre, escribe)")
    for pat, nombre in CONTRASTE:
        for m in re.finditer(pat, texto, re.I):
            r("OJO", donde, f"{nombre}: '...{m.group(0)}...'. Di la afirmación directa")
    for m in re.finditer(CONFIRMAR, texto, re.I):
        r("OJO", donde, f"queda {m.group(0)}: confírmalo con el alumno antes de vender")
    if re.search(r"\bPENDIENTE\b", texto):
        r("OJO", donde, "enlace PENDIENTE: cámbialo por el enlace real antes de publicar")
    if re.search(r"\bpromedio\b", texto, re.I) and re.search(r"precio|cuesta|\$|S/|€", texto, re.I):
        r("ERROR", donde, "habla de un precio promedio: pon cada producto con su precio real")


def voz(r, donde, textos, voz_pedida):
    junto = "\n".join(t for t in textos if t)
    yo = sorted({m.group(0).lower() for m in re.finditer(YO, junto, re.I)})
    nos = sorted({m.group(0).lower() for m in re.finditer(NOS, junto, re.I)})
    if yo and nos:
        r("OJO", donde, f"mezcla 'yo' ({', '.join(yo[:4])}) y 'nosotros' ({', '.join(nos[:4])}). Usa una sola voz en todo el texto")
    elif voz_pedida == "yo" and nos:
        r("OJO", donde, f"la voz elegida es 'yo' y aparece {', '.join(nos[:4])}")
    elif voz_pedida == "marca" and yo:
        r("OJO", donde, f"la voz elegida es la de la marca (nosotros) y aparece {', '.join(yo[:4])}")


def rango(r, donde, valor, minimo, maximo, unidad, duro=True):
    if valor < minimo or valor > maximo:
        r("ERROR" if duro else "OJO", donde, f"{valor} {unidad}; lo recomendado es de {minimo} a {maximo}")
    else:
        r("OK", donde, f"{valor} {unidad} (de {minimo} a {maximo})")


def fotos(r, donde, bloques, base):
    from comun import ruta_archivo
    for b in bloques or []:
        if b.get("tipo") != "imagen":
            continue
        nombre = b.get("ruta") or "sin archivo"
        if ruta_archivo(b.get("ruta"), base):
            r("OK", donde, f"foto '{nombre}' encontrada")
        else:
            r("OJO", donde, f"FOTO PENDIENTE: no encuentro '{nombre}'. Pídesela al alumno o déjala en el checklist como pendiente")
        if not b.get("pie"):
            r("OJO", donde, f"la foto '{nombre}' no tiene pie: di en una frase qué muestra")
        if not (b.get("alt") or b.get("pie")):
            r("OJO", donde, f"la foto '{nombre}' no tiene texto alternativo ('alt')")


def fuentes_del_pdf(r, d):
    """Qué cifras salen impresas en la página "Fuentes de las cifras" y si alguna parece una nota interna."""
    if d.get("formato") != "ebook" or not d.get("origenes"):
        return
    try:
        from ebook import origenes_del_pdf
    except Exception:
        return
    van = origenes_del_pdf(d)
    r("OK", "fuentes del PDF", f"{len(van)} de {len(d['origenes'])} cifras salen impresas (las que aparecen en el texto del ebook)")
    for o in van:
        m = re.search(INTERNAS, o.get("origen", ""), re.I)
        if m:
            r("OJO", "fuentes del PDF", f"el origen de '{o.get('cifra')}' sale impreso y parece una nota interna ('{m.group(0)}'). "
                                        "Escríbelo para el lector o pon \"en_pdf\": false")


def revisar(d):
    r = Reporte()
    CONF["trato"] = "vosotros" if str(d.get("trato", "")).lower().startswith("vos") else "tú"
    org = d.get("origenes", [])
    vistas = set()
    fmt = d.get("formato")
    vp = d.get("voz", "")
    if fmt not in FORMATOS:
        r("ERROR", "formato", f"'{fmt}' no válido. Usa: {', '.join(FORMATOS)}")
    for o in org:
        if not o.get("origen"):
            r("ERROR", "origenes", f"la cifra '{o.get('cifra')}' no dice de dónde sale")
    # 1 Formato
    el = d.get("eleccion", {})
    if not el.get("por_que"):
        r("OJO", "1 formato", "no dice por qué se eligió este formato")
    if not el.get("siguiente_paso"):
        r("OJO", "1 formato", "no dice qué vendes después (el siguiente paso del cliente)")
    estilo(r, "1 promesa", d.get("promesa", ""), org, vistas)
    if d.get("promesa"):
        rango(r, "1 promesa", palabras([d["promesa"]]), 6, 25, "palabras", duro=False)
    # 2 Validación
    va = d.get("validacion", {})
    if len(va.get("frases", [])) < 5:
        r("OJO", "2 validación", f"{len(va.get('frases', []))} frases de búsqueda; con menos de 5 la demanda no está clara")
    for p in va.get("parecidos", []):
        if not str(p.get("enlace", "")).startswith("http"):
            r("ERROR", "2 validación", f"el parecido '{p.get('nombre')}' no tiene enlace")
    if not va.get("veredicto"):
        r("OJO", "2 validación", "falta el veredicto (avanzar, ajustar el tema o cambiar el formato)")
    # Título y subtítulo
    t = d.get("titulo", "")
    if not t:
        r("ERROR", "título", "falta el título")
    else:
        rango(r, "título", len(t), 8, 60, "caracteres", duro=len(t) > 80)
        estilo(r, "título", t, org, vistas)
    if d.get("subtitulo"):
        rango(r, "subtítulo", len(d["subtitulo"]), 20, 140, "caracteres", duro=False)
        estilo(r, "subtítulo", d["subtitulo"], org, vistas)
    if len(t.split()) > 8:
        r("OJO", "portada", f"el título tiene {len(t.split())} palabras: en la miniatura cuesta leerlo. Prueba con 8 o menos")
    # 3 Índice
    ind = d.get("indice", [])
    lim_ind = {"ebook": (3, 10), "minicurso": (3, 6), "webinar": (4, 8), "podcast": (4, 10)}.get(fmt, (3, 10))
    if not ind:
        r("ERROR", "3 índice", "falta el índice")
    else:
        rango(r, "3 índice", len(ind), *lim_ind, "partes", duro=False)
        for i, x in enumerate(ind, 1):
            estilo(r, f"3 índice {i}", x.get("titulo", "") + "\n" + x.get("resumen", ""), org, vistas)
    # 4 Contenido
    if fmt == "ebook":
        eb = d.get("ebook", {})
        caps = eb.get("capitulos", [])
        if not caps:
            r("ERROR", "4 ebook", "no tiene capítulos")
        if ind and caps and len(ind) != len(caps):
            r("OJO", "4 ebook", f"el índice tiene {len(ind)} partes y el ebook {len(caps)} capítulos")
        total = 0
        partes = []
        if eb.get("introduccion"):
            partes.append(("4 introducción", eb["introduccion"].get("bloques", [])))
        for i, c in enumerate(caps, 1):
            partes.append((f"4 capítulo {i}", [{"texto": c.get("titulo", "")}, {"texto": c.get("en_este_capitulo", "")}] + c.get("bloques", [])))
        if eb.get("cierre"):
            ll = eb["cierre"].get("llamada", {})
            partes.append(("4 cierre", eb["cierre"].get("bloques", []) + [{"texto": ll.get("texto", "")}, {"texto": ll.get("boton", "")}]))
            if not str(ll.get("enlace", "")).startswith("http"):
                r("OJO", "4 cierre", "el enlace del siguiente paso está PENDIENTE o vacío")
        else:
            r("OJO", "4 ebook", "sin cierre con el siguiente paso: el lector termina y no sabe qué hacer")
        if eb.get("autor"):
            partes.append(("4 sobre el autor", [{"texto": eb["autor"].get("bio", "")}]))
        for donde, bl in partes:
            fotos(r, donde, bl, d.get("_base"))
            textos = textos_de_bloques(bl)
            recetas = textos_de_recetas(bl)
            n = palabras(textos) + palabras(recetas)
            total += n
            for tx in recetas:
                estilo(r, donde, tx, org, vistas, medidas=True)
            if donde.startswith("4 capítulo"):
                rango(r, donde, n, 250, 3000, "palabras", duro=False)
            for tx in textos:
                estilo(r, donde, tx, org, vistas)
            voz(r, donde, textos, vp)
        rango(r, "4 ebook total", total, 1500, 20000, "palabras", duro=False)
        fuentes_del_pdf(r, d)
    elif fmt in ("webinar", "podcast", "minicurso"):
        g = d.get("guion", {})
        bl = g.get("bloques", [])
        if not bl:
            r("ERROR", "4 guion", "no tiene bloques")
        ppm = g.get("palabras_por_minuto") or 140
        pedido = sum(b.get("minutos", 0) for b in bl)
        obj = g.get("duracion_objetivo_min") or pedido
        lim = {"webinar": (30, 75), "podcast": (5, 60), "minicurso": (3, 15)}[fmt]
        rango(r, "4 duración", obj, *lim, "minutos", duro=False)
        if pedido and obj and abs(pedido - obj) > 0.1 * obj:
            r("OJO", "4 duración", f"los bloques suman {pedido} min y la duración pedida es {obj} min")
        est = 0
        for i, b in enumerate(bl, 1):
            n = palabras([b.get("texto", "")])
            m = n / ppm
            est += m
            if b.get("minutos") and (m < 0.6 * b["minutos"] or m > 1.4 * b["minutos"]):
                r("OJO", f"4 bloque {i}", f"{n} palabras se leen en ~{m:.1f} min y el bloque tiene {b['minutos']} min")
            estilo(r, f"4 bloque {i}", b.get("texto", ""), org, vistas)
            if not b.get("objetivo"):
                r("OJO", f"4 bloque {i}", "sin objetivo")
        if obj:
            if abs(est - obj) / obj > 0.15:
                r("OJO", "4 guion", f"se lee en ~{est:.0f} min y la meta es {obj} min (a {ppm} palabras por minuto)")
            else:
                r("OK", "4 guion", f"se lee en ~{est:.0f} min, meta {obj} min")
        voz(r, "4 guion", [b.get("texto", "") for b in bl], vp)
        if g.get("material"):
            fotos(r, "4 material", g["material"].get("bloques", []), d.get("_base"))
            for tx in textos_de_bloques(g["material"].get("bloques", [])):
                estilo(r, "4 material", tx, org, vistas)
        if fmt == "webinar":
            if g.get("fecha") and not g.get("fecha_fuente"):
                r("OJO", "4 fecha", f"la fecha {g['fecha']} no dice con qué fuente oficial se revisaron los feriados del país")
            fe = feriado_comun(g.get("fecha", ""))
            if fe:
                r("OJO", "4 fecha", f"la fecha cae en {fe}, feriado o fecha de fiesta en los países hispanos: cambia la fecha o confírmala con el alumno")
            if not g.get("fecha"):
                r("OJO", "4 fecha", "sin fecha del webinar: revisa feriados del país con fuente oficial al elegirla")
        pub = g.get("publicar", {})
        if pub:
            estilo(r, "4 para publicar", pub.get("titulo", "") + "\n" + pub.get("descripcion", ""), org, vistas)
            if fmt == "podcast" and len(pub.get("descripcion", "")) > 4000:
                r("OJO", "4 para publicar", "la descripción pasa de 4000 caracteres: guías de podcasting dicen que Apple corta ahí. Acórtala")
        else:
            r("OJO", "4 para publicar", "falta el título y la descripción para publicar o invitar")
    # 5 Portada
    po = d.get("portada", {})
    if po.get("estilo") == "imagen" and not po.get("imagen"):
        r("ERROR", "5 portada", "el estilo es 'imagen' y no hay ruta de imagen de fondo")
    if po.get("costo") and not po.get("aprobado"):
        r("ERROR", "5 portada", "hay costo de IA sin aprobación del alumno ('aprobado': true)")
    # 6 Página de venta
    pv = d.get("pagina_venta", {})
    if not pv:
        r("ERROR", "6 página de venta", "falta la página de venta")
    else:
        if pv.get("titulo"):
            rango(r, "6 título", len(pv["titulo"]), 10, 80, "caracteres", duro=False)
        else:
            r("ERROR", "6 página de venta", "falta el título")
        rango(r, "6 qué incluye", len(pv.get("que_incluye", [])), 3, 8, "puntos", duro=False)
        rango(r, "6 preguntas", len(pv.get("preguntas", [])), 3, 6, "preguntas", duro=False)
        if not pv.get("precios"):
            r("ERROR", "6 precio", "falta el precio (o 'Gratis a cambio de tu correo')")
        b = pv.get("boton", {})
        if not b.get("texto"):
            r("ERROR", "6 botón", "falta el texto del botón")
        elif len(b["texto"]) > 30:
            r("OJO", "6 botón", f"el botón tiene {len(b['texto'])} caracteres; corto se lee mejor (30 o menos)")
        if not str(b.get("enlace", "")).startswith("http"):
            r("OJO", "6 botón", "enlace PENDIENTE: cámbialo por el enlace real antes de publicar")
        textos = [pv.get(k, "") for k in ("titulo", "subtitulo", "problema", "sobre_ti", "garantia")]
        textos += pv.get("para_quien", []) + pv.get("que_incluye", [])
        textos += [f"{p.get('producto', '')} {p.get('precio', '')} {p.get('nota', '')}" for p in pv.get("precios", [])]
        textos += [q.get("p", "") + "\n" + q.get("r", "") for q in pv.get("preguntas", [])]
        for tx in textos:
            estilo(r, "6 página de venta", tx, org, vistas)
        voz(r, "6 página de venta", textos, vp)
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json", nargs="?"); ap.add_argument("--texto"); ap.add_argument("--salida")
    ap.add_argument("--desde", help="revisa el texto de un archivo (evita problemas de comillas en la consola)")
    ap.add_argument("--min", type=int, default=6); ap.add_argument("--max", type=int, default=25)
    ap.add_argument("--trato", choices=["tú", "tu", "vosotros"], default="tú")
    a = ap.parse_args()
    if a.desde:
        a.texto = Path(a.desde).read_text(encoding="utf-8")
    if a.texto is not None:
        r = Reporte()
        CONF["trato"] = "vosotros" if a.trato == "vosotros" else "tú"
        estilo(r, "texto", a.texto, [], set())
        voz(r, "texto", [a.texto], "")
        rango(r, "texto", palabras([a.texto]), a.min, a.max, "palabras", duro=False)
    elif a.json:
        r = revisar(leer_json(a.json))
    else:
        sys.exit(__doc__)
    orden = {"ERROR": 0, "OJO": 1, "OK": 2}
    lineas = sorted(r.lineas, key=lambda x: orden[x.split()[0]])
    resumen = f"\nResumen: {r.n['ERROR']} errores, {r.n['OJO']} OJO, {r.n['OK']} OK"
    if r.n["OJO"]:
        resumen += "\nAntes de mostrar los textos, di de dónde sale cada cifra marcada OJO y resuelve cada [confirmar] y PENDIENTE con el alumno."
    salida = "\n".join(lineas) + resumen
    print(salida)
    if a.salida:
        Path(a.salida).write_text(salida + "\n", encoding="utf-8")
    sys.exit(1 if r.n["ERROR"] else 0)


if __name__ == "__main__":
    main()
