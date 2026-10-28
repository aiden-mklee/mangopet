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
  docs/privacy.html  the privacy policy (copied from src/privacy.html)
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
BETA = '베타 0.1'  # bump when friends get a new round to test
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
    s = rep(s, "REALTIME=false,ADS=true;", "REALTIME=true,ADS=false;")
    s = rep(s, "function fresh(){return Object.assign(E.fresh(Math.random()*2**32),{t:8*60,speed:60,",
            "function fresh(){const n=new Date();return Object.assign(E.fresh(Math.random()*2**32),{t:n.getHours()*60+n.getMinutes(),speed:1,")
    s = rep(s, "[hidden]{display:none!important}", """[hidden]{display:none!important}
html,body{touch-action:manipulation}
.lab,.ad,header.top{display:none!important}
.wrap{grid-template-columns:minmax(0,1fr)!important;max-width:440px;margin:0 auto}
html,body{background:var(--bg1,#f3eee6)!important}
body{padding:0!important;margin:0!important;min-height:100dvh}
.wrap{padding:0!important}
/* the backdrop runs under the status bar and home indicator; only the content keeps clear of them */
.phone{position:static!important;border:0!important;border-radius:0!important;min-height:100dvh;justify-content:center;max-width:none!important;
  padding-top:calc(env(safe-area-inset-top,0px) + 14px)!important;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 16px)!important}
body.sheeted .phone{justify-content:flex-start!important}
.betanote{max-width:340px;margin:0;color:color-mix(in srgb,var(--adink,#000) 45%,transparent);font-size:11px;text-align:center;line-height:1.6}""")
    s = rep(s, '    <div class="ad" id="adBot">',
            '    <p class="betanote">베타 · 실제 시간으로 흘러가요. 앱을 닫아도 시간은 흐르고, 다시 열면 그동안의 일이 반영돼요. '
            '이 기기에만 저장되고, 알림과 위젯은 아직 없어요.</p>\n    <div class="ad" id="adBot">')
    i = s.rindex("requestAnimationFrame(loop);")
    return s[:i] + """// fit the whole device into the screen height
function fitWindow(){const fw=document.querySelector('.flipwrap');fw.style.zoom=1;const tot=document.querySelector('.phone').scrollHeight,own=fw.getBoundingClientRect().height+44;
  // while the decorating sheet is open, shrink the device into the space above it so it stays a live preview
  const sheet=document.body.classList.contains('sheeted')?document.querySelector('.zoomin').getBoundingClientRect().height:0;
  const z=sheet?Math.max(.3,Math.min(1,(innerHeight-sheet-parseFloat(getComputedStyle(document.querySelector('.phone')).paddingTop)-8)/(own-44)))
    :Math.max(.55,Math.min(1,(innerHeight-(tot-own)-12)/own));fw.style.zoom=z}
addEventListener('resize',fitWindow);setTimeout(fitWindow,50);setTimeout(fitWindow,600);
""" + s[i:]


PLUGINS = (('core/dist/capacitor.js', 'capacitor.js'), ('local-notifications/dist/plugin.js', 'local-notifications.js'),
           ('share/dist/plugin.js', 'share.js'), ('haptics/dist/plugin.js', 'haptics.js'),
           ('splash-screen/dist/plugin.js', 'splash-screen.js'), ('synapse/dist/synapse.js', 'synapse.js'),
           ('filesystem/dist/plugin.js', 'filesystem.js'))


def native(s):
    """Native app: same as the phone beta, minus the web beta note (the app has real notifications)."""
    s = phone(s)
    s = re.sub(r'    <p class="betanote">.*?</p>\n', '', s, count=1)
    # no bundler: the Capacitor runtime and the plugins come in as plain scripts (copied next to the page, see PLUGINS);
    # the filesystem plugin expects a global `synapse`, which the synapse bundle names outsystemsSynapse
    tags = ''.join(f'<script src="{dst}"></script>\n' + ('<script>window.synapse=window.synapse||window.outsystemsSynapse</script>\n' if dst == 'synapse.js' else '')
                   for _, dst in PLUGINS)
    s = s.replace('</style>', '</style>\n' + tags.rstrip('\n'), 1)
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


