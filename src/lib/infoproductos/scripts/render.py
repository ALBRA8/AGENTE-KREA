"""Convierte HTML o SVG en PNG o PDF con el navegador que ya tiene la computadora (Edge o Chrome). Sin dependencias.

Uso:
  python render.py entrada.html salida.pdf                 -> PDF (tamaño definido por @page en el HTML)
  python render.py entrada.svg salida.png --ancho 1024 --alto 1024
  python render.py entrada.html salida.png --ancho 1400 --alto 900

Espera unos segundos a que carguen las fuentes de Google. Si falla, dice qué navegador buscó.
"""
import argparse, os, platform, shutil, subprocess, sys, tempfile, time
from pathlib import Path

CANDIDATOS = {
    "Windows": [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"],
    "Darwin": ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
               "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"],
    "Linux": ["google-chrome", "chromium", "chromium-browser", "microsoft-edge"],
}


def navegador():
    for c in CANDIDATOS.get(platform.system(), []):
        p = c if os.path.isabs(c) else shutil.which(c)
        if p and os.path.exists(p):
            return p
    sys.exit("No encontré Edge ni Chrome. Buscados: " + ", ".join(CANDIDATOS.get(platform.system(), [])))


def render(entrada, salida, ancho=1200, alto=900, espera_ms=8000):
    entrada, salida = Path(entrada).resolve(), Path(salida).resolve()
    salida.parent.mkdir(parents=True, exist_ok=True)
    if salida.exists():
        salida.unlink()
    perfil = tempfile.mkdtemp(prefix="render-perfil-")
    args = [navegador(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
            f"--user-data-dir={perfil}", f"--virtual-time-budget={espera_ms}"]
    if salida.suffix.lower() == ".pdf":
        args += ["--no-pdf-header-footer", f"--print-to-pdf={salida}"]
    else:
        args += [f"--window-size={ancho},{alto}", f"--screenshot={salida}"]
    args.append(entrada.as_uri())
    p = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    limite = time.time() + 120
    while time.time() < limite:
        if salida.exists() and salida.stat().st_size > 0 and p.poll() is not None:
            break
        time.sleep(0.5)
    if p.poll() is None:
        p.kill()
    shutil.rmtree(perfil, ignore_errors=True)
    if not salida.exists() or salida.stat().st_size == 0:
        sys.exit(f"No se generó {salida}")
    print(f"listo: {salida} ({salida.stat().st_size // 1024} KB)")
    return salida


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada"); ap.add_argument("salida")
    ap.add_argument("--ancho", type=int, default=1200); ap.add_argument("--alto", type=int, default=900)
    ap.add_argument("--espera", type=int, default=8000)
    a = ap.parse_args()
    render(a.entrada, a.salida, a.ancho, a.alto, a.espera)
