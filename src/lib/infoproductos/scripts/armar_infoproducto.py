"""Arma el infoproducto completo desde infoproducto.json (US$0): revisa, y si no hay errores arma todo.

Uso:
  python armar_infoproducto.py infoproducto.json carpeta/              -> revisa y arma
  python armar_infoproducto.py infoproducto.json carpeta/ --revisar    -> solo revisa (rápido)
  python armar_infoproducto.py infoproducto.json carpeta/ --imagen fondo.png   (fondo de portada hecho con fal.ai)

Crea en la carpeta:
  revision.txt                         resultado de revisar_infoproducto.py (ERROR, OJO, OK)
  portada.jpg y portada-miniatura.png  al tamaño de la plataforma del formato
  ebook: <slug>.pdf                    el ebook para leer en pantalla (portada, índice con páginas, capítulos, cierre),
                                       sin hojas en blanco
         <slug>-para-imprimir.pdf      el mismo ebook para imprimir: cada capítulo abre en hoja impar
  webinar, podcast o minicurso: guion-<slug>.pdf   estructura y guion completo (sin audio ni video)
  pagina-de-venta.txt / .html / -movil.png
Si hay ERROR, se detiene y no arma nada. Los OJO no frenan el armado: salen resaltados en amarillo en el PDF.
Si los archivos ya existen, deja una copia .bak con fecha y hora antes de reemplazarlos.
"""
import argparse, re, subprocess, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import leer_json, respaldar  # noqa: E402

AQUI = Path(__file__).parent


def slug(t):
    s = "".join(c for c in unicodedata.normalize("NFD", t.lower()) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:50] or "infoproducto"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json"); ap.add_argument("carpeta"); ap.add_argument("--revisar", action="store_true")
    ap.add_argument("--imagen")
    a = ap.parse_args()
    c = Path(a.carpeta)
    c.mkdir(parents=True, exist_ok=True)
    rev = subprocess.run([sys.executable, str(AQUI / "revisar_infoproducto.py"), a.json, "--salida", str(c / "revision.txt")],
                         capture_output=True, text=True, encoding="utf-8")
    print(rev.stdout.strip())
    if rev.returncode != 0:
        print("\nHay ERROR: corrígelos en el JSON y vuelve a correr. No armé nada.")
        sys.exit(1)
    if a.revisar:
        return
    d = leer_json(a.json)
    fmt = d.get("formato", "ebook")
    from portada import armar_portada
    from pagina_venta import armar_pagina
    s = slug(d.get("titulo", ""))
    principal = c / (f"{s}.pdf" if fmt == "ebook" else f"guion-{s}.pdf")
    imprimible = c / f"{s}-para-imprimir.pdf"
    for f in [c / "portada.jpg", principal, c / "pagina-de-venta.txt"] + ([imprimible] if fmt == "ebook" else []):
        respaldar(f)
    port, mini = armar_portada(d, c / "portada.jpg", imagen=a.imagen)
    d.setdefault("portada", {})["archivo"] = str(port)
    if fmt == "ebook":
        from ebook import armar_ebook
        armar_ebook(d, principal, a.imagen)
        armar_ebook(d, imprimible, a.imagen, imprimir=True)
    else:
        from guion import armar_guion
        armar_guion(d, principal)
    armar_pagina(d, c)
    print("\nListo. Revisa antes de entregar:")
    print(f"- {principal.name}: página por página (portada, índice, que ninguna sección quede partida)")
    if fmt == "ebook":
        print(f"- {imprimible.name}: la versión para imprimir (capítulos en hoja impar)")
    print(f"- {mini.name}: que el título se lea a tamaño chico")
    print("- pagina-de-venta-movil.png y pagina-de-venta.txt: textos completos, sin [confirmar] ni PENDIENTE al publicar")


if __name__ == "__main__":
    main()
