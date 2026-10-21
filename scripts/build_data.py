"""สร้างข้อมูลสรุปสำหรับ dashboard 11 โซน ศูนย์เอราวัณ จากไฟล์ดิบ

ใช้:  python scripts/build_data.py <raw.xlsx|raw.csv|raw.zip> [--out docs/data]

ไฟล์ดิบ = "Data วิเคราะห์จุดจอด" (คอลัมน์ A–AD) ห้าม commit ไฟล์ดิบขึ้น repo
ผลลัพธ์ (ทั้งหมดเป็นตัวเลขรวม ไม่มีเลขปฏิบัติการ):
  cases.json      {zone, district, month, level, unit, n}
  traits.json     {zone, district, level, dim, key, n}
  units.json      {unit, group}
  screening.json  ขั้นตอนคัดเคส
  zones.json      รายชื่อเขต/แขวงในแต่ละโซน
"""
import argparse
import csv
import io
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
FY_START, FY_END = date(2025, 10, 1), date(2026, 9, 30)

COLS = {
    'id': 'เลขปฏิบัติการ', 'dt': 'วัน-เวลา รับแจ้งเหตุ', 'tambon': 'ตำบล', 'amphoe': 'อำเภอ',
    'level': 'จัดหน่วยบริการระดับ', 'unit': 'หน่วยที่ออกปฏิบัติการ', 'post': 'จุดจอดที่ออกปฏิบัติการ',
    'outcome': 'ผลการปฏิบัติงาน', 'code': 'รหัสอาการ(รหัส)', 'color': 'รหัสอาการ(สี)', 'grade': 'รหัสอาการ(ระดับ)',
    'age': 'อายุ', 'sex': 'เพศ', 'cpr': 'การทำ CPR', 'care': 'ผลการดูแลรักษาเบื้องต้น',
    'hosp': 'นำส่งห้องฉุกเฉินโรงพยาบาล',
}
LEVEL = {'BLS': 'Basic', 'ALS': 'Advance', 'ML': 'ML', 'CLS': 'CLS', 'FR': 'FR', 'ERB': 'ERB'}
CPR = {'Yes': 'CPR', 'Yes,AED/DF': 'CPR + AED/DF', 'AED/DF': 'AED/DF อย่างเดียว', 'No': 'ไม่ได้ทำ (No)'}
ERAWAN = 'ศูนย์เอราวัณ'


def clean(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)  # .xlsb เก็บตัวเลขเป็น float เช่น 21.0
    return '' if v is None or str(v).strip() in ('nan', 'NaT', 'None') else str(v).strip()


def blank(v):
    return clean(v) in ('', '0')


