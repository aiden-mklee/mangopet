"""Build the GitHub Pages site in docs/ from src/prototype.html.

  python3 tools/build.py            # subset the font, then build docs/
  python3 tools/build.py --no-font  # skip the font subset (no fonttools needed)

Sources
  src/engine.js       game rules (pure, no DOM); also loaded by tools/golden.js in Node
  src/prototype.html  screen, drawing and input; an HTML fragment (no <html>/<head>) with a slot for the engine

Every page gets the engine inlined, so each output is a single self-contained file.

Outputs
  docs/index.html   phone beta: real time, no dev lab, no ads, installable (PWA)
  docs/lab.html     the full prototype with the dev lab (time speed, test buttons)
  docs/manifest.webmanifest, docs/sw.js, docs/icon-*.png, docs/.nojekyll
  .out/artifact.html  the prototype fragment with the engine inlined, for publishing as a claude.ai artifact
  app/www/index.html  the native app page (Capacitor): the phone build without the web-only install bits
"""
import base64, hashlib, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'prototype.html')
ENGINE = os.path.join(ROOT, 'src', 'engine.js')
SLOT = '<script>/* @engine: tools/build.py inlines src/engine.js here */</script>'
DOCS = os.path.join(ROOT, 'docs')
FONT = os.path.join(ROOT, 'tools', 'fonts', 'Galmuri11.woff2')
FONT_RE = re.compile(r"@font-face\{font-family:'Galmuri11'[^\n]*\n")


def subset_font():
    """Re-embed Galmuri11 with only the characters the prototype uses. Run after any text change."""
    s = open(SRC, encoding='utf-8').read()
    m = FONT_RE.search(s)
    rest = s[:m.start()] + s[m.end():]
    engine = open(ENGINE, encoding='utf-8').read()
    chars = ''.join(sorted(set(rest) | set(engine) | {chr(c) for c in range(32, 127)}))
    with tempfile.TemporaryDirectory() as d:
        txt, out = os.path.join(d, 'chars.txt'), os.path.join(d, 'sub.woff2')
        open(txt, 'w', encoding='utf-8').write(chars)
        subprocess.run(['pyftsubset', FONT, f'--text-file={txt}', '--flavor=woff2', f'--output-file={out}'], check=True)
        b64 = base64.b64encode(open(out, 'rb').read()).decode()
    face = "@font-face{font-family:'Galmuri11';src:url(data:font/woff2;base64," + b64 + ") format('woff2');font-display:swap}\n"
    open(SRC, 'w', encoding='utf-8').write(s[:m.start()] + face + s[m.end():])


def rep(s, a, b):
    assert s.count(a) == 1, f'build anchor not found exactly once: {a[:70]!r}'
    return s.replace(a, b)


def phone(s):
    """Phone beta: real time, starts at the current local time, separate save key, device only."""
    s = rep(s, "<title>망고펫 프로토타입</title>", "<title>망고펫</title>")
    s = rep(s, "const KEY='dotpet-proto-v1';", "const KEY='mangopet-beta-v1';")
    s = rep(s, "function fresh(){return Object.assign(E.fresh(Math.random()*2**32),{t:8*60,speed:60,",
            "function fresh(){const n=new Date();return Object.assign(E.fresh(Math.random()*2**32),{t:n.getHours()*60+n.getMinutes(),speed:1,")
    s = rep(s, "[hidden]{display:none!important}", """[hidden]{display:none!important}
.lab,.ad,header.top{display:none!important}
.wrap{grid-template-columns:minmax(0,1fr)!important;max-width:440px;margin:0 auto}
html,body{background:var(--bg1,#f3eee6)!important}
body{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)!important;min-height:100dvh}
.phone{position:static!important;border:0!important;border-radius:0!important;min-height:100dvh;justify-content:center;max-width:none!important}
.betanote{max-width:340px;margin:0;color:color-mix(in srgb,var(--adink,#000) 45%,transparent);font-size:11px;text-align:center;line-height:1.6}""")
    s = rep(s, '    <div class="ad" id="adBot">',
            '    <p class="betanote">베타 · 실제 시간으로 흘러가요. 앱을 닫아도 시간은 흐르고, 다시 열면 그동안의 일이 반영돼요. '
            '이 기기에만 저장되고, 알림과 위젯은 아직 없어요.</p>\n    <div class="ad" id="adBot">')
    i = s.rindex("requestAnimationFrame(loop);")
    return s[:i] + """// fit the whole device into the screen height
function fitWindow(){const fw=document.querySelector('.flipwrap');fw.style.zoom=1;const tot=document.querySelector('.phone').scrollHeight,own=fw.getBoundingClientRect().height+44;
  const z=Math.max(.55,Math.min(1,(innerHeight-(tot-own)-12)/own));fw.style.zoom=z}
addEventListener('resize',fitWindow);setTimeout(fitWindow,50);setTimeout(fitWindow,600);
""" + s[i:]


