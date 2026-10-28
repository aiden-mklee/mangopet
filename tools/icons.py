"""Draw the app icon and write every size the web, iOS and Android builds need.

  python3 tools/icons.py

Main icon (E): a baby peeking out of a cracked egg on mango yellow, drawn on a pixel grid.
Alternate icon (A, mango + LCD) lives in assets/icons/alt-lcd-1024.png; it is not wired up yet
(see NEXT.md: icon switching is checked on a real phone).
"""
import math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024
MANGO_HI, MANGO = (252, 214, 110), (236, 180, 55)
BROWN, SPARK_COL = (70, 52, 20), (150, 105, 30)
SHELL_FILL = (255, 226, 140)  # a lighter mango, so the icon stays two colour families

# 14 x 14 grid: baby's head above a zigzag crack, the lower half of the egg below
BABY = ["..####..", ".######.", "##.##.##", "########"]
LOWER = ["#............#", "#............#", "#............#", ".#..........#.", ".#..........#.",
         "..#........#..", "...##....##...", ".....####....."]
SPARK = [(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)]


def cells(rows):
    return {(r, c) for r, row in enumerate(rows) for c, ch in enumerate(row) if ch == '#'}


BABY_C = {(r, c + 3) for r, c in cells(BABY)}
RIM = {(5 if c % 2 == 0 else 4, c) for c in range(14)}
SHELL = RIM | {(r + 6, c) for r, c in cells(LOWER)}


def inside():
    out = set()
    for r, row in enumerate(LOWER):
        cs = [c for c, ch in enumerate(row) if ch == '#']
        if len(cs) >= 2:
            out |= {(r + 6, c) for c in range(cs[0] + 1, cs[-1])}
    out |= {(5, c) for c in range(1, 13)}
    return out - RIM


def put(d, cs, x0, y0, cell, col, gap=.08):
    g = max(1, int(cell * gap)) if gap else 0
    for r, c in cs:
        d.rectangle([x0 + c * cell + g, y0 + r * cell + g, x0 + (c + 1) * cell - g, y0 + (r + 1) * cell - g], fill=col)


def background(size):
    im = Image.new('RGB', (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            t = min(1, math.hypot(x / size - .35, y / size - .25))
            px[x, y] = tuple(int(MANGO_HI[i] + (MANGO[i] - MANGO_HI[i]) * t) for i in range(3))
    return im


def art(size, scale=1.0):
    """The egg and sparkles on a transparent layer; scale < 1 shrinks it towards the centre."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = size / S * scale
    cell = 54 * k
    ox = size / 2 - 7 * cell
    oy = size / 2 - 7 * cell
    put(d, inside(), ox, oy, cell, SHELL_FILL, gap=0)
    put(d, SHELL, ox, oy, cell, BROWN)
    put(d, BABY_C, ox, oy, cell, BROWN)
    for x, y in [(150, 200), (800, 280), (740, 140)]:
        put(d, SPARK, size / 2 + (x - S / 2) * k, size / 2 + (y - S / 2) * k, (cell / 2 + 8 * k), SPARK_COL, gap=.1)
    return im


def full_icon(size=S):
    im = background(size).convert('RGBA')
    im.alpha_composite(art(size))
    return im.convert('RGB')


def save(im, *path):
    p = os.path.join(ROOT, *path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)


def splashes():
    """Launch screens: the icon art (egg and baby) small in the middle of flat mango yellow, at every size the
    iOS and Android projects already have. iOS fills the screen with the square image, so the art stays centred."""
    targets = []
    ios = os.path.join(ROOT, 'app', 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset')
    targets += [os.path.join(ios, f) for f in sorted(os.listdir(ios)) if f.endswith('.png')]
    res = os.path.join(ROOT, 'app', 'android', 'app', 'src', 'main', 'res')
    targets += [os.path.join(res, d, 'splash.png') for d in sorted(os.listdir(res)) if os.path.exists(os.path.join(res, d, 'splash.png'))]
    for t in targets:
        w, h = Image.open(t).size
        im = Image.new('RGBA', (w, h), (246, 198, 78, 255))
        side = int(min(w, h) * .42)
        a = art(side * 2, scale=1.0).resize((side, side), Image.LANCZOS)
        im.alpha_composite(a, ((w - side) // 2, (h - side) // 2))
        im.convert('RGB').save(t)
    print('splash screens:', len(targets))


def main():
    big = full_icon()
    save(big, 'assets', 'icons', 'icon-1024.png')
    # web (PWA)
    for name, n in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
        save(big.resize((n, n), Image.LANCZOS), 'assets', 'icons', name)
    # iOS: one 1024 image, no transparency
    save(big, 'app', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png')
    # Android: legacy square and round icons, plus the adaptive icon's foreground (art inside the safe zone)
    res = ('app', 'android', 'app', 'src', 'main', 'res')
    for dpi, n in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        sq = big.resize((n, n), Image.LANCZOS)
        save(sq, *res, f'mipmap-{dpi}', 'ic_launcher.png')
        m = Image.new('L', (n, n), 0)
        ImageDraw.Draw(m).ellipse([0, 0, n - 1, n - 1], fill=255)
        rnd = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        rnd.paste(sq, (0, 0), m)
        save(rnd, *res, f'mipmap-{dpi}', 'ic_launcher_round.png')
        fg = n * 108 // 48
        save(art(fg * 4, scale=.8).resize((fg, fg), Image.LANCZOS), *res, f'mipmap-{dpi}', 'ic_launcher_foreground.png')
    splashes()
    bg = os.path.join(ROOT, *res, 'values', 'ic_launcher_background.xml')
    open(bg, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F6C64E</color>\n</resources>\n')
    print('icons written')


if __name__ == '__main__':
    main()
