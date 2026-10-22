"""Arma en PDF el guion y la estructura de un webinar, un episodio de podcast o la primera lección de un minicurso (US$0).

Uso:  python guion.py infoproducto.json guion.pdf

No genera audio ni video: entrega lo que lees o grabas tú.
Qué arma (A4): ficha de la sesión o del episodio, tabla de estructura (bloque, minutos pedidos, objetivo, palabras,
minutos estimados al leer), el guion completo por bloque en letra grande para leer en voz alta, el material
de apoyo (hoja de trabajo de la lección, si hay), el texto para publicar y las fuentes de las cifras.
Minutos estimados = palabras / palabras_por_minuto (140 por defecto, es una velocidad de conversación tranquila;
mídete leyendo un bloque en voz alta y cambia el número si hablas más rápido o más lento).

JSON: formato (webinar|podcast|minicurso), titulo, subtitulo, negocio, marca,
 guion {titulo, tipo, duracion_objetivo_min, palabras_por_minuto, fecha, fecha_fuente, plataforma,
        bloques [{nombre, minutos, objetivo, texto, notas}], material {titulo, bloques}, publicar {titulo, descripcion}},
 indice [{titulo, resumen}]  (temporada del podcast, bloques del webinar o módulos del minicurso), origenes
"""
import sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import E, bloques_html, css_contenido, leer_json, marca, parrafos, palabras, resaltar  # noqa: E402
from render import render  # noqa: E402

NOMBRE = {"webinar": "Guion del webinar", "podcast": "Guion del episodio", "minicurso": "Guion de la lección"}


def estimar(g):
    ppm = g.get("palabras_por_minuto") or 140
    filas = []
    for b in g.get("bloques", []):
        n = palabras([b.get("texto", "")])
        filas.append((b, n, n / ppm))
    return ppm, filas


def armar_html(d, k):
    g = d.get("guion", {})
    fmt = d.get("formato", "webinar")
    ppm, filas = estimar(g)
    total_pedido = sum(b.get("minutos", 0) for b, _, _ in filas)
    total_est = sum(m for _, _, m in filas)
    tabla = "".join(
        f'<tr><td><b>{i}. {resaltar(b.get("nombre", ""))}</b></td><td>{b.get("minutos", "")}</td>'
        f'<td>{resaltar(b.get("objetivo", ""))}</td><td>{n}</td><td>{m:.1f}</td></tr>'
        for i, (b, n, m) in enumerate(filas, 1))
    def bloque(i, b):
        notas = f'<div class="notas">{resaltar(b["notas"])}</div>' if b.get("notas") else ""
        return (f'<section class="bloque"><div class="cab"><span class="n">{i:02d}</span>'
                f'<span class="nom">{resaltar(b.get("nombre", ""))}</span><span class="min">{b.get("minutos", "")} min</span></div>'
                f'{notas}<div class="leer">{parrafos(b.get("texto", ""))}</div></section>')
    bloques = "".join(bloque(i, b) for i, (b, _, _) in enumerate(filas, 1))
    ficha = []
    for et, v in (("Formato", {"webinar": "Webinar en vivo", "podcast": "Episodio de podcast", "minicurso": "Lección de minicurso"}.get(fmt, fmt)),
                  ("Duración pedida", f'{g.get("duracion_objetivo_min", "")} min'),
                  ("Duración estimada al leer", f"{total_est:.0f} min (a {ppm} palabras por minuto)"),
                  ("Fecha", g.get("fecha", "")), ("Fuente de la fecha", g.get("fecha_fuente", "")),
                  ("Dónde", g.get("plataforma", ""))):
        if v and v.strip() not in ("min",):
            ficha.append(f"<tr><th>{E(et)}</th><td>{resaltar(v)}</td></tr>")
    indice = ""
    if d.get("indice"):
        tit = {"podcast": "Temporada", "webinar": "Estructura de la sesión", "minicurso": "Módulos y lecciones"}.get(fmt, "Índice")
        items = "".join(f'<li><b>{resaltar(x.get("titulo", ""))}</b>{": " + resaltar(x["resumen"]) if x.get("resumen") else ""}'
                        f'{"<ul>" + "".join(f"<li>{resaltar(l)}</li>" for l in x.get("lecciones", [])) + "</ul>" if x.get("lecciones") else ""}</li>'
                        for x in d["indice"])
        indice = f'<section class="sec"><h2>{tit}</h2><ol>{items}</ol></section>'
    material = ""
    if g.get("material"):
        material = (f'<section class="nueva"><h2>{resaltar(g["material"].get("titulo", "Material de apoyo"))}</h2>'
                    f'{bloques_html(g["material"].get("bloques"), d.get("_base"))}</section>')
    publicar = ""
    if g.get("publicar"):
        p = g["publicar"]
        publicar = (f'<section class="sec"><h2>Para publicar</h2><div class="caja"><b>{resaltar(p.get("titulo", ""))}</b>'
                    f'{parrafos(p.get("descripcion", ""))}</div></section>')
    fuentes = ""
    if d.get("origenes"):
        fuentes = ('<section class="sec"><h2>Fuentes de las cifras</h2><ul class="fu">' + "".join(
            f'<li><b>{resaltar(o.get("cifra", ""))}</b>: {resaltar(o.get("origen", ""))}{" · " + E(o["enlace"]) if o.get("enlace") else ""}</li>'
            for o in d["origenes"]) + "</ul></section>")
    dif = ""
    if total_pedido and abs(total_est - total_pedido) / total_pedido > 0.15:
        dif = (f'<p class="alerta">El texto se lee en unos {total_est:.0f} min y pediste {total_pedido} min. '
               f'Ajusta el largo de los bloques o mídete leyendo en voz alta.</p>')
    pm = k["ep"]
    pie_txt = "font:500 7pt '" + k["t_txt"] + "',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:" + pm["gris60"]
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">{k["links"]}<style>
@page{{size:A4;margin:24mm 22mm 28mm;background:{pm["claro"]};
 @bottom-left{{content:"{E(d.get("negocio", {}).get("nombre", ""))}";{pie_txt};vertical-align:top;padding-top:8mm}}
 @bottom-right{{content:counter(page, decimal-leading-zero);{pie_txt};vertical-align:top;padding-top:8mm}}}}
