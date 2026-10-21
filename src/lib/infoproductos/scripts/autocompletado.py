"""Qué busca la gente en Google sobre un tema, en un país (autocompletado público de Google), sin cuenta.
Complemento de OpenSEO para encontrar frases y preguntas, y plan B si OpenSEO no está conectado (GUIA-OPENSEO.md).

Uso:
  python autocompletado.py "clases de yoga" --pais cl
  python autocompletado.py "clases de yoga" "pilates a domicilio" --pais cl --expandir --salida busquedas.json
  python autocompletado.py "menú del día" --pais pe --expandir --excluir "españa|madrid|gijón|bilbao" --salida b.json
  python autocompletado.py "menú" --pais pe --incluir "lima|miraflores" > busquedas.txt
  python autocompletado.py "esmaltar ceramica" --pais es --youtube

--pais: código de 2 letras (mx, co, ar, pe, cl, es, us...). --expandir agrega variantes: "cómo", "precio",
"cerca de mí", "para", "mejor" y el abecedario. Va despacio (1 consulta por segundo) para no ser bloqueado.
Empieza con temas cortos (el servicio solo, 1 a 3 palabras) y agrega la ciudad, la comuna o el barrio después.
El autocompletado no completa frases largas con pocas búsquedas: "yoga para empresas santiago" puede traer 0 frases
y "yoga para empresas" sí trae. Si un tema trae 0 frases, el script lo avisa y sugiere versiones más cortas.
Úsalo con temas sin lugar ("menú del día"); los temas con lugar ("menú miraflores") córrelos sin --expandir,
porque el abecedario trae sobre todo nombres de otros negocios.

Filtros (palabras o lugares separados por | o por coma; sin contar mayúsculas ni tildes):
  --excluir "españa|madrid|puerto rico"   descarta las frases que tienen alguna de esas palabras.
  --incluir "lima|miraflores"             se queda solo con las frases que tienen alguna de esas palabras.
Aunque pidas --pais, Google mezcla sugerencias de otros lugares (ciudades de otros países): sácalas con --excluir.
Todas las frases que pasan los filtros quedan en la lista de frases ("temas" en el JSON). Las que parecen el nombre
de otro negocio ("menú de panchita miraflores") además se marcan como "posibles nombres": revísalas antes de usarlas.
Lo que sigue a "de" o "del" no se marca cuando es un lugar conocido ("santiago de chile", "santiago de compostela").
  --apartar-nombres                       saca de la lista de frases las que parecen nombres de otros negocios.
  --no-son-nombres "alfa|beta"            palabras del oficio que no son nombres de negocio (por ejemplo
                                          "fade bajo al piso de alfa"): esas frases ya no se marcan.
--youtube: usa el autocompletado de YouTube en vez del de Google (para títulos de video).
La salida a pantalla y a archivo (--salida, o redirigiendo con >) va en UTF-8: las tildes salen bien también en Windows.
El JSON de salida guarda "temas_sin_frases" para no presentarlos como temas con resultados, y "nombres_apartados"
(true si se usó --apartar-nombres: solo entonces las frases de "posibles_nombres" no están en "temas").
Mide variedad de búsquedas, sin el número de búsquedas: una frase sugerida significa que mucha gente la escribe.
El volumen real al mes sale de OpenSEO (get_keyword_metrics).

Versión unificada del kit común (16-oct-2026): junta las mejoras de las copias de los cursos 11, 13 y 16.
"""
import argparse, json, re, string, sys, time, unicodedata, urllib.parse, urllib.request

URL = "https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl={gl}&q={q}"
PREFIJOS = ["cómo {t}", "{t} precio", "{t} cerca de mí", "{t} para", "mejor {t}", "{t} o", "{t} vs", "qué {t}"]
POCAS = 5
YOUTUBE = False


def norm(t):
    t = unicodedata.normalize("NFD", t or "")
    return "".join(c for c in t if unicodedata.category(c) != "Mn").lower().strip()


