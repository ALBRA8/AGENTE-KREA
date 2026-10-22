"""Agrupa lo que busca la gente (salida de autocompletado.py) para validar el tema y el formato de un infoproducto (US$0).

Uso:  python validar_demanda.py busquedas.json [otro.json ...] --salida demanda   (crea demanda.txt y demanda.json)
      --excluir "mexico|españa"   quita frases con esas palabras (separadas por | o por coma) (por ejemplo, otros países)

Qué entrega:
  - preguntas que se repiten (cómo, qué, por qué, cuándo, cuánto...): son los capítulos, lecciones o episodios candidatos
  - señales de formato: cuántas frases piden pdf o libro (ebook), curso o clases (minicurso), video o en vivo (webinar),
    podcast o audio (podcast)
  - frases de compra (precio, comprar, dónde) y frases de "gratis"
  - un veredicto orientativo: demanda clara, demanda floja o sin datos (acorta el tema)
Ojo: el autocompletado mide qué tanto se repite una búsqueda, no cuántas personas la hacen. El veredicto es una pista;
lo confirma lo que dicen los clientes del alumno.
"""
import argparse, json, re, sys, unicodedata
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SENALES = {
    "ebook": ["pdf", "libro", "ebook", "e-book", "guia", "manual", "descargar"],
    "minicurso": ["curso", "clases", "taller", "aprender", "certificado", "capacitacion", "tutorial", "paso a paso"],
    "webinar": ["webinar", "en vivo", "masterclass", "charla", "conferencia", "video", "youtube", "zoom"],
    "podcast": ["podcast", "audio", "escuchar", "spotify", "entrevista"],
}
PREGUNTA = re.compile(r"^(como|que|por que|porque|cuando|cuanto|cuantos|cuantas|cual|cuales|donde|para que|se puede|es bueno|es malo|"
                      r"puedo|debo|hay que)\b")
COMPRA = ["precio", "comprar", "donde comprar", "costo", "cuesta", "venta", "barato", "mejor", "opiniones", "kit"]
GRATIS = ["gratis", "free", "sin costo"]


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def tiene(f, palabras):
    return any(re.search(rf"\b{re.escape(p)}\b", f) for p in palabras)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("entradas", nargs="+"); ap.add_argument("--salida", default="demanda")
    ap.add_argument("--excluir", default="")
    a = ap.parse_args()
    exc = [norm(x.strip()) for x in a.excluir.replace("|", ",").split(",") if x.strip()]
    frases, pais, temas, nombres = [], set(), [], []
    for e in a.entradas:
        d = json.loads(Path(e).read_text(encoding="utf-8"))
        pais.add(d.get("pais", "?"))
        for t, lista in d.get("temas", {}).items():
            temas.append(t)
            for f in lista:
                if f not in frases and not any(x in norm(f) for x in exc):
                    frases.append(f)
        # autocompletado.py marca las frases que parecen nombres de otros negocios (siguen en "temas", salvo con
        # --apartar-nombres). Cuentan como señal de formato una sola vez: "manual de huerto en casa pdf" pide un ebook.
        for lista in d.get("posibles_nombres", {}).values():
            nombres += [f for f in lista if f not in nombres and not any(x in norm(f) for x in exc)]
    preguntas = [f for f in frases if PREGUNTA.match(norm(f))]
    solo_nombres = [f for f in nombres if f not in frases]
    formatos = {k: [f for f in frases + solo_nombres if tiene(norm(f), v)] for k, v in SENALES.items()}
    compra = [f for f in frases if tiene(norm(f), COMPRA)]
    gratis = [f for f in frases if tiene(norm(f), GRATIS)]
    n = len(frases)
    if n == 0:
        veredicto = "sin datos: acorta el tema a 2 o 3 palabras y vuelve a correr autocompletado.py"
    elif n >= 40 and len(preguntas) >= 8:
        veredicto = "demanda clara: la gente busca el tema y hace preguntas concretas. Las preguntas son tu índice"
    elif n >= 15:
        veredicto = "demanda media: hay búsquedas, pero pocas preguntas. Prueba un tema vecino más amplio o pregunta a tus clientes"
    else:
        veredicto = "demanda floja: casi nadie lo busca así. Ajusta el tema (más amplio o con las palabras de tus clientes)"
    orden_fmt = sorted(formatos, key=lambda k: -len(formatos[k]))
    res = {"pais": sorted(pais), "temas": temas, "total_frases": n, "preguntas": preguntas,
           "senales_formato": {k: len(v) for k, v in formatos.items()}, "ejemplos_formato": {k: v[:8] for k, v in formatos.items()},
           "compra": compra, "gratis": gratis, "posibles_nombres": nombres, "veredicto": veredicto, "excluidas": exc}
    L = [f"VALIDACIÓN CON LA DEMANDA · temas: {', '.join(temas)} · país: {', '.join(sorted(pais))}",
         f"Frases distintas: {n} (autocompletado de Google: mide qué tanto se repite una búsqueda, no cuántas personas la hacen)",
         f"Veredicto orientativo: {veredicto}", "",
         f"## Preguntas que se repiten ({len(preguntas)})"] + [f"- {f}" for f in preguntas[:40]]
    L += ["", "## Señales de formato (frases que piden cada formato)"]
    for k in orden_fmt:
        L.append(f"- {k}: {len(formatos[k])}" + (f" · ej.: {'; '.join(formatos[k][:5])}" if formatos[k] else ""))
    if nombres:
        L += ["", f"## Posibles nombres de otros negocios o autores ({len(nombres)}): no los uses en tus textos"] + [f"- {f}" for f in nombres[:15]]
    L += ["", f"## Frases de compra ({len(compra)})"] + [f"- {f}" for f in compra[:20]]
    L += ["", f"## Frases con 'gratis' ({len(gratis)})"] + [f"- {f}" for f in gratis[:15]]
    if gratis and len(gratis) > len(compra):
        L.append("Pista: hay más 'gratis' que compra. Un ebook o un webinar gratis a cambio del correo puede abrir la puerta a tu producto pagado.")
    txt = "\n".join(L)
    print(txt)
    Path(a.salida + ".txt").write_text(txt + "\n", encoding="utf-8")
    Path(a.salida + ".json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nguardado: {a.salida}.txt y {a.salida}.json")


if __name__ == "__main__":
    main()