def native(s):
    """Native app: same as the phone beta, minus the web beta note (the app has real notifications)."""
    s = phone(s)
    s = re.sub(r'    <p class="betanote">.*?</p>\n', '', s, count=1)
    # no bundler: the Capacitor runtime and the notifications plugin come in as plain scripts (copied next to the page)
    s = s.replace('</style>', '</style>\n<script src="capacitor.js"></script>\n<script src="local-notifications.js"></script>', 1)
    return rep(s, "const KEY='mangopet-beta-v1';", "const KEY='mangopet-app-v1';")


def lab(s):
    s = rep(s, "<title>망고펫 프로토타입</title>", "<title>망고펫 랩</title>")
    return rep(s, "const KEY='dotpet-proto-v1';", "const KEY='mangopet-lab-v1';")


HEAD = '''<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover{extra}">
{pwa}'''
PWA = '''<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="망고펫">
<meta name="theme-color" content="#f3eee6">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="icon-192.png">
'''


def document(frag, pwa):
    """Wrap the artifact fragment into a full HTML document."""
    frag = frag.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    t = frag.index('<title>')
    te = frag.index('</style>') + len('</style>')
    head = HEAD.format(extra=',user-scalable=no' if pwa else '', pwa=PWA if pwa else '')
    tail = "\n<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>" if pwa else ''
    return head + frag[t:te] + '\n</head><body>\n' + frag[te:] + tail + '\n</body></html>\n'


def main():
    if '--no-font' not in sys.argv:
        subset_font()
    s = open(SRC, encoding='utf-8').read()
    assert s.count(SLOT) == 1, 'engine slot missing from src/prototype.html'
    s = s.replace(SLOT, '<script>\n' + open(ENGINE, encoding='utf-8').read() + '</script>')
    os.makedirs(DOCS, exist_ok=True)
    os.makedirs(os.path.join(ROOT, '.out'), exist_ok=True)
    open(os.path.join(ROOT, '.out', 'artifact.html'), 'w', encoding='utf-8').write(s)
    index = document(phone(s), pwa=True)
    open(os.path.join(DOCS, 'index.html'), 'w', encoding='utf-8').write(index)
    open(os.path.join(DOCS, 'lab.html'), 'w', encoding='utf-8').write(document(lab(s), pwa=False))
    os.makedirs(os.path.join(ROOT, 'app', 'www'), exist_ok=True)
    open(os.path.join(ROOT, 'app', 'www', 'index.html'), 'w', encoding='utf-8').write(document(native(s), pwa=False))
    nm = os.path.join(ROOT, 'node_modules', '@capacitor')
    for src, dst in (('core/dist/capacitor.js', 'capacitor.js'), ('local-notifications/dist/plugin.js', 'local-notifications.js')):
        if os.path.exists(os.path.join(nm, src)):
            shutil.copy(os.path.join(nm, src), os.path.join(ROOT, 'app', 'www', dst))
        else:
            print('note: run npm install to copy', dst, 'into app/www')
    for n in ('icon-192.png', 'icon-512.png', 'apple-touch-icon.png'):
        shutil.copy(os.path.join(ROOT, 'assets', 'icons', n), os.path.join(DOCS, n))
    json.dump({"name": "망고펫", "short_name": "망고펫", "start_url": "./", "scope": "./", "display": "standalone",
               "background_color": "#f3eee6", "theme_color": "#f3eee6", "orientation": "portrait",
               "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                         {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}]},
              open(os.path.join(DOCS, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # cache name follows the page content, so installed copies pick up each new build
    ver = hashlib.sha1(index.encode()).hexdigest()[:8]
    open(os.path.join(DOCS, 'sw.js'), 'w').write(f"""const C='mangopet-{ver}';
self.addEventListener('install',e=>{{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'])));self.skipWaiting()}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()}});
// network first, cache as the offline fallback
self.addEventListener('fetch',e=>{{if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}}).catch(()=>caches.match(e.request)))}});
""")
    open(os.path.join(DOCS, '.nojekyll'), 'w').close()
    print('built docs/ ·', ver)


if __name__ == '__main__':
    main()
