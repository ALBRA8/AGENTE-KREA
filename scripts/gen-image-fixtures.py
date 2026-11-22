#!/usr/bin/env python3
"""Genera fixtures reales de imagen para los tests de portada de pdf-factory.

- tiny.jpg  : JPEG real 64x64 (PIL)
- tiny.png  : PNG real 64x64 (PIL)

Se ejecuta UNA VEZ a mano; los archivos resultantes se versionan para que
vitest no dependa de PIL.
"""
from PIL import Image, ImageDraw
import os

out = "/home/z/my-project/src/lib/__tests__/fixtures"
os.makedirs(out, exist_ok=True)

img = Image.new("RGB", (64, 64), (24, 47, 93))
d = ImageDraw.Draw(img)
d.ellipse((12, 12, 52, 52), fill=(230, 180, 34))
img.save(os.path.join(out, "tiny.jpg"), "JPEG", quality=90)

img_png = Image.new("RGB", (64, 64), (11, 87, 73))
d2 = ImageDraw.Draw(img_png)
d2.rectangle((16, 16, 48, 48), fill=(255, 255, 255))
img_png.save(os.path.join(out, "tiny.png"), "PNG")

for name in ("tiny.jpg", "tiny.png"):
    p = os.path.join(out, name)
    with open(p, "rb") as f:
        head = f.read(4)
    print(name, os.path.getsize(p), "bytes, magic:", head.hex())
