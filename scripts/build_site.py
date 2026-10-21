"""ประกอบหน้า dashboard จาก src/

  python scripts/build_site.py                 -> docs/index.html (GitHub Pages; อ่าน docs/data/*.json)
  python scripts/build_site.py --artifact F R B L  -> build/artifact_index.html (หน้าใน Claude Dashboard)
     F/R/B/L = URL ของฟอนต์ Regular, Bold และโลโก้ที่อัปโหลดไว้ใน artifact (/_blob/...)
"""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'


def fill(text, **kw):
    for k, v in kw.items():
        text = text.replace('{{' + k + '}}', v)
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--artifact', nargs=3, metavar=('FONT_REG', 'FONT_BOLD', 'LOGO'))
    a = ap.parse_args()
    css, body, js = ((SRC / n).read_text(encoding='utf-8') for n in ('style.css', 'body.html', 'app.js'))
    if a.artifact:
        reg, bold, logo = a.artifact
        out = ROOT / 'build' / 'artifact_index.html'
        out.parent.mkdir(exist_ok=True)
        page = '<style>\n' + css + '</style>\n\n' + body + '\n<script>\n' + js + '</script>\n'
        out.write_text(fill(page, FONT_REG=reg, FONT_BOLD=bold, LOGO=logo), encoding='utf-8')
    else:
        out = ROOT / 'docs' / 'index.html'
        css = fill(css, FONT_REG='assets/SaoChingcha-Regular.otf', FONT_BOLD='assets/SaoChingcha-Bold.otf')
        body = fill(body, LOGO='assets/erawan-logo.png')
        tpl = (SRC / 'standalone.html').read_text(encoding='utf-8')
        out.write_text(fill(tpl, CSS=css, BODY=body, JS=js), encoding='utf-8')
    print('wrote', out, f'{out.stat().st_size / 1024:,.0f} KB')


if __name__ == '__main__':
    main()