def load_zones(path):
    """เขต -> โซน; เขตที่แบ่งตามแขวงคืน dict แขวง -> โซน"""
    by_district, zones = {}, defaultdict(list)
    with open(path, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            d = r['เขต'].strip().removeprefix('เขต')
            z, sub = r['โซนเอราวัณ'].strip(), r['แขวงย่อยในโซน'].strip()
            if '/' not in z:
                by_district[d] = int(z)
                zones[int(z)].append({'district': d, 'tambons': None})
                continue
            split = {}
            for zz, names in re.findall(r'(\d+)\s*\(([^)]*)\)', sub):
                ts = [t.strip().removeprefix('แขวง') for t in names.split(',') if t.strip()]
                for t in ts:
                    split[t] = int(zz)
                zones[int(zz)].append({'district': d, 'tambons': ts})
            by_district[d] = split
    return by_district, zones


def read_raw(path):
    p = Path(path)
    if p.suffix.lower() == '.zip':
        with zipfile.ZipFile(p) as z:
            name = next(n for n in z.namelist() if n.lower().endswith(('.csv', '.xlsx')))
            data = z.read(name)
        if name.lower().endswith('.csv'):
            return pd.read_csv(io.BytesIO(data), dtype=str, keep_default_na=False, encoding='utf-8-sig')
        return pd.read_excel(io.BytesIO(data), dtype=str, keep_default_na=False)
    if p.suffix.lower() == '.csv':
        return pd.read_csv(p, dtype=str, keep_default_na=False, encoding='utf-8-sig')
    if p.suffix.lower() == '.xlsb':
        return pd.read_excel(p, engine='pyxlsb', dtype=object)
    return pd.read_excel(p, dtype=str, keep_default_na=False)


def parse_dt(v):
    if isinstance(v, (int, float)) and v == v and v > 1:
        return datetime(1899, 12, 30) + timedelta(seconds=round(float(v) * 86400))  # วันที่แบบ serial ของ Excel (.xlsb)
    v = clean(v)
    for f in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M'):
        try:
            return datetime.strptime(v, f)
        except ValueError:
            pass
    try:
        return pd.to_datetime(v).to_pydatetime()
    except (ValueError, TypeError):
        return None


def age_group(v):
    try:
        a = float(clean(v))
    except ValueError:
        return 'ไม่ระบุ'
    if a <= 0 or a > 120:
        return 'ไม่ระบุ'
    return 'เด็ก' if a < 15 else 'ผู้ใหญ่' if a < 60 else 'ผู้สูงอายุ'


def unit_of(r):
    u = clean(r['unit']) or 'ไม่ระบุหน่วย'
    if ERAWAN in u and not blank(r['post']):
        u += ' · ' + clean(r['post'])
    return u


def group_of(u):
    if ERAWAN in u:
        return 'ศูนย์เอราวัณ'
    if 'โรงพยาบาล' in u or 'คณะแพทย' in u or 'วชิรพยาบาล' in u:
        return 'โรงพยาบาล'
    return 'มูลนิธิ / กู้ชีพ'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('raw')
    ap.add_argument('--out', default=str(ROOT / 'docs' / 'data'))
    ap.add_argument('--zones', default=str(ROOT / 'config' / 'zones.csv'))
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    by_district, zone_list = load_zones(a.zones)
    df = read_raw(a.raw)
    df.columns = [str(c).strip().removeprefix('Data ').strip() for c in df.columns]
    missing = [v for v in COLS.values() if v not in df.columns]
    if missing:
        sys.exit('ไม่พบคอลัมน์: ' + ', '.join(missing))
    raw_cols = list(df.columns)
    df = df.rename(columns={v: k for k, v in COLS.items()})
    steps = [{'step': 'แถวดิบทั้งไฟล์', 'n': len(df), 'kind': 'start'}]

    # โซนจากเขตที่เกิดเหตุ (คอลัมน์ อำเภอ); เขตที่แบ่งสองโซนใช้คอลัมน์ ตำบล
    def zone_of(r):
        m = by_district.get(clean(r['amphoe']).removeprefix('เขต'))
        if isinstance(m, dict):
            return m.get(clean(r['tambon']).removeprefix('แขวง'))
        return m
    df['zone'] = df.apply(zone_of, axis=1)
    nozone = df[df['zone'].isna()]
    unmatched = Counter((clean(r['amphoe']), clean(r['tambon'])) for _, r in nozone.iterrows())
    split_unmatched = {f'{d} / {t}': n for (d, t), n in unmatched.items() if isinstance(by_district.get(d.removeprefix('เขต')), dict)}
    df = df[df['zone'].notna()].copy()
    df['zone'] = df['zone'].astype(int)
    noloc = int(nozone['amphoe'].map(blank).sum())
    steps.append({'step': 'ตัดแถวที่ไม่มีข้อมูลพื้นที่ (เขต/แขวง/จังหวัด เป็น 0 หรือว่าง)', 'n': noloc, 'kind': 'drop'})
    steps.append({'step': 'ตัดเหตุนอก 50 เขต กทม. (หรือแขวงที่ไม่อยู่ในตารางแบ่งโซน)', 'n': len(nozone) - noloc, 'kind': 'drop'})

    df['dtp'] = df['dt'].map(parse_dt)
    inrange = df['dtp'].map(lambda x: x is not None and FY_START <= x.date() <= FY_END)
    steps.append({'step': 'ตัดวันที่นอกปีงบ 2569 หรืออ่านวันที่ไม่ได้', 'n': int((~inrange).sum()), 'kind': 'drop'})
    df = df[inrange].copy()

    before = len(df)
    df = df.drop_duplicates(subset=[c for c in df.columns if c != 'dtp'])
    steps.append({'step': 'ตัดแถวซ้ำกันทุกคอลัมน์', 'n': before - len(df), 'kind': 'drop'})

    before = len(df)
    data_cols = [c for c in df.columns if c not in ('dtp', 'zone')]
    df['filled'] = df[data_cols].apply(lambda r: sum(not blank(v) for v in r), axis=1)
    df = df.sort_values(['id', 'filled'], ascending=[True, False], kind='stable').drop_duplicates('id')
    steps.append({'step': 'รวมแถวที่เลขปฏิบัติการซ้ำ (1 เลข = 1 เคส เก็บแถวที่กรอกครบที่สุด)', 'n': before - len(df), 'kind': 'drop'})
    steps.append({'step': 'เคสที่ใช้วิเคราะห์', 'n': len(df), 'kind': 'final'})

    cases, traits, units = Counter(), Counter(), {}
    UMET = ('n', 'found', 'transported', 'old', 'cpr', 'dead', 'red')
    HMET = ('n', 'old', 'cpr', 'red', 'erawan')
    ustats = defaultdict(lambda: dict.fromkeys(UMET, 0))
    hstats = defaultdict(lambda: dict.fromkeys(HMET, 0))
    oddity = Counter()
    for r in df.to_dict('records'):
        z, d = r['zone'], clean(r['amphoe']).removeprefix('เขต')
        lv = LEVEL.get(clean(r['level']).upper(), 'ไม่ระบุ')
        if lv == 'ไม่ระบุ' and not blank(r['level']):
            oddity['ระดับหน่วยที่ไม่รู้จัก: ' + clean(r['level'])] += 1
        u = unit_of(r)
        units[u] = group_of(u)
        t = r['dtp']
        cases[(z, d, t.strftime('%Y-%m'), lv, u)] += 1
        combo = 'ไม่ระบุ' if any(blank(r[k]) for k in ('code', 'color', 'grade')) else f"{clean(r['code'])}{clean(r['color'])}{clean(r['grade'])}"
        sex = clean(r['sex']) if clean(r['sex']) in ('ชาย', 'หญิง') else 'ไม่ระบุ'
        cpr = CPR.get(clean(r['cpr']), 'ไม่มีบันทึก' if blank(r['cpr']) else clean(r['cpr']))
        dims = {
            'combo': combo,
            'tambon': clean(r['tambon']).removeprefix('แขวง') or 'ไม่ระบุ',
            'hour': str(t.hour),
            'dow': str(t.weekday()),
            'outcome': 'ไม่มีบันทึกผล' if blank(r['outcome']) else clean(r['outcome']),
            'age': age_group(r['age']),
            'sex': sex,
            'cpr': cpr,
            'care': 'ไม่มีบันทึก' if blank(r['care']) else clean(r['care']),
            'hosp': 'ไม่ได้นำส่ง / ไม่มีบันทึก' if blank(r['hosp']) else clean(r['hosp']),
        }
        try:
            if float(clean(r['age']) or 0) > 120:
                oddity['อายุเกิน 120 ปี (นับเป็นไม่ระบุ)'] += 1
        except ValueError:
            oddity['อายุไม่ใช่ตัวเลข (นับเป็นไม่ระบุ)'] += 1
        for k, v in dims.items():
            traits[(z, d, lv, k, v)] += 1
        # ตัวชี้วัดสำหรับ benchmark รายหน่วย / รายโรงพยาบาล
        flags = {'n': 1, 'found': dims['outcome'] == 'พบเหตุ', 'transported': dims['hosp'] != 'ไม่ได้นำส่ง / ไม่มีบันทึก',
                 'old': dims['age'] == 'ผู้สูงอายุ', 'cpr': cpr in ('CPR', 'CPR + AED/DF', 'AED/DF อย่างเดียว'),
                 'dead': dims['care'] == 'เสียชีวิต ณ จุดเกิดเหตุ', 'red': clean(r['color']) == 'แดง', 'erawan': ERAWAN in u}
        us = ustats[(z, d, lv, u)]
        for k in UMET:
            us[k] += int(flags[k])
        if flags['transported']:
            hs = hstats[(z, d, lv, dims['hosp'])]
            for k in HMET:
                hs[k] += int(flags[k])

    def dump(name, obj):
        (out / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    dump('cases.json', [{'zone': z, 'district': d, 'month': m, 'level': lv, 'unit': u, 'n': n}
                        for (z, d, m, lv, u), n in sorted(cases.items())])
    dump('traits.json', [{'zone': z, 'district': d, 'level': lv, 'dim': k, 'key': v, 'n': n}
                         for (z, d, lv, k, v), n in sorted(traits.items())])
    dump('unitstats.json', [dict(zone=z, district=d, level=lv, unit=u, **m) for (z, d, lv, u), m in sorted(ustats.items())])
    dump('hospstats.json', [dict(zone=z, district=d, level=lv, hosp=h, **m) for (z, d, lv, h), m in sorted(hstats.items())])
    with open(ROOT / 'config' / 'symptom_codes.csv', encoding='utf-8-sig') as f:
        dump('codes.json', [{'code': r['code'], 'name': r['name']} for r in csv.DictReader(f)])
    dump('units.json', [{'unit': u, 'group': g} for u, g in sorted(units.items())])
    dump('screening.json', steps)
    dump('zones.json', [{'zone': z, 'district': e['district'], 'tambons': '' if e['tambons'] is None else ', '.join(e['tambons'])}
                        for z in sorted(zone_list) for e in zone_list[z]])

    print('columns:', len(raw_cols))
    for s in steps:
        print(f"  {s['step']}: {s['n']:,}")
    zc = Counter()
    for (z, *_), n in cases.items():
        zc[z] += n
    print('ต่อโซน:', ', '.join(f'Z{z} {n:,}' for z, n in sorted(zc.items())))
    if split_unmatched:
        print('แขวงในเขตที่แบ่งโซนแต่ไม่อยู่ในตาราง:', split_unmatched)
    print('เขตที่ไม่อยู่ในตาราง (10 อันดับ):', Counter({d: n for (d, _), n in unmatched.items()}).most_common(10))
    for k, n in oddity.most_common():
        print(f'  ! {k}: {n:,}')
    for f in sorted(out.glob('*.json')):
        print(f'  {f.name}: {f.stat().st_size / 1024:,.0f} KB')


if __name__ == '__main__':
    main()
