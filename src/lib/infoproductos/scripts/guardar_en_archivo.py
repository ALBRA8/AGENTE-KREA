"""Guarda en el archivo de tu negocio: cada elemento confirmado (sección del curso 18), los datos básicos y, si el
alumno llega sin ellos, los datos de cliente y de marca. No toca lo demás (US$0).

Uso:
  python guardar_en_archivo.py archivo-de-mi-negocio.md --elemento "1 Formato de tu infoproducto" --texto "Ebook gratis..."
  python guardar_en_archivo.py archivo-de-mi-negocio.md --elemento "3 Índice" --desde indice.md
  python guardar_en_archivo.py archivo-de-mi-negocio.md --gasto "Portada con fondo IA | Nano Banana 2.1 | US$0.08"
  python guardar_en_archivo.py archivo-de-mi-negocio.md --crear      (crea el archivo desde la plantilla si no existe;
                                                                      si ya existe, avisa y no lo toca)
  python guardar_en_archivo.py archivo-de-mi-negocio.md --elemento "Trato con su público" --texto "tú"
        (España: tú o vosotros; va en la sección del curso 18. Si llega por --datos, también se guarda ahí)
  python guardar_en_archivo.py archivo-de-mi-negocio.md --datos "Nombre del negocio=Barro y Lumbre" --datos "Ciudad y país=Sevilla, España"
  python guardar_en_archivo.py archivo-de-mi-negocio.md --seccion cliente --datos "Cliente ideal=Mujeres de 30 a 55 que..."
  python guardar_en_archivo.py archivo-de-mi-negocio.md --seccion marca --datos "Colores=#B5562F, #F3EAD8, #33302C"

Qué hace:
  - Antes de escribir, deja una copia archivo-de-mi-negocio.md.AAAAMMDD-HHMMSS.bak (nunca pisa una copia anterior).
  - Dentro de "## Piezas y contenido (cursos 06 a 18)" crea o usa "### Infoproductos (curso 18)" y, adentro,
    "#### <elemento>". Si el elemento ya estaba, lo reemplaza; los otros elementos y las otras secciones no se tocan.
  - --gasto agrega una fila a la tabla "## Gastos de IA" (Fecha | Qué | Modelo | Costo) con la fecha de hoy.
  - --datos "campo=valor" (se repite) llena "- campo: valor" en la sección de --seccion:
      basicos (por defecto) -> "## Datos básicos": si el campo ya existe lo reemplaza, si no lo agrega al final.
      cliente -> "## Cliente y competencia (curso 03)" y marca -> "## Marca (curso 04)": son de los cursos 03 y 04,
      así que solo llena campos vacíos o nuevos. Si el campo ya tiene valor, no lo pisa y avisa (usa --reemplazar si
      el alumno lo pidió).
Guarda cada elemento apenas el alumno lo confirma: si la conversación se corta, no se pierde nada.
"""
import argparse, datetime as dt, re, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import respaldar  # noqa: E402

SECCION = "## Piezas y contenido (cursos 06 a 18)"
MIA = "### Infoproductos (curso 18)"
GASTOS = "## Gastos de IA"
SECCIONES = {"basicos": "## Datos básicos", "cliente": "## Cliente y competencia (curso 03)", "marca": "## Marca (curso 04)"}
ORDEN = ["## Datos básicos", "## Cliente y competencia (curso 03)", "## Marca (curso 04)"]
PLANTILLA = Path(__file__).parent.parent / "plantillas" / "archivo-de-mi-negocio.md"


def bloque_seccion(texto, titulo, nivel):
    """(inicio, fin) del bloque que empieza en la línea 'titulo' y termina antes del siguiente título de nivel <= nivel."""
    m = re.search(rf"^{re.escape(titulo)}\s*$", texto, re.M)
    if not m:
        return None
    sig = re.compile(rf"^#{{1,{nivel}}} ", re.M).search(texto, m.end())
    return m.start(), (sig.start() if sig else len(texto))


def guardar_elemento(texto, elemento, contenido):
    if SECCION not in texto:
        pos = texto.find(GASTOS)
        nuevo = f"{SECCION}\n\n"
        texto = (texto[:pos] + nuevo + texto[pos:]) if pos >= 0 else (texto.rstrip() + "\n\n" + nuevo)
    if not re.search(rf"^{re.escape(MIA)}\s*$", texto, re.M):
        ini, fin = bloque_seccion(texto, SECCION, 2)
        texto = texto[:fin].rstrip() + f"\n\n{MIA}\n\n" + texto[fin:].lstrip("\n")
    ini, fin = bloque_seccion(texto, MIA, 3)
    mia = texto[ini:fin]
    cab = f"#### {elemento}"
    cuerpo = f"{cab}\n{contenido.strip()}\n\n"
    b = bloque_seccion(mia, cab, 4)
    if b:
        mia = mia[:b[0]] + cuerpo + mia[b[1]:]
    else:
        mia = mia.rstrip() + "\n\n" + cuerpo
    return texto[:ini] + mia.rstrip() + "\n\n" + texto[fin:].lstrip("\n")