*{{box-sizing:border-box}}body{{margin:0;font-family:'{k["t_txt"]}',sans-serif;font-size:10.5pt;line-height:1.5;color:{pm["oscuro"]};background:{pm["claro"]};
 -webkit-print-color-adjust:exact;print-color-adjust:exact}}
p,li{{max-width:120mm}}
h1,h2{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};color:{pm["oscuro"]};margin:0;break-after:avoid}}h1{{font-size:32pt;line-height:1.05;letter-spacing:-.02em}}
h2{{font-size:20pt;line-height:1.15;margin:10mm 0 4mm}} .sub{{font-size:13pt;color:{pm["oscuro"]};margin:4mm 0 10mm}}
.etq{{font-weight:500;letter-spacing:.08em;text-transform:uppercase;font-size:7.5pt;color:{pm["acento_texto"]};margin-bottom:3mm}}
.sec{{break-inside:avoid}} .nueva{{break-before:page}}
table.f th{{text-align:left;width:52mm;color:{pm["gris60"]};font-weight:500}} table.f td,table.f th{{padding:2.6mm 2mm 2.6mm 0;border-bottom:.5pt solid {pm["gris15"]};vertical-align:top}}
table.f,table.e{{border-collapse:collapse;width:100%}}
table.e th{{text-align:left;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;font-weight:500;color:{pm["gris60"]};border-bottom:1pt solid {pm["oscuro"]};padding:0 2mm 2mm 0}}
table.e td{{padding:2.6mm 2mm 2.6mm 0;border-bottom:.5pt solid {pm["gris15"]};vertical-align:top;font-variant-numeric:tabular-nums}}
table.e tr{{break-inside:avoid}}
.bloque{{margin:7mm 0}} .cab{{display:flex;align-items:baseline;gap:4mm;border-top:1pt solid {pm["oscuro"]};padding-top:2.5mm;break-after:avoid}}
.cab .n{{font-size:7.5pt;letter-spacing:.08em;font-weight:500;color:{pm["acento_texto"]};font-variant-numeric:tabular-nums}}
.cab .nom{{font-family:'{k["t_tit"]}',serif;font-weight:{k["peso"]};font-size:13pt;flex:1}} .cab .min{{color:{pm["gris60"]};font-size:8pt}}
.notas{{font-size:8.5pt;color:{pm["gris60"]};margin:2mm 0;break-after:avoid}}
.leer{{font-size:12pt;line-height:1.6;margin-top:2mm}} .leer p{{margin:0 0 3.2mm;orphans:3;widows:3}}
.caja{{border-top:.5pt solid {pm["gris15"]};padding-top:3mm}} .fu{{font-size:8pt}}
.alerta{{border-top:1pt solid {pm["acento_texto"]};color:{pm["acento_texto"]};padding:2mm 0;font-weight:500}}
{css_contenido(k)}
</style></head><body>
<div class="etq">{E(NOMBRE.get(fmt, "Guion"))}</div><h1>{resaltar(g.get("titulo") or d.get("titulo", ""))}</h1>
<div class="sub">{resaltar(d.get("titulo", "") if g.get("titulo") else d.get("subtitulo", ""))} · {E(d.get("negocio", {}).get("autor") or d.get("negocio", {}).get("nombre", ""))}</div>
<section class="sec"><table class="f">{"".join(ficha)}</table>{dif}</section>
<section class="sec"><h2>Estructura</h2><table class="e"><tr><th>Bloque</th><th>Min pedidos</th><th>Objetivo</th><th>Palabras</th><th>Min al leer</th></tr>{tabla}
<tr><td><b>Total</b></td><td><b>{total_pedido}</b></td><td></td><td><b>{sum(n for _, n, _ in filas)}</b></td><td><b>{total_est:.1f}</b></td></tr></table></section>
{indice}
<section class="nueva"><h2>Guion completo</h2>{bloques}</section>
{material}{publicar}{fuentes}
</body></html>"""


def armar_guion(d, salida):
    k = marca(d)
    tmp = Path(tempfile.mkdtemp()) / "guion.html"
    tmp.write_text(armar_html(d, k), encoding="utf-8")
    render(tmp, salida, espera_ms=8000)
    ppm, filas = estimar(d.get("guion", {}))
    print(f"guion {d.get('formato')}: {len(filas)} bloques, ~{sum(m for _, _, m in filas):.0f} min al leer -> {salida}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    armar_guion(leer_json(sys.argv[1]), sys.argv[2])