def document(frag, pwa, fixed=None):
    """Wrap the artifact fragment into a full HTML document."""
    frag = frag.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    t = frag.index('<title>')
    te = frag.index('</style>') + len('</style>')
    # phone pages never zoom: a double tap on the buttons must not enlarge the screen
    fixed = pwa if fixed is None else fixed
    head = HEAD.format(extra=',maximum-scale=1,user-scalable=no' if fixed else '', pwa=PWA if pwa else '')
    tail = "\n<script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>" if pwa else ''
    return head + frag[t:te] + '\n</head><body>\n' + frag[te:] + tail + '\n</body></html>\n'


# shown by the app when it cannot reach GitHub Pages (capacitor.config.json server.errorPath)
OFFLINE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>망고펫</title>
<style>html,body{margin:0;height:100%;background:#f3eee6;font-family:-apple-system,sans-serif;color:#3a3326}
main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px;box-sizing:border-box}
b{font-size:17px}p{margin:0;font-size:14px;color:#7a705e}button{margin-top:8px;font:inherit;padding:10px 18px;border-radius:12px;border:0;background:#2c2e33;color:#fff}</style>
</head><body><main><b>인터넷에 연결되지 않았어요</b><p>테스트 버전은 켤 때 최신 게임을 받아와요.<br>연결된 뒤 다시 열어 주세요.</p>
<button onclick="location.href='https://aiden-mklee.github.io/mangopet/app.html'">다시 시도</button></main></body></html>
"""


def main():
    if '--no-font' not in sys.argv:
        subset_font()
    s = open(SRC, encoding='utf-8').read()
    assert s.count(SLOT) == 1, 'engine slot missing from src/prototype.html'
    s = s.replace(SLOT, '<script>\n' + open(ENGINE, encoding='utf-8').read() + '</script>')
    # the version shown in settings: beta number plus a short hash of the game, so a phone can tell it got the latest
    s = rep(s, "const VERSION='dev',", f"const VERSION='{BETA} · {hashlib.sha1(s.encode()).hexdigest()[:6]}',")
    os.makedirs(DOCS, exist_ok=True)
    os.makedirs(os.path.join(ROOT, '.out'), exist_ok=True)
    open(os.path.join(ROOT, '.out', 'artifact.html'), 'w', encoding='utf-8').write(s)
    index = document(phone(s), pwa=True)
    open(os.path.join(DOCS, 'index.html'), 'w', encoding='utf-8').write(index)
    open(os.path.join(DOCS, 'lab.html'), 'w', encoding='utf-8').write(document(lab(s), pwa=False))
    os.makedirs(os.path.join(ROOT, 'app', 'www'), exist_ok=True)
    open(os.path.join(ROOT, 'app', 'www', 'index.html'), 'w', encoding='utf-8').write(document(native(s), pwa=False, fixed=True))
    # the same app page is also served from GitHub Pages: while testing, the app loads it from there
    # (capacitor.config.json server.url), so a push updates the phone without rebuilding in Xcode
    open(os.path.join(DOCS, 'app.html'), 'w', encoding='utf-8').write(document(native(s), pwa=False, fixed=True))
    open(os.path.join(ROOT, 'app', 'www', 'offline.html'), 'w', encoding='utf-8').write(OFFLINE)
    nm = os.path.join(ROOT, 'node_modules', '@capacitor')
    for src, dst in PLUGINS:
        if os.path.exists(os.path.join(nm, src)):
            for out in (os.path.join(ROOT, 'app', 'www'), DOCS):
                shutil.copy(os.path.join(nm, src), os.path.join(out, dst))
        else:
            print('note: run npm install to copy', dst, 'into app/www and docs')
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
    # the privacy policy the stores link to: https://aiden-mklee.github.io/mangopet/privacy.html
    shutil.copy(os.path.join(ROOT, 'src', 'privacy.html'), os.path.join(DOCS, 'privacy.html'))
    open(os.path.join(DOCS, '.nojekyll'), 'w').close()
    print('built docs/ ·', ver)


if __name__ == '__main__':
    main()
