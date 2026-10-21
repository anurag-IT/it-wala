"""
Asset audit for the IT Wala Dai static site.

Finds every local file referenced by the live pages (including hidden <template> sections, inline JSON,
srcset, data-* attributes and inline styles), follows CSS url()/@import references, and reports what is
unused. Policy (conservative):
  * plugins/themes/wp-includes are shared libraries: a plugin folder is kept whole if any file in it is used
  * uploads are checked file by file
  * folders referenced by scripts/ (build/patch helpers) are kept

Run:  python scripts/audit_assets.py            (report only)
      python scripts/audit_assets.py --json     (machine-readable list for the cleanup step)
"""
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
LIVE_PAGES = ['index.html', 'programs/index.html', 'plus-two/index.html', 'plus-two/c-programming/index.html',
              'plus-two/cpp-programming/index.html', 'free-it-consultation/index.html', 'community/index.html',
              'testimonials/index.html', 'about/index.html', 'contact/index.html']
# files the helper scripts read (build_site.py / patch_site.py / v2_content.py)
SCRIPT_SOURCES = ['_original/index.html', 'home-i-university/index.html', 'home-ii-online-education/index.html',
                  'about-us/index.html', 'contact-us/index.html']
KEEP_TOP = {'.git', '.claude', '.vscode', 'node_modules', 'scripts', 'assets', 'mentor', 'college', 'app section',
            'package.json', 'package-lock.json', 'vite.config.js', 'README.md', '.gitignore', 'index.html',
            'programs', 'plus-two', 'free-it-consultation', 'community', 'testimonials', 'about', 'contact',
            'wp-content', 'wp-includes', '_original', 'home-i-university', 'home-ii-online-education', 'about-us',
            'contact-us', '404.html'}

REF_RE = re.compile(r"""(?:src|href|srcset|data-[a-z-]*src|data-displacement|data-mask-src|data-bg-src|content|poster)\s*=\s*["']([^"']+)["']""", re.I)
URL_RE = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", re.I)
PATH_RE = re.compile(r"""(?:\\?/|\b)((?:wp-content|wp-includes|wp-json|assets|mentor|college|app section|app%20section)(?:\\?/[^"'\s)<>,;]+)+)""")
IMPORT_RE = re.compile(r"""@import\s+(?:url\()?['"]?([^'")]+)""", re.I)


def norm(base_dir, ref):
    ref = ref.strip().replace('\\/', '/')
    if not ref or ref.startswith(('#', 'data:', 'mailto:', 'tel:', 'javascript:', 'about:')):
        return None
    if re.match(r'^[a-z]+://', ref, re.I) or ref.startswith('//'):
        return None
    path = unquote(urlsplit(ref).path)
    if not path:
        return None
    p = (ROOT / path.lstrip('/')) if path.startswith('/') else (base_dir / path)
    try:
        p = p.resolve()
        p.relative_to(ROOT)
    except Exception:
        return None
    return p


def refs_in_html(page):
    text = page.read_text(encoding='utf-8', errors='replace')
    out = set()
    for m in REF_RE.finditer(text):
        for part in m.group(1).split(','):          # srcset: "a.jpg 1x, b.jpg 2x"
            r = norm(page.parent, part.strip().split(' ')[0])
            if r:
                out.add(r)
    for m in URL_RE.finditer(text):
        r = norm(page.parent, m.group(1))
        if r:
            out.add(r)
    for m in PATH_RE.finditer(text):                  # inline JSON / scripts: wp-content\/uploads\/...
        r = norm(ROOT, '/' + m.group(1).replace('\\/', '/'))
        if r:
            out.add(r)
    return out


def refs_in_css(css, seen):
    out = set()
    if css in seen or not css.is_file():
        return out
    seen.add(css)
    text = css.read_text(encoding='utf-8', errors='replace')
    for rx in (URL_RE, IMPORT_RE):
        for m in rx.finditer(text):
            r = norm(css.parent, m.group(1))
            if r:
                out.add(r)
                if r.suffix == '.css':
                    out |= refs_in_css(r, seen)
    return out


def main():
    used = set()
    live_refs = set()
    for rel in LIVE_PAGES:
        live_refs |= refs_in_html(ROOT / rel)
        used.add((ROOT / rel).resolve())
    used |= live_refs
    # helper-script sources: the files themselves + the wp-content assets they mention (not their page links)
    wp = str(ROOT / 'wp-content')
    for rel in SCRIPT_SOURCES:
        used.add((ROOT / rel).resolve())
        used |= {r for r in refs_in_html(ROOT / rel) if str(r).startswith(wp)}
    seen = set()
    for r in list(used):
        if r.suffix == '.css':
            used |= refs_in_css(r, seen)
    used_existing = {u for u in used if u.exists()}
    missing = sorted(u.relative_to(ROOT).as_posix() for u in live_refs
                     if not u.exists() and u.suffix and '..' not in u.name)

    report = {'delete_files': [], 'delete_dirs': [], 'kept_plugins': [], 'missing_refs': missing}

    # 1) top-level entries not used by the site or the helper scripts
    for entry in sorted(ROOT.iterdir()):
        name = entry.name
        if name in KEEP_TOP:
            continue
        if any(str(u).startswith(str(entry.resolve())) for u in used_existing):
            continue
        (report['delete_dirs'] if entry.is_dir() else report['delete_files']).append(name)

    # 2) uploads: file by file
    uploads = ROOT / 'wp-content' / 'uploads'
    for f in uploads.rglob('*'):
        if f.is_file() and f.resolve() not in used_existing:
            report['delete_files'].append(str(f.relative_to(ROOT)).replace('\\', '/'))

    # 3) plugins: whole folder unless something in it is used
    plugins = ROOT / 'wp-content' / 'plugins'
    for plug in sorted(plugins.iterdir()):
        if any(str(u).startswith(str(plug.resolve()) + os.sep) for u in used_existing):
            report['kept_plugins'].append(plug.name)
        else:
            report['delete_dirs'].append(str(plug.relative_to(ROOT)).replace('\\', '/'))

    # 4) extra files inside kept source-template folders that nothing reads
    for d in ('home-i-university', 'home-ii-online-education', '_original'):
        for f in (ROOT / d).rglob('*'):
            if f.is_file() and f.resolve() not in used_existing:
                report['delete_files'].append(str(f.relative_to(ROOT)).replace('\\', '/'))

    if '--json' in sys.argv:
        print(json.dumps(report, indent=1))
        return
    print('missing references:', len(missing))
    for m in missing[:40]:
        print('   ', m)
    print('top-level delete candidates:', [d for d in report['delete_dirs'] if '/' not in d] +
          [f for f in report['delete_files'] if '/' not in f])
    print('upload files to delete:', sum(1 for f in report['delete_files'] if f.startswith('wp-content/uploads')))
    print('plugins kept:', report['kept_plugins'])
    print('plugins to delete:', [d for d in report['delete_dirs'] if d.startswith('wp-content/plugins')])
    print('other files:', [f for f in report['delete_files'] if not f.startswith('wp-content/uploads') and '/' in f])


if __name__ == '__main__':
    main()