# Palabras comunes después de "de" o "del" que no son nombres de negocio. Se guardan sin tildes ni eñe,
# igual que la frase que se compara (norm), para que "mañana", "niños" o "uñas" sí cuenten como comunes.
COMUNES = {norm(w) for w in """la el los las mi tu su un una casa dia semana hoy mañana noche tarde comida pollo pescado
carne res cerdo mariscos verduras pasta arroz menu precio precios calidad lujo barrio ciudad centro playa mar oficina
oficinas niños niñas mujer mujeres hombre hombres bebe bebes mascota mascotas perro perros gato gatos estudiantes empresa
empresas evento eventos boda bodas cumpleaños fiesta fiestas mayo junio julio agosto setiembre septiembre octubre noviembre
diciembre enero febrero marzo abril lunes martes miércoles jueves viernes sábado domingo yoga pilates baile cocina belleza
uñas cabello pelo peso verano invierno temporada moda vestir trabajo estudio encargo regalo""".split()}

# Lugares conocidos que aparecen después de "de" o "del" ("santiago de chile", "fisioterapia de valencia",
# "santiago del estero"): no son nombres de negocio. Países y ciudades hispanas más nombres compuestos frecuentes.
LUGARES = {norm(w) for w in """mexico chile colombia peru argentina españa ecuador bolivia uruguay paraguay venezuela
guatemala honduras nicaragua panama cuba dominicana salvador costa rica puerto rico usa eeuu america latinoamerica
lima bogota santiago quito guayaquil cuenca caracas montevideo asuncion sucre cochabamba tegucigalpa managua
madrid barcelona sevilla valencia malaga zaragoza bilbao granada alicante murcia cordoba cadiz valladolid vigo gijon
oviedo santander salamanca toledo palma mallorca canarias tenerife ibiza navarra galicia asturias cataluña andalucia
compostela henares sagunto estero tucuman rosario mendoza salta neuquen plata cuyo
medellin cali barranquilla cartagena bucaramanga pereira manizales antioquia
guadalajara monterrey puebla tijuana merida leon queretaro cancun oaxaca veracruz chihuahua toluca jalisco cdmx
arequipa cusco cuzco trujillo piura chiclayo callao miraflores valparaiso concepcion temuco antofagasta vitacura
providencia chiloe""".split()}


def patron(lista):
    """'lima|miraflores' o 'lima, miraflores' -> regex por palabra completa, sin tildes."""
    partes = [norm(p) for p in re.split(r"[|,]", lista or "") if norm(p)]
    return re.compile(r"\b(" + "|".join(re.escape(p) for p in partes) + r")\b") if partes else None


def posible_nombre(frase, tema, incluir=None, oficio=None):
    """True si la frase agrega 'de X' o 'del X' con una palabra que no es común ni del tema (ej. 'menú de panchita')."""
    f, t = norm(frase), norm(tema)
    resto = f.replace(t, " ", 1) if t in f else f
    for m in re.finditer(r"\b(de|del)\s+([a-zñ]+)", resto):
        w = m.group(2)
        if w not in COMUNES and w not in LUGARES and w not in t.split() and not (incluir and incluir.search(w)) and not (oficio and oficio.search(w)):
            return True
    return False


def sugerir(q, gl):
    url = URL.format(gl=gl, q=urllib.parse.quote(q)) + ("&ds=yt" if YOUTUBE else "")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for intento in range(3):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read().decode("utf-8", "replace"))[1]
        except Exception:
            time.sleep(3 * (intento + 1))
    return []


def mas_cortos(t):
    """Versiones más cortas de un tema: sin la última palabra (casi siempre la ciudad) y servicio + última palabra."""
    w = t.split()
    if len(w) < 2:
        return []
    op = [" ".join(w[:-1])]
    if len(w) >= 3:
        op.append(f"{w[0]} {w[-1]}")
    return [o for o in dict.fromkeys(op) if o and o != t]


