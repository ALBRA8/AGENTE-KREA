"""Contraste de colores (fórmula WCAG 2.x). Sin dependencias.

Uso:
  python contraste.py "#C8285F" "#FFF8EC"            -> contraste entre dos colores
  python contraste.py --paleta paleta.json            -> tabla de cada color de texto sobre cada fondo

paleta.json: {"colores": [{"nombre": "Fucsia", "hex": "#C8285F", "rol": "texto|fondo|ambos"}, ...]}
Lectura: 4.5 o más = se lee bien en letra chica; 3 a 4.5 = solo títulos grandes; menos de 3 = no usar para texto.
"""
import json, sys


def lum(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return round((max(la, lb) + 0.05) / (min(la, lb) + 0.05), 2)


def veredicto(r):
    return "texto chico OK" if r >= 4.5 else ("solo títulos grandes" if r >= 3 else "no usar para texto")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) == 2 and not a[0].startswith("--"):
        r = ratio(a[0], a[1])
        print(f"{a[0]} sobre {a[1]}: {r}:1 ({veredicto(r)})")
    elif len(a) == 2 and a[0] == "--paleta":
        cols = json.load(open(a[1], encoding="utf-8"))["colores"]
        textos = [c for c in cols if c.get("rol", "ambos") in ("texto", "ambos")]
        fondos = [c for c in cols if c.get("rol", "ambos") in ("fondo", "ambos")]
        print("| Texto | Fondo | Contraste | Uso |\n|---|---|---|---|")
        for t in textos:
            for f in fondos:
                if t["hex"].lower() != f["hex"].lower():
                    r = ratio(t["hex"], f["hex"])
                    print(f"| {t['nombre']} {t['hex']} | {f['nombre']} {f['hex']} | {r}:1 | {veredicto(r)} |")
    else:
        print(__doc__)
