#!/usr/bin/env python3
"""Sonda de entorno de los scripts de infoproductos.

Imprime JSON con el runtime detectado para que TypeScript pueda degradar
con gracia: {"python": "3.12.16", "chrome": "chromium" | null, "pil": bool,
"pymupdf": bool, "pypdf": bool}.

- Chrome (render.py) es necesario para: ebook.py, guion.py, portada.py,
  pagina_venta.py (PNG) y revisar_estilo.py en modo HTML.
- PyMuPDF es necesario para revisar_estilo.py sobre PDFs.
- PIL es necesaria para portada.py (JPG) y pagina_venta.py (recorte PNG).
"""
import json
import shutil
import sys


def main():
    out = {"python": ".".join(map(str, sys.version_info[:3]))}
    chrome = None
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"):
        if shutil.which(name):
            chrome = name
            break
    out["chrome"] = chrome
    for mod, key in (("PIL", "pil"), ("fitz", "pymupdf"), ("pypdf", "pypdf")):
        try:
            __import__(mod)
            out[key] = True
        except Exception:
            out[key] = False
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