if __name__ == "__main__":
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8")
        except Exception:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("temas", nargs="+"); ap.add_argument("--pais", default="mx")
    ap.add_argument("--expandir", action="store_true"); ap.add_argument("--salida")
    ap.add_argument("--incluir", help='quedarse solo con frases que tengan alguna de estas palabras: "lima|miraflores"')
    ap.add_argument("--excluir", help='descartar frases que tengan alguna de estas palabras: "españa|madrid"')
    ap.add_argument("--youtube", action="store_true", help="autocompletado de YouTube (para títulos de video)")
    ap.add_argument("--no-son-nombres", help='palabras del oficio que no son nombres de negocio: "alfa|beta"')
    ap.add_argument("--apartar-nombres", action="store_true",
                    help="saca de la lista de frases las que parecen nombres de otros negocios (por defecto solo se marcan)")
    a = ap.parse_args()
    YOUTUBE = a.youtube
    inc, exc, oficio = patron(a.incluir), patron(a.excluir), patron(a.no_son_nombres)
    res, nombres, descartadas, vacios = {}, {}, {}, []
    for t in a.temas:
        consultas = [t]
        if a.expandir:
            consultas += [p.format(t=t) for p in PREFIJOS] + [f"{t} {c}" for c in string.ascii_lowercase]
        todas = []
        for q in consultas:
            for s in sugerir(q, a.pais):
                s = s.lower().strip()
                if s not in todas:
                    todas.append(s)
            time.sleep(1)
        frases, noms, fuera = [], [], 0
        for s in todas:
            n = norm(s)
            if (exc and exc.search(n)) or (inc and not inc.search(n)):
                fuera += 1
            else:
                es_nombre = posible_nombre(s, t, inc, oficio)
                if es_nombre:
                    noms.append(s)
                if not (es_nombre and a.apartar_nombres):
                    frases.append(s)
        res[t], nombres[t], descartadas[t] = frases, noms, fuera
        filtro = f" · descartadas por filtro: {fuera}" if (inc or exc) else ""
        print(f"\n## {t} ({a.pais}{', YouTube' if a.youtube else ''}): {len(frases)} frases{filtro} · posibles nombres de negocios: {len(noms)}")
        if not todas:
            vacios.append(t)
            sug = mas_cortos(t)
            print(f"AVISO: \"{t}\" trajo 0 frases. El autocompletado no completa frases largas con pocas búsquedas.")
            if sug:
                print("  Prueba más corto: " + " · ".join(f'"{s}"' for s in sug) + ". Agrega la ciudad o el barrio después.")
            else:
                print("  Prueba con otra palabra para el mismo servicio (la que usaría tu cliente).")
        elif not frases:
            vacios.append(t)
            motivo = "por los filtros o como posibles nombres (--apartar-nombres)" if a.apartar_nombres else "por los filtros"
            print(f"AVISO: \"{t}\" trajo {len(todas)} frases, pero todas quedaron fuera {motivo}.")
        elif len(frases) < POCAS:
            print(f"AVISO: \"{t}\" trajo solo {len(frases)} frases. Si quieres más, pruébalo más corto o sin la ciudad.")
        marca = set(noms)
        for f in frases[:60]:
            print("-", f + ("   [posible nombre]" if f in marca else ""))
        if noms:
            if a.apartar_nombres:
                print(f"\n### Posibles nombres de otros negocios, apartados de la lista ({len(noms)}): no los uses en tus textos. "
                      "Si alguno es parte del oficio (una técnica, un producto), vuelve a correr con --no-son-nombres")
            else:
                print(f"\n### Marcadas como posibles nombres de otros negocios ({len(noms)}): siguen en la lista de frases. "
                      "Revísalas: si es el nombre de otro negocio, no lo uses en tus textos; si es parte del oficio, úsala.")
            for f in noms[:20]:
                print("-", f)
    if vacios:
        print(f"\nTemas sin frases ({len(vacios)}): " + ", ".join(vacios) + ". No los muestres como temas con resultados.")
    if a.salida:
        with open(a.salida, "w", encoding="utf-8") as f:
            json.dump({"pais": a.pais, "fuente": "youtube" if a.youtube else "google", "incluir": a.incluir or "",
                       "excluir": a.excluir or "", "temas": res, "posibles_nombres": nombres,
                       "nombres_apartados": a.apartar_nombres,
                       "descartadas_por_filtro": descartadas, "temas_sin_frases": vacios}, f, ensure_ascii=False, indent=1)
        print("\nguardado:", a.salida)