def guardar_datos(texto, seccion, pares, reemplazar=False):
    """Llena '- campo: valor' dentro de la sección. Devuelve (texto, avisos)."""
    titulo = SECCIONES[seccion]
    avisos = []
    if not re.search(rf"^{re.escape(titulo)}\s*$", texto, re.M):
        # La sección va antes de la siguiente de ORDEN que exista, o antes de Piezas y contenido.
        sigue = [t for t in ORDEN[ORDEN.index(titulo) + 1:] + [SECCION, GASTOS] if t in texto]
        pos = texto.find(sigue[0]) if sigue else len(texto)
        texto = texto[:pos].rstrip() + f"\n\n{titulo}\n\n" + texto[pos:].lstrip("\n")
    ini, fin = bloque_seccion(texto, titulo, 2)
    bloque = texto[ini:fin].rstrip("\n")
    for campo, valor in pares:
        linea = f"- {campo}: {valor}"
        m = re.search(rf"^- {re.escape(campo)}:[ \t]*(.*)$", bloque, re.M)
        if m:
            actual = m.group(1).strip()
            if actual and seccion != "basicos" and not reemplazar:
                avisos.append(f"'{campo}' ya tiene valor en {titulo} ({actual[:60]}): no lo cambié")
                continue
            bloque = bloque[:m.start()] + linea + bloque[m.end():]
        else:
            bloque += "\n" + linea
    return texto[:ini] + bloque + "\n\n" + texto[fin:].lstrip("\n"), avisos


def agregar_gasto(texto, gasto):
    partes = [x.strip() for x in gasto.split("|")]
    while len(partes) < 3:
        partes.append("")
    fila = f"| {dt.date.today().isoformat()} | {partes[0]} | {partes[1]} | {partes[2]} |"
    if GASTOS not in texto:
        return texto.rstrip() + f"\n\n{GASTOS}\n| Fecha | Qué | Modelo | Costo |\n|---|---|---|---|\n{fila}\n"
    ini, fin = bloque_seccion(texto, GASTOS, 2)
    bloque = texto[ini:fin].rstrip()
    if "| Fecha |" not in bloque:
        bloque += "\n| Fecha | Qué | Modelo | Costo |\n|---|---|---|---|"
    resto = texto[fin:].lstrip("\n")
    return texto[:ini] + bloque + "\n" + fila + "\n" + ("\n" + resto if resto.strip() else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("archivo"); ap.add_argument("--elemento"); ap.add_argument("--texto"); ap.add_argument("--desde")
    ap.add_argument("--gasto"); ap.add_argument("--crear", action="store_true")
    ap.add_argument("--datos", action="append", default=[], help='"campo=valor"; se puede repetir')
    ap.add_argument("--seccion", choices=list(SECCIONES), default="basicos")
    ap.add_argument("--reemplazar", action="store_true", help="en cliente o marca, cambia un campo que ya tiene valor")
    a = ap.parse_args()
    pares = []
    for x in a.datos:
        if "=" not in x:
            sys.exit(f'--datos "{x}": usa la forma "campo=valor"')
        campo, valor = x.split("=", 1)
        if not campo.strip() or not valor.strip():
            sys.exit(f'--datos "{x}": falta el campo o el valor')
        pares.append((campo.strip(), valor.strip()))
    # "Trato con su público" es del curso 18: va en su sección, fuera de Datos básicos.
    trato = [v for c, v in pares if a.seccion == "basicos" and re.match(r"(?i)trato\b", c)]
    pares = [(c, v) for c, v in pares if not (a.seccion == "basicos" and re.match(r"(?i)trato\b", c))]
    if trato:
        if a.elemento:
            sys.exit('Guarda "Trato con su público" en una llamada aparte: --elemento "Trato con su público" --texto "tú"')
        print(f'Aviso: "Trato con su público" no es de Datos básicos: lo guardo en "{MIA}".')
        a.elemento, a.texto, a.desde = "Trato con su público", trato[-1], None
    p = Path(a.archivo)
    if p.exists() and a.crear:
        print(f"Aviso: {p} ya existe: no lo creé de nuevo ni lo cambié con la plantilla. Léelo y guarda en él.")
        if not (a.elemento or a.gasto or pares):
            sys.exit(1)
    if not p.exists():
        if a.crear or a.elemento or a.gasto or pares:
            shutil.copy2(PLANTILLA, p)
            print(f"creado desde la plantilla: {p}")
        else:
            sys.exit(f"No existe {p}. Usa --crear.")
    if not (a.elemento or a.gasto or pares):
        return
    copia = respaldar(p)
    texto = p.read_text(encoding="utf-8")
    if a.elemento:
        contenido = Path(a.desde).read_text(encoding="utf-8") if a.desde else (a.texto or "")
        if not contenido.strip():
            sys.exit("Falta el contenido: usa --texto o --desde")
        texto = guardar_elemento(texto, a.elemento, contenido)
    if a.gasto:
        texto = agregar_gasto(texto, a.gasto)
    if pares:
        texto, avisos = guardar_datos(texto, a.seccion, pares, a.reemplazar)
        for av in avisos:
            print("Aviso:", av)
        print(f"{len(pares) - len(avisos)} dato(s) en {SECCIONES[a.seccion]}")
    p.write_text(texto, encoding="utf-8")
    print(f"guardado en {p}" + (f" (copia: {copia.name})" if copia else ""))


if __name__ == "__main__":
    main()
