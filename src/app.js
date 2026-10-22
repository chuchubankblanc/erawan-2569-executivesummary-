(function () {
  const G4 = ['Basic', 'Advance', 'อื่นๆ', 'ไม่ระบุ'];
  const G4OF = { Basic: 'Basic', Advance: 'Advance', ML: 'อื่นๆ', CLS: 'อื่นๆ', FR: 'อื่นๆ', ERB: 'อื่นๆ', 'ไม่ระบุ': 'ไม่ระบุ' };
  const G4LONG = { Basic: 'Basic (BLS)', Advance: 'Advance (ALS)', 'อื่นๆ': 'อื่นๆ (ML · CLS · FR · ERB)', 'ไม่ระบุ': 'ไม่ระบุระดับ' };
  const ZONES = d3.range(1, 12);
  const GROUPS = ['ศูนย์เอราวัณ', 'โรงพยาบาล', 'มูลนิธิ / กู้ชีพ'];
  const DIMS = ['combo', 'tambon', 'hour', 'dow', 'outcome', 'age', 'sex', 'cpr', 'care', 'hosp', 'cprout'];
  const AGES = ['เด็ก', 'ผู้ใหญ่', 'ผู้สูงอายุ', 'ไม่ระบุ'];
  const AGEDEF = { 'เด็ก': 'เด็ก 0–14 ปี', 'ผู้ใหญ่': 'ผู้ใหญ่ 15–59 ปี', 'ผู้สูงอายุ': 'ผู้สูงอายุ ≥60 ปี', 'ไม่ระบุ': 'ไม่ระบุอายุ' };
  const SEXES = ['ชาย', 'หญิง', 'ไม่ระบุ'];
  const CPRS = ['CPR', 'CPR + AED/DF', 'AED/DF อย่างเดียว', 'ไม่ได้ทำ (No)'];
  const DEAD = 'เสียชีวิต ณ จุดเกิดเหตุ';
  const NOHOSP = 'ไม่ได้นำส่ง / ไม่มีบันทึก';
  const DOW = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const fmt = d3.format(',');
  const pct = d3.format('.1%');
  const $ = (id) => document.getElementById(id);
  const wrap = $('zx');
  const tipEl = $('zx-tip');
  let zone = 'all';
  let org = 'all';  // 'all' = ทุกหน่วย, 'erawan' = เฉพาะรถศูนย์เอราวัณ
  let sel = 'all';
  let lf = 'all';
  let sort = { k: 'total', dir: -1 };
  let hsort = { k: 'total', dir: -1 };
  let query = '';
  let hquery = '';
  let cases = [];
  let traits = [];
  let groupOf = new Map();
  let zoneDists = new Map();
  let nMonths = 11;
  let codeName = new Map();
  const cname = (k) => { const m = /^(\d+)/.exec(k); return m ? codeName.get(m[1]) || '' : ''; };
  const clabel = (k) => (cname(k) ? k + ' ' + cname(k) : k);
  let ustats = [];
  let unitmap = [];
  let colormap = [];
  let geo = [];
  let mapUnit = null;
  let mapColor = 'all';
  let mapMetric = 'n';
  const mapPick = { u: null, c: null };
  const maps = {};
  let hstats = [];
  const picks = { unit: [], hosp: [] };
  const LV7 = ['Basic', 'Advance', 'ML', 'CLS', 'FR', 'ERB', 'ไม่ระบุ'];
  const LV7NAME = { Basic: 'BLS (Basic)', Advance: 'ALS (Advance)', ML: 'ML', CLS: 'CLS', FR: 'FR', ERB: 'ERB', 'ไม่ระบุ': 'ไม่ระบุระดับ' };
  const LV7C = { Basic: 'var(--lv-basic)', Advance: 'var(--lv-adv)', ML: 'var(--lv-ml)', CLS: 'var(--lv-cls)', FR: 'var(--lv-fr)', ERB: 'var(--lv-erb)', 'ไม่ระบุ': 'var(--lv-unk)' };

  const C = () => ({ Basic: 'var(--lv-basic)', Advance: 'var(--lv-adv)', 'อื่นๆ': 'var(--lv-oth)', 'ไม่ระบุ': 'var(--lv-unk)' });

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function monthLabel(m) {
    const p = m.split('-');
    return TH[+p[1] - 1] + ' ' + String((+p[0] + 543) % 100);
  }
  const short = (s) => s.replace(/^ศูนย์บริการการแพทย์ฉุกเฉินกรุงเทพมหานคร \(ศูนย์เอราวัณ\)/, 'เอราวัณ');
  const zlabel = (z) => (z === 'all' ? 'ทั้ง กทม. (11 โซน)' : 'Zone ' + z);
  const dlabel = (z, d) => (d === 'all' ? zlabel(z) : 'Zone ' + z + ' · เขต' + d) + (org === 'erawan' ? ' · เฉพาะรถศูนย์เอราวัณ' : '');
  const hh = (h) => String(h).padStart(2, '0') + ':00–' + String(h).padStart(2, '0') + ':59';
  const share = (n, d) => (d ? pct(n / d) : '—');

  /* tooltip */
  function showTip(ev, title, lines) {
    tipEl.replaceChildren(el('div', 'zt-h', title));
    lines.forEach((l) => {
      const r = el('div', 'zt-r');
      if (l[0]) { const s = el('span', 'zt-s'); s.style.background = l[0]; r.appendChild(s); }
      r.appendChild(el('span', null, l[1]));
      tipEl.appendChild(r);
    });
    tipEl.hidden = false;
    moveTip(ev);
  }
  function moveTip(ev) {
    const w = wrap.getBoundingClientRect();
    let x = ev.clientX - w.left + 14;
    const y = ev.clientY - w.top + 14;
    const tw = tipEl.offsetWidth;
    if (x + tw > w.width - 4) x = ev.clientX - w.left - tw - 14;
    tipEl.style.left = Math.max(4, x) + 'px';
    tipEl.style.top = y + 'px';
  }
  function hideTip() { tipEl.hidden = true; }
  function hover(node, title, lines) {
    node.addEventListener('mouseenter', (e) => showTip(e, title, lines));
    node.addEventListener('mousemove', moveTip);
    node.addEventListener('mouseleave', hideTip);
  }

  /* data */
  const isErawan = (r) => (r.org ? r.org === 'erawan' : (groupOf.get(r.unit) || '') === 'ศูนย์เอราวัณ');
  const orgOk = (r) => org === 'all' || isErawan(r);
  const inScope = (r, z, d) => orgOk(r) && (z === 'all' || +r.zone === z) && (d === 'all' || r.district === d);
  function cohort(z, d, g) {
    const c = { total: 0, lv: {}, unit: new Map(), month: new Map(), grp: {}, tr: {}, hosp: new Map() };
    DIMS.forEach((k) => { c.tr[k] = new Map(); });
    cases.forEach((r) => {
      if (!inScope(r, z, d)) return;
      const g4 = G4OF[r.level];
      if (g !== 'all' && g4 !== g) return;
      const n = +r.n;
      c.total += n;
      c.lv[r.level] = (c.lv[r.level] || 0) + n;
      const grp = groupOf.get(r.unit) || 'มูลนิธิ / กู้ชีพ';
      let u = c.unit.get(r.unit);
      if (!u) { u = { unit: r.unit, group: grp, lv: {}, total: 0 }; c.unit.set(r.unit, u); }
      u.lv[r.level] = (u.lv[r.level] || 0) + n;
      u.total += n;
      let m = c.month.get(r.month);
      if (!m) { m = { Basic: 0, Advance: 0, 'อื่นๆ': 0, 'ไม่ระบุ': 0, total: 0 }; c.month.set(r.month, m); }
      m[g4] += n;
      m.total += n;
      let gp = c.grp[grp];
      if (!gp) { gp = { lv: {}, total: 0 }; c.grp[grp] = gp; }
      gp.lv[r.level] = (gp.lv[r.level] || 0) + n;
      gp.total += n;
    });
    traits.forEach((r) => {
      if (!inScope(r, z, d)) return;
      const g4 = G4OF[r.level];
      if (g !== 'all' && g4 !== g) return;
      const n = +r.n;
      c.tr[r.dim].set(r.key, (c.tr[r.dim].get(r.key) || 0) + n);
      if (r.dim === 'hosp') {
        let h = c.hosp.get(r.key);
        if (!h) { h = { Basic: 0, Advance: 0, 'อื่นๆ': 0, 'ไม่ระบุ': 0, total: 0 }; c.hosp.set(r.key, h); }
        h[g4] += n;
        h.total += n;
      }
    });
    return c;
  }
  function g4of(lv) {
    return { Basic: lv.Basic || 0, Advance: lv.Advance || 0, 'อื่นๆ': (lv.ML || 0) + (lv.CLS || 0) + (lv.FR || 0) + (lv.ERB || 0), 'ไม่ระบุ': lv['ไม่ระบุ'] || 0 };
  }
  const trv = (c1, dim, key) => c1.tr[dim].get(key) || 0;
  const cprAny = (c1) => d3.sum([...c1.tr.cpr.entries()], (e) => (/CPR|AED/.test(e[0]) ? e[1] : 0));
  const transported = (c1) => c1.total - trv(c1, 'hosp', NOHOSP);
  function partsOf(cnt) {
    const c = C();
    return G4.map((k) => ({ k, v: cnt[k] || 0, c: c[k] }));
  }
  function top(map, n) {
    return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'th')).slice(0, n);
  }
  function legend(box, entries) {
    box.replaceChildren();
    entries.forEach((p) => {
      const s = el('span');
      const sw = el('i', 'zx-sw'); sw.style.background = p[1];
      s.appendChild(sw); s.appendChild(el('span', null, p[0]));
      box.appendChild(s);
    });
  }
  const legG4 = (box) => legend(box, G4.map((k) => [k === 'อื่นๆ' ? 'อื่นๆ (ML · CLS · FR · ERB)' : k, C()[k]]));

  function stackRow(name, parts, total, max) {
    const row = el('div', 'zx-row');
    row.appendChild(el('span', 'nm', name));
    const track = el('div', 'zx-track');
    parts.forEach((p) => {
      if (!p.v) return;
      const s = el('span');
      s.style.width = (p.v / max * 100) + '%';
      s.style.background = p.c;
      track.appendChild(s);
    });
    row.appendChild(track);
    row.appendChild(el('span', 'tt', fmt(total)));
    hover(row, name, parts.map((p) => [p.c, p.k + ': ' + fmt(p.v) + ' (' + share(p.v, total) + ')']).concat([[null, 'รวม: ' + fmt(total)]]));
    return row;
  }
  function valRows(box, items, base, color) {
    box.replaceChildren();
    const max = d3.max(items, (i) => i.v) || 1;
    items.forEach((i) => {
      const row = el('div', 'zx-row v' + (i.hot ? ' hot' : ''));
      row.appendChild(el('span', 'nm', i.label));
      const t = el('div', 'zx-track line');
      const s = el('span'); s.style.width = (i.v / max * 100) + '%'; s.style.background = i.color || color || 'var(--bar)';
      t.appendChild(s);
      row.appendChild(t);
      row.appendChild(el('span', 'tt', fmt(i.v) + ' · ' + share(i.v, base)));
      hover(row, i.tip || i.label, [[null, fmt(i.v) + ' เคส (' + share(i.v, base) + ')']]);
      box.appendChild(row);
    });
  }

  /* sidebar */
  function mkItem(box, label, n, pressed, fn, opts) {
    const o = opts || {};
    const b = el('button', 'zx-item' + (o.cls ? ' ' + o.cls : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pressed));
    const s = el('span');
    if (o.sw) { const i = el('i', 'sw'); i.style.background = o.sw; s.appendChild(i); }
    s.appendChild(document.createTextNode(label));
    if (o.part) s.appendChild(el('small', 'part', o.part));
    b.appendChild(s);
    b.appendChild(el('b', null, fmt(n)));
    if (o.title) b.title = o.title;
    b.addEventListener('click', fn);
    box.appendChild(b);
  }
  function renderSide() {
    const zc = {}, dc = {};
    let all = 0;
    let erw = 0, every = 0;
    cases.forEach((r) => {
      if (lf !== 'all' && G4OF[r.level] !== lf) return;
      const n = +r.n;
      every += n;
      if (isErawan(r)) erw += n;
      if (!orgOk(r)) return;
      all += n;
      zc[r.zone] = (zc[r.zone] || 0) + n;
      if (zone !== 'all' && +r.zone === zone) dc[r.district] = (dc[r.district] || 0) + n;
    });
    const ob = $('zx-org');
    ob.replaceChildren();
    mkItem(ob, 'ทุกหน่วย', every, org === 'all', () => setOrg('all'));
    mkItem(ob, 'เฉพาะรถศูนย์เอราวัณ', erw, org === 'erawan', () => setOrg(org === 'erawan' ? 'all' : 'erawan'), { sw: 'var(--gold)' });
    const zb = $('zx-zones');
    zb.replaceChildren();
    mkItem(zb, 'ทั้ง กทม.', all, zone === 'all', () => setZone('all'), { cls: 'zx-all' });
    ZONES.forEach((z) => mkItem(zb, 'Zone ' + z, zc[z] || 0, zone === z, () => setZone(zone === z ? 'all' : z)));

    const dw = $('zx-dist-wrap');
    dw.hidden = zone === 'all';
    const db = $('zx-dists');
    db.replaceChildren();
    if (zone !== 'all') {
      $('zx-dist-lab').textContent = 'เขตใน Zone ' + zone;
      mkItem(db, 'ทั้ง Zone ' + zone, d3.sum(Object.values(dc)), sel === 'all', () => setSel('all'));
      (zoneDists.get(zone) || []).forEach((e) => mkItem(db, e.district, dc[e.district] || 0, sel === e.district,
        () => setSel(sel === e.district ? 'all' : e.district),
        e.tambons ? { part: 'บางแขวง', title: 'เฉพาะแขวง ' + e.tambons } : null));
    }

    const lbox = $('zx-lvls');
    lbox.replaceChildren();
    const cd = cohort(zone, sel, 'all');
    const cnt = g4of(cd.lv);
    mkItem(lbox, 'ทุกระดับ', cd.total, lf === 'all', () => setLf('all'));
    G4.forEach((g) => mkItem(lbox, G4LONG[g], cnt[g], lf === g, () => setLf(lf === g ? 'all' : g), { sw: C()[g] }));

    const ms = [...new Set(cases.map((r) => r.month))].sort();
    const foot = $('zx-foot');
    foot.replaceChildren();
    const l1 = el('div'); l1.appendChild(document.createTextNode('ช่วงข้อมูล ')); l1.appendChild(el('b', null, monthLabel(ms[0]) + ' – ' + monthLabel(ms[ms.length - 1])));
    foot.appendChild(l1);
    foot.appendChild(el('div', null, 'แหล่งข้อมูล: ไฟล์ Data การออกเหตุ ศูนย์เอราวัณ ปีงบประมาณ 2569 (ฉบับเพิ่มอายุ เพศ CPR)'));
    const last = ms[ms.length - 1];
    if (last < '2026-09') foot.appendChild(el('div', null, 'ยังไม่มีข้อมูลถึง ก.ย. 69'));
    $('zx-range').textContent = 'ข้อมูลที่ใช้: ' + monthLabel(ms[0]) + ' – ' + monthLabel(last) + (last < '2026-09' ? ' (ยังไม่ครบปีงบประมาณ)' : '') + ' · ' + dlabel(zone, sel);
  }

  /* summary */
  function renderSummary() {
    const base = cohort(zone, sel, 'all');
    const cur = lf === 'all' ? base : cohort(zone, sel, lf);
    const cnt = g4of(base.lv);
    const ol = $('zx-sum');
    ol.replaceChildren();
    const li = (label, parts, focus) => {
      const x = el('li');
      x.appendChild(el('span', 'k', label));
      const v = el('span', 'v');
      parts.forEach((p) => { if (typeof p === 'string') v.appendChild(document.createTextNode(p)); else v.appendChild(el('b', null, p.b)); });
      if (focus) v.appendChild(el('span', 'focus', focus));
      x.appendChild(v);
      ol.appendChild(x);
    };
    const oth = base.lv;
    li('ภาพรวม', [dlabel(zone, sel) + ' มี ', { b: fmt(base.total) }, ' เคส: Basic ', { b: fmt(cnt.Basic) }, ' (' + share(cnt.Basic, base.total) + ') · Advance ', { b: fmt(cnt.Advance) }, ' (' + share(cnt.Advance, base.total) + ') · อื่นๆ ', { b: fmt(cnt['อื่นๆ']) }, ' (ML ' + fmt(oth.ML || 0) + ', CLS ' + fmt(oth.CLS || 0) + ', FR ' + fmt(oth.FR || 0) + ', ERB ' + fmt(oth.ERB || 0) + ') · ไม่ระบุระดับ ', { b: fmt(cnt['ไม่ระบุ']) }],
      cnt.Advance ? 'เคส Basic มากกว่า Advance ประมาณ ' + d3.format('.1f')(cnt.Basic / cnt.Advance) + ' เท่า' : null);

    const dead = trv(cur, 'care', DEAD);
    const th = top(new Map([...cur.hosp.entries()].filter((e) => e[0] !== NOHOSP).map((e) => [e[0], e[1].total])), 1)[0];
    const tp = transported(cur);
    li('ผู้ป่วย', [(lf === 'all' ? '' : 'เฉพาะ ' + lf + ': ') + 'ผู้สูงอายุ (≥60 ปี) ', { b: share(trv(cur, 'age', 'ผู้สูงอายุ'), cur.total) }, ' · ผู้ใหญ่ (15–59) ', { b: share(trv(cur, 'age', 'ผู้ใหญ่'), cur.total) }, ' · เด็ก (0–14) ', { b: share(trv(cur, 'age', 'เด็ก'), cur.total) }, ' · ชาย ', { b: share(trv(cur, 'sex', 'ชาย'), cur.total) }, ' หญิง ', { b: share(trv(cur, 'sex', 'หญิง'), cur.total) }],
      'ไม่ระบุอายุ ' + share(trv(cur, 'age', 'ไม่ระบุ'), cur.total) + ' · ไม่ระบุเพศ ' + share(trv(cur, 'sex', 'ไม่ระบุ'), cur.total) + ' ของเคส');
    li('CPR และผลลัพธ์', ['ทำ CPR/AED ', { b: fmt(cprAny(cur)) }, ' เคส · เสียชีวิต ณ จุดเกิดเหตุ ', { b: fmt(dead) }, ' เคส (' + share(dead, cur.total) + ') · นำส่งห้องฉุกเฉิน ', { b: fmt(tp) }, ' เคส (' + share(tp, cur.total) + ')'],
      th ? 'รพ. ที่รับมากสุด: ' + th[0] + ' ' + fmt(th[1]) + ' เคส (' + share(th[1], tp) + ' ของเคสที่นำส่ง)' : null);

    const cg = {};
    G4.forEach((g) => { cg[g] = cohort(zone, sel, g); });
    const tcs = (c) => top(c.tr.combo, 3).map((x) => x[0] + ' (' + (cname(x[0]) || '—') + ') ' + fmt(x[1])).join(' · ') || '—';
    li('ชุดรหัสอาการ', ['ที่พบมากสุด Basic: ', { b: tcs(cg.Basic) }, ' · Advance: ', { b: tcs(cg.Advance) }],
      'อ่านเช่น 25เหลือง1 = รหัส 25 (อุบัติเหตุยานยนต์) สีเหลือง ระดับ 1 · ดูนิยามรหัส 1–26 ในกล่องอ้างอิงท้ายหน้า');
    if (lf === 'all') {
      const tb = top(new Map([...cg.Basic.unit.values()].map((u) => [u.unit, u.total])), 2);
      const ta = top(new Map([...cg.Advance.unit.values()].map((u) => [u.unit, u.total])), 3);
      li('หน่วยที่ออก', ['Basic ออกโดย ', { b: tb.map((u) => short(u[0]) + ' ' + fmt(u[1])).join(' · ') || '—' }, ' เคส · Advance ออกโดย ', { b: ta.map((u) => short(u[0]) + ' ' + fmt(u[1])).join(' · ') || '—' }, ' เคส']);
    } else {
      const tu = top(new Map([...cur.unit.values()].map((u) => [u.unit, u.total])), 3);
      li('หน่วยที่ออก', ['เฉพาะ ' + G4LONG[lf] + ' ออกโดย ', { b: tu.map((u) => short(u[0]) + ' ' + fmt(u[1])).join(' · ') || '—' }, ' เคส จากทั้งหมด ' + fmt(cur.total) + ' เคส']);
    }
    const unk = base.lv['ไม่ระบุ'] || 0, nores = trv(base, 'outcome', 'ไม่มีบันทึกผล');
    li('ควรตรวจ', ['ไม่ระบุระดับ ', { b: fmt(unk) }, ' เคส (' + share(unk, base.total) + ') · ไม่มีบันทึกผลปฏิบัติงาน ', { b: fmt(nores) }, ' เคส (' + share(nores, base.total) + ') · ไม่มีบันทึกผลการดูแลเบื้องต้น ', { b: fmt(trv(base, 'care', 'ไม่มีบันทึก')) }, ' เคส']);
  }

  /* hero */
  function renderHero() {
    const base = cohort(zone, sel, 'all');
    const cnt = g4of(base.lv);
    const c = C();
    const box = $('zx-hero');
    box.replaceChildren();
    G4.forEach((g) => {
      const b = el('button', 'zx-tile');
      b.type = 'button';
      b.dataset.g = g;
      b.style.setProperty('--tc', c[g]);
      b.setAttribute('aria-pressed', String(lf === g));
      const l = el('span', 'l');
      const sw = el('i', 'zx-sw'); sw.style.background = c[g];
      l.appendChild(sw); l.appendChild(document.createTextNode(G4LONG[g]));
      b.appendChild(l);
      b.appendChild(el('span', 'n', fmt(cnt[g])));
      let sub = share(cnt[g], base.total) + ' ของเคส';
      if (g === 'อื่นๆ') sub = 'ML ' + fmt(base.lv.ML || 0) + ' · CLS ' + fmt(base.lv.CLS || 0) + ' · FR ' + fmt(base.lv.FR || 0) + ' · ERB ' + fmt(base.lv.ERB || 0);
      b.appendChild(el('span', 'p', sub));
      b.addEventListener('click', () => setLf(lf === g ? 'all' : g));
      box.appendChild(b);
    });
    const items = LV7.map((k) => ({ key: k, label: LV7NAME[k], v: base.lv[k] || 0, color: LV7C[k], on: lf !== 'all' && G4OF[k] === lf }));
    const pick = (it) => setLf(lf === G4OF[it.key] ? 'all' : G4OF[it.key]);
    drawDonut($('zx-pie'), items, base.total, 'เคสทั้งหมด', pick);
    pieLegend($('zx-pie-leg'), items, base.total, pick);
  }

  /* donut chart: items [{key, label, v, color, on}] */
  function drawDonut(box, items, total, caption, onPick) {
    box.replaceChildren();
    const S = 200, R = S / 2 - 2;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + S + ' ' + S);
    const g = svg.append('g').attr('transform', 'translate(' + S / 2 + ',' + S / 2 + ')');
    const data = items.filter((i) => i.v > 0);
    const arcs = d3.pie().sort(null).value((d) => d.v).padAngle(0.008)(data);
    const arc = d3.arc().innerRadius(R * 0.58).outerRadius(R);
    const arcOn = d3.arc().innerRadius(R * 0.58).outerRadius(R + 2);
    arcs.forEach((a) => {
      const d = a.data;
      const path = g.append('path').attr('d', (d.on ? arcOn : arc)(a)).style('fill', d.color).attr('class', d.on ? 'on' : null);
      path.on('mouseenter', (e) => showTip(e, d.label, [[d.color, fmt(d.v) + ' เคส (' + share(d.v, total) + ')']])).on('mousemove', moveTip).on('mouseleave', hideTip);
      if (onPick) path.on('click', () => { hideTip(); onPick(d); });
    });
    g.append('text').attr('text-anchor', 'middle').attr('y', 2).attr('font-size', 26).attr('font-weight', 700).style('fill', 'var(--color-fg)').text(fmt(total));
    g.append('text').attr('text-anchor', 'middle').attr('y', 22).attr('font-size', 12).style('fill', 'var(--color-fg-muted)').text(caption);
  }
  function pieLegend(box, items, total, onPick) {
    box.replaceChildren();
    items.forEach((it) => {
      const b = el(onPick ? 'button' : 'div', 'it' + (it.on ? ' on' : ''));
      if (onPick) { b.type = 'button'; b.addEventListener('click', () => onPick(it)); }
      const i = el('i'); i.style.background = it.color;
      b.append(i, el('span', null, it.label), el('span', 'c', fmt(it.v)), el('span', 'p', share(it.v, total)));
      box.appendChild(b);
    });
  }

  /* benchmark */
  function renderBench() {
    const cs = {};
    G4.forEach((g) => { cs[g] = cohort(zone, sel, g); });
    const base = cohort(zone, sel, 'all');
    $('zx-bm-note').textContent = dlabel(zone, sel) + ' · เปอร์เซ็นต์คิดจากเคสของกลุ่มนั้นเอง (หัวตารางที่ไฮไลต์คือระดับที่เลือกอยู่)';
    const tr = el('tr');
    tr.appendChild(el('th', null, 'ตัวชี้วัด'));
    const c = C();
    G4.forEach((g) => {
      const th = el('th', lf === g ? 'hl' : null);
      const h = el('div', 'h');
      const sw = el('i', 'zx-sw'); sw.style.background = c[g];
      h.appendChild(sw); h.appendChild(document.createTextNode(g));
      th.appendChild(h);
      if (g === 'อื่นๆ') th.appendChild(el('small', null, 'ML · CLS · FR · ERB'));
      tr.appendChild(th);
    });
    $('zx-bm').tHead.replaceChildren(tr);
    const tb = $('zx-bm').tBodies[0];
    tb.replaceChildren();
    const frac = (c1, n) => share(n, c1.total);
    const topTxt = (map, c1, f) => { const t = top(map, 1)[0]; return t && c1.total ? f(t[0]) + ' · ' + pct(t[1] / c1.total) : '—'; };
    const nth = (map, c1, i) => { const x = top(map, i + 1)[i]; return x && c1.total ? clabel(x[0]) + ' · ' + pct(x[1] / c1.total) : '—'; };
    const rows = [
      ['grp', 'ปริมาณ'],
      ['จำนวนเคส', (c1) => fmt(c1.total) + ' · ' + share(c1.total, base.total) + ' ของพื้นที่'],
      ['เฉลี่ยต่อเดือน', (c1) => fmt(Math.round(c1.total / nMonths))],
      ['จำนวนหน่วยที่ออก', (c1) => fmt(c1.unit.size)],
      ['หน่วยอันดับ 1', (c1) => { const t = top(new Map([...c1.unit.values()].map((u) => [u.unit, u.total])), 1)[0]; return t ? short(t[0]) + ' · ' + pct(t[1] / c1.total) : '—'; }],
      ['grp', 'ผู้ป่วย'],
      ['เด็ก (0–14 ปี)', (c1) => frac(c1, trv(c1, 'age', 'เด็ก'))],
      ['ผู้ใหญ่ (15–59 ปี)', (c1) => frac(c1, trv(c1, 'age', 'ผู้ใหญ่'))],
      ['ผู้สูงอายุ (≥60 ปี)', (c1) => frac(c1, trv(c1, 'age', 'ผู้สูงอายุ'))],
      ['ชาย / หญิง', (c1) => frac(c1, trv(c1, 'sex', 'ชาย')) + ' / ' + frac(c1, trv(c1, 'sex', 'หญิง'))],
      ['ทำ CPR หรือ AED/DF', (c1) => fmt(cprAny(c1)) + ' · ' + frac(c1, cprAny(c1))],
      ['เสียชีวิต ณ จุดเกิดเหตุ', (c1) => fmt(trv(c1, 'care', DEAD)) + ' · ' + frac(c1, trv(c1, 'care', DEAD))],
      ['นำส่งห้องฉุกเฉิน', (c1) => frac(c1, transported(c1))],
      ['grp', 'ชุดรหัสอาการ (รหัส-สี-ระดับ)'],
      ['อันดับ 1', (c1) => nth(c1.tr.combo, c1, 0)],
      ['อันดับ 2', (c1) => nth(c1.tr.combo, c1, 1)],
      ['อันดับ 3', (c1) => nth(c1.tr.combo, c1, 2)],
      ['grp', 'พื้นที่และเวลา'],
      ['แขวงพบมากสุด', (c1) => topTxt(c1.tr.tambon, c1, (k) => k)],
      ['ชั่วโมงพีค', (c1) => topTxt(c1.tr.hour, c1, (k) => hh(+k))],
      ['วันพีค', (c1) => topTxt(c1.tr.dow, c1, (k) => DOW[+k])],
      ['grp', 'ผลปฏิบัติงาน'],
      ['พบเหตุ', (c1) => frac(c1, trv(c1, 'outcome', 'พบเหตุ'))],
      ['ไม่พบเหตุ', (c1) => frac(c1, trv(c1, 'outcome', 'ไม่พบเหตุ'))],
      ['ไม่มีบันทึกผล', (c1) => frac(c1, trv(c1, 'outcome', 'ไม่มีบันทึกผล'))]
    ];
    rows.forEach((r) => {
      const row = el('tr');
      if (r[0] === 'grp') {
        row.className = 'grp';
        const td = el('td', null, r[1]); td.colSpan = 5; row.appendChild(td);
      } else {
        row.appendChild(el('td', 'lbl', r[0]));
        G4.forEach((g) => row.appendChild(el('td', lf === g ? 'hl' : null, cs[g].total ? r[1](cs[g]) : '—')));
      }
      tb.appendChild(row);
    });
  }

  /* zone or district comparison */
  function renderCompare() {
    const byZone = zone === 'all';
    $('zx-cmp-h').textContent = byZone ? 'เปรียบเทียบ 11 โซน' : 'เปรียบเทียบเขตใน Zone ' + zone;
    $('zx-cmp-note').textContent = (lf === 'all' ? 'ทุกระดับหน่วย' : 'เฉพาะ ' + G4LONG[lf]) + ' · กดแถวเพื่อดูเฉพาะ' + (byZone ? 'โซน' : 'เขต') + 'นั้น · เปอร์เซ็นต์คิดจากเคสในแถวนั้น';
    const heads = [byZone ? 'โซน' : 'เขต', 'เคสรวม', 'สัดส่วนระดับ', 'Basic', 'Advance', 'อื่นๆ', 'ไม่ระบุ', 'ผู้สูงอายุ', 'ทำ CPR/AED', 'เสียชีวิต ณ จุดเกิดเหตุ', 'นำส่งห้องฉุกเฉิน', 'ชุดรหัสอันดับ 1'];
    const tr = el('tr');
    heads.forEach((h) => tr.appendChild(el('th', null, h)));
    $('zx-cmp').tHead.replaceChildren(tr);
    const tb = $('zx-cmp').tBodies[0];
    tb.replaceChildren();
    legG4($('zx-leg-cmp'));
    const items = byZone
      ? [['all', 'ทั้ง กทม.', () => setZone('all')]].concat(ZONES.map((z) => [z, 'Zone ' + z, () => setZone(z)]))
      : [['all', 'ทั้ง Zone ' + zone, () => setSel('all')]].concat((zoneDists.get(zone) || []).map((e) => [e.district, e.district + (e.tambons ? ' (บางแขวง)' : ''), () => setSel(sel === e.district ? 'all' : e.district)]));
    items.forEach(([key, name, fn]) => {
      const c1 = byZone ? cohort(key, 'all', lf) : cohort(zone, key, lf);
      const cnt = g4of(c1.lv);
      const picked = byZone ? zone === key : sel === key;
      const row = el('tr', picked ? 'pick' : null);
      row.appendChild(el('td', null, name));
      const cell = (n, p) => { const td = el('td', null, fmt(n)); if (p != null) td.appendChild(el('small', null, p)); return td; };
      row.appendChild(cell(c1.total, null));
      const mx = el('td', 'mix');
      const tr2 = el('div', 'zx-track line');
      partsOf(cnt).forEach((p) => { if (!p.v) return; const s = el('span'); s.style.width = (p.v / c1.total * 100) + '%'; s.style.background = p.c; tr2.appendChild(s); });
      mx.appendChild(tr2);
      row.appendChild(mx);
      G4.forEach((g) => row.appendChild(cell(cnt[g], share(cnt[g], c1.total))));
      const old = trv(c1, 'age', 'ผู้สูงอายุ'), cpr = cprAny(c1), dead = trv(c1, 'care', DEAD), tp = transported(c1);
      row.appendChild(cell(old, share(old, c1.total)));
      row.appendChild(cell(cpr, share(cpr, c1.total)));
      row.appendChild(cell(dead, share(dead, c1.total)));
      row.appendChild(cell(tp, share(tp, c1.total)));
      const x = top(c1.tr.combo, 1)[0];
      row.appendChild(el('td', null, x && c1.total ? clabel(x[0]) + ' · ' + pct(x[1] / c1.total) : '—'));
      row.addEventListener('click', fn);
      tb.appendChild(row);
    });
  }

  /* patients */
  const MALE = 'M12 0.5a5 5 0 1 1 0 10a5 5 0 0 1 0-10zM6.5 12.5h11a2.5 2.5 0 0 1 2.5 2.5v13h-3.2v18.5h-4v-16h-1.6v16h-4V28H4V15a2.5 2.5 0 0 1 2.5-2.5z';
  const FEMALE = 'M12 0.5a5 5 0 1 1 0 10a5 5 0 0 1 0-10zM8.5 12.5h7l6.5 19h-5v15h-3.4v-15h-1.2v15H9v-15H2z';
  function person(shape, color) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 47');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', shape);
    p.style.fill = color;
    svg.appendChild(p);
    return svg;
  }
  /* split `slots` icons by largest remainder */
  function iconCounts(vals, slots) {
    const tot = d3.sum(vals) || 1;
    const raw = vals.map((v) => v / tot * slots);
    const out = raw.map(Math.floor);
    let left = slots - d3.sum(out);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
    return out;
  }
  function renderPatients() {
    const cur = cohort(zone, sel, lf);
    const T = cur.total;
    const ageItems = [['เด็ก', 'เด็ก 0–14 ปี', 'var(--ag-1)'], ['ผู้ใหญ่', 'ผู้ใหญ่ 15–59 ปี', 'var(--ag-2)'], ['ผู้สูงอายุ', 'ผู้สูงอายุ 60 ปีขึ้นไป', 'var(--ag-3)'], ['ไม่ระบุ', 'ไม่ระบุอายุ', 'var(--lv-unk)']]
      .map(([k, label, color]) => ({ key: k, label, v: trv(cur, 'age', k), color }));
    drawDonut($('zx-age'), ageItems, T, 'เคส', null);
    pieLegend($('zx-age-leg'), ageItems, T, null);

    const m = trv(cur, 'sex', 'ชาย'), f = trv(cur, 'sex', 'หญิง'), u = trv(cur, 'sex', 'ไม่ระบุ');
    const st = $('zx-sexstat');
    st.replaceChildren();
    [['m', 'ชาย', m, MALE, 'var(--sx-m)'], ['f', 'หญิง', f, FEMALE, 'var(--sx-f)']].forEach(([c, name, v, shape, color]) => {
      const d = el('div', 's ' + c);
      const l = el('span', 'l');
      const ic = person(shape, color); ic.style.width = '.7rem';
      l.append(ic, document.createTextNode(name));
      d.append(l, el('span', 'v', share(v, T)), el('span', 'n', fmt(v) + ' เคส'));
      st.appendChild(d);
    });
    const counts = iconCounts([m, f, u], 20);
    const pic = $('zx-sex');
    pic.replaceChildren();
    for (let i = 0; i < counts[0]; i++) pic.appendChild(person(MALE, 'var(--sx-m)'));
    for (let i = 0; i < counts[1]; i++) pic.appendChild(person(FEMALE, 'var(--sx-f)'));
    for (let i = 0; i < counts[2]; i++) pic.appendChild(person(i % 2 ? FEMALE : MALE, 'var(--lv-unk)'));
    hover(pic, 'เพศผู้ป่วย', [['var(--sx-m)', 'ชาย ' + fmt(m) + ' (' + share(m, T) + ')'], ['var(--sx-f)', 'หญิง ' + fmt(f) + ' (' + share(f, T) + ')'], ['var(--lv-unk)', 'ไม่ระบุ ' + fmt(u) + ' (' + share(u, T) + ')']]);

    renderCprOutcome(cur);
    renderHosp(cur);
  }

  /* CPR x outcome: survival after CPR by method, and whether dead-at-scene cases got CPR */
  const OUTS4 = [
    ['alive', 'รอดชีวิต (มีบันทึกผล)', 'var(--o-alive)'],
    ['blank', 'รอดชีวิต (ช่องผลว่าง)', 'var(--o-blank)'],
    ['dead_tx', 'เสียชีวิตขณะนำส่ง', 'var(--o-tx)'],
    ['dead', 'เสียชีวิต ณ จุดเกิดเหตุ', 'var(--o-dead)']
  ];
  const CPRDONE = ['CPR', 'CPR + AED/DF', 'AED/DF อย่างเดียว'];
  const CPRNAME = { CPR: 'CPR อย่างเดียว', 'CPR + AED/DF': 'CPR + AED/DF', 'AED/DF อย่างเดียว': 'AED/DF อย่างเดียว' };
  function renderCprOutcome(cur) {
    const T = cur.total;
    const co = (g, o) => trv(cur, 'cprout', g + '|' + o);
    const grp = (g) => { const x = {}; OUTS4.forEach(([o]) => { x[o] = co(g, o); }); x.n = d3.sum(OUTS4, ([o]) => x[o]); return x; };
    const done = CPRDONE.map((g) => [g, grp(g)]);
    const sumK = (k) => d3.sum(done, (d) => d[1][k]);
    const nCpr = sumK('n'), alive = sumK('alive') + sumK('blank'), blankC = sumK('blank'), deadC = sumK('dead');
    const deadAll = trv(cur, 'care', DEAD);
    const deadNo = deadAll - deadC;
    const pct2 = (n, d) => (d ? d3.format('.2f')(n / d * 100) : '—');

    const kpi = $('zx-cprkpi');
    kpi.replaceChildren();
    const tile = (cls, label, v, sub) => {
      const k = el('div', 'k ' + cls);
      k.append(el('span', 'l', label), el('span', 'v', v), el('span', 's', sub));
      kpi.appendChild(k);
    };
    tile('', 'ทำ CPR หรือ AED/DF', fmt(nCpr), share(nCpr, T) + ' ของเคสทั้งหมด');
    tile('alive', 'รอดชีวิตหลัง CPR', share(alive, nCpr), fmt(alive) + ' เคส · ช่องผลว่าง ' + fmt(blankC));
    tile('dead', 'เสียชีวิต ณ จุดเกิดเหตุ', fmt(deadAll), 'ร้อยละ ' + pct2(deadAll, T) + ' ของเคสทั้งหมด');

    legend($('zx-cpr-leg'), OUTS4.map(([, l, c]) => [l, c]));
    const box = $('zx-cpr');
    box.replaceChildren();
    done.forEach(([g, x]) => {
      const row = el('div', 'zx-orow');
      const nm = el('span', 'nm', CPRNAME[g]);
      nm.appendChild(el('small', null, fmt(x.n) + ' เคส'));
      const bar = el('div', 'bar');
      OUTS4.forEach(([o, , c]) => {
        if (!x[o]) return;
        const w = x[o] / x.n;
        const sp = el('span', o === 'blank' ? 'lt' : null, w >= 0.12 ? pct(w) : '');
        sp.style.width = (w * 100) + '%';
        sp.style.background = c;
        bar.appendChild(sp);
      });
      if (!x.n) bar.appendChild(el('span', 'lt', '—'));
      const rs = el('span', 'rs');
      rs.append(el('b', null, share(x.alive + x.blank, x.n)), el('small', null, 'รอดชีวิต'));
      row.append(nm, bar, rs);
      hover(row, CPRNAME[g] + ' · ' + fmt(x.n) + ' เคส', OUTS4.map(([o, l, c]) => [c, l + ': ' + fmt(x[o]) + ' (' + share(x[o], x.n) + ')']));
      box.appendChild(row);
    });

    $('zx-dead-h').textContent = 'เสียชีวิต ณ จุดเกิดเหตุ ' + fmt(deadAll) + ' เคส ได้ทำ CPR หรือไม่';
    const ds = $('zx-dead');
    ds.replaceChildren();
    const bar = el('div', 'bar');
    const a = el('span', 'cpr', deadAll && deadC / deadAll >= 0.18 ? 'ทำ CPR/AED ' + fmt(deadC) : '');
    a.style.width = (deadAll ? deadC / deadAll * 100 : 0) + '%';
    const b = el('span', 'no', deadAll && deadNo / deadAll >= 0.18 ? 'ไม่ได้ทำ CPR ' + fmt(deadNo) : '');
    b.style.width = (deadAll ? deadNo / deadAll * 100 : 0) + '%';
    if (deadC) bar.appendChild(a);
    if (deadNo) bar.appendChild(b);
    hover(bar, 'เสียชีวิต ณ จุดเกิดเหตุ ' + fmt(deadAll) + ' เคส', [['color-mix(in srgb, var(--o-dead) 45%, var(--color-bg))', 'ทำ CPR/AED ก่อนลงเสียชีวิต: ' + fmt(deadC) + ' (' + share(deadC, deadAll) + ')'], ['var(--o-dead)', 'ไม่ได้ทำ CPR: ' + fmt(deadNo) + ' (' + share(deadNo, deadAll) + ')']]);
    const cap = el('div', 'cap');
    const c1 = el('span'); c1.append(document.createTextNode('ทำ CPR/AED แล้วเสียชีวิต '), el('b', null, fmt(deadC) + ' · ' + share(deadC, deadAll)));
    const c2 = el('span'); c2.append(document.createTextNode('เสียชีวิตโดยไม่ได้ทำ CPR '), el('b', null, fmt(deadNo) + ' · ' + share(deadNo, deadAll)));
    cap.append(c1, c2);
    ds.append(bar, cap);
    $('zx-cpr-note').textContent = 'รอดชีวิต = ไม่ได้ลงว่าเสียชีวิต (นับรวมเคสที่ช่องผลการดูแลเบื้องต้นว่าง) · เสียชีวิตขณะนำส่งแยกไว้ต่างหาก · ร้อยละในแถบคิดจากเคสที่ทำ CPR วิธีนั้น · ' + dlabel(zone, sel) + (lf === 'all' ? '' : ' · ' + lf);
  }

  const HCOLS = [['name', 'โรงพยาบาล'], ['Basic', 'Basic'], ['Advance', 'Advance'], ['อื่นๆ', 'อื่นๆ'], ['ไม่ระบุ', 'ไม่ระบุ'], ['total', 'รวม'], ['share', '% ของเคสที่นำส่ง']];
  function buildHospHead() {
    const tr = el('tr');
    tr.appendChild(el('th', null, 'เทียบ'));
    HCOLS.forEach((c) => {
      const th = el('th');
      const b = el('button', null, c[1]);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (hsort.k === c[0]) hsort.dir = -hsort.dir; else hsort = { k: c[0], dir: c[0] === 'name' ? 1 : -1 };
        renderHosp(cohort(zone, sel, lf));
      });
      th.appendChild(b);
      tr.appendChild(th);
    });
    $('zx-hosp').tHead.replaceChildren(tr);
  }
  function renderHosp(cur) {
    const cols = $('zx-hosp').tHead.rows[0].cells;
    HCOLS.forEach((c, i) => cols[i + 1].setAttribute('aria-sort', hsort.k === c[0] ? (hsort.dir > 0 ? 'ascending' : 'descending') : 'none'));
    const tp = transported(cur);
    let hs = [...cur.hosp.entries()].filter((e) => e[0] !== NOHOSP).map((e) => Object.assign({ name: e[0], share: tp ? e[1].total / tp : 0 }, e[1]));
    const nh = hs.length;
    const q = hquery.trim().toLowerCase();
    if (q) hs = hs.filter((h) => h.name.toLowerCase().includes(q));
    hs.sort((x, y) => {
      const A = x[hsort.k], B = y[hsort.k];
      return (typeof A === 'string' ? A.localeCompare(B, 'th') : A - B) * hsort.dir || y.total - x.total;
    });
    const none = cur.hosp.get(NOHOSP);
    const tb = $('zx-hosp').tBodies[0];
    tb.replaceChildren();
    const addRow = (h, cls, shareTxt) => {
      const tr = el('tr', cls || (picks.hosp.includes(h.name) ? 'picked' : null));
      const pc = el('td');
      if (!cls) pc.appendChild(pickBtn('hosp', h.name));
      tr.appendChild(pc);
      tr.appendChild(el('td', null, h.name));
      G4.concat(['total']).forEach((k) => tr.appendChild(el('td', h[k] ? null : 'z', fmt(h[k] || 0))));
      tr.appendChild(el('td', null, shareTxt));
      tb.appendChild(tr);
    };
    hs.forEach((h) => addRow(h, null, pct(h.share)));
    if (none && !q) addRow(Object.assign({ name: NOHOSP }, none), 'none', share(none.total, cur.total) + ' ของเคสทั้งหมด');
    renderPairs('hosp');
    $('zx-hosp-note').textContent = fmt(nh) + ' โรงพยาบาล · นำส่ง ' + fmt(tp) + ' จาก ' + fmt(cur.total) + ' เคส (' + share(tp, cur.total) + ')' + (q ? ' · แสดง ' + fmt(hs.length) + ' ที่ตรงกับคำค้น' : '');
  }

  /* traits */
  function renderTraits() {
    const cur = cohort(zone, sel, lf);
    const scope = dlabel(zone, sel) + (lf === 'all' ? '' : ' · ' + lf);
    $('zx-combo-note').textContent = scope + ' · 15 ชุดแรก · อ่านเช่น 25แดง2 = รหัส 25 (อุบัติเหตุยานยนต์) สีแดง ระดับ 2';
    valRows($('zx-combo'), top(cur.tr.combo, 15).map((x) => ({ label: clabel(x[0]), v: x[1] })), cur.total);
    valRows($('zx-dow'), DOW.map((n, i) => ({ label: n, v: cur.tr.dow.get(String(i)) || 0 })), cur.total);
    valRows($('zx-tam'), top(cur.tr.tambon, 10).map((x) => ({ label: x[0], v: x[1] })), cur.total);
    $('zx-lvc-note').textContent = dlabel(zone, sel) + ' · 6 ชุดแรกของแต่ละระดับ · เปอร์เซ็นต์คิดจากเคสของระดับนั้น';
    const lb = $('zx-lvc');
    lb.replaceChildren();
    G4.forEach((g) => {
      const c1 = cohort(zone, sel, g);
      const col = el('div');
      const h = el('h3');
      const sw = el('i', 'zx-sw'); sw.style.background = C()[g];
      h.appendChild(sw); h.appendChild(document.createTextNode(g + ' · ' + fmt(c1.total) + ' เคส'));
      col.appendChild(h);
      const rows = el('div', 'zx-rows');
      col.appendChild(rows);
      lb.appendChild(col);
      valRows(rows, top(c1.tr.combo, 6).map((x) => ({ label: x[0], tip: clabel(x[0]), v: x[1], color: C()[g] })), c1.total);
    });
    drawHours(cur);
  }
  function drawHours(cur) {
    const box = $('zx-hour');
    box.replaceChildren();
    const W = box.clientWidth;
    if (!W) return;
    const H = 270, m = { t: 22, r: 4, b: 24, l: 4 };
    const hrs = d3.range(24);
    const vals = hrs.map((h) => cur.tr.hour.get(String(h)) || 0);
    const mx = d3.max(vals) || 1;
    const x = d3.scaleBand(hrs, [m.l, W - m.r]).padding(0.18);
    const y = d3.scaleLinear([0, mx], [H - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H).attr('role', 'img').attr('aria-label', 'จำนวนเคสแต่ละชั่วโมงของวัน');
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).attr('stroke', 'var(--cds-chart-axis)');
    hrs.forEach((h) => {
      const v = vals[h];
      const isPeak = v === mx && v > 0;
      svg.append('rect').attr('x', x(h)).attr('width', x.bandwidth()).attr('y', y(v)).attr('height', Math.max(0, H - m.b - y(v))).attr('rx', 2).style('fill', 'var(--lv-oth)').style('opacity', isPeak ? 1 : 0.55);
      if (isPeak) svg.append('text').attr('x', x(h) + x.bandwidth() / 2).attr('y', y(v) - 5).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--color-fg)').text(fmt(v));
      if (h % 3 === 0) svg.append('text').attr('x', x(h) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(String(h).padStart(2, '0'));
      const hit = svg.append('rect').attr('x', x(h) - 1).attr('width', x.step()).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'transparent');
      hit.on('mouseenter', (e) => showTip(e, hh(h), [[null, fmt(v) + ' เคส (' + share(v, cur.total) + ')']])).on('mousemove', moveTip).on('mouseleave', hideTip);
    });
  }

  /* who */
  function renderUnits() {
    const cur = cohort(zone, sel, lf);
    legG4($('zx-leg1'));
    const box = $('zx-units');
    box.replaceChildren();
    const us = [...cur.unit.values()].sort((x, y) => y.total - x.total).slice(0, 12);
    const max = us.length ? us[0].total : 1;
    us.forEach((u) => box.appendChild(stackRow(short(u.unit), partsOf(g4of(u.lv)), u.total, max)));
  }
  function renderGroups() {
    const cur = cohort(zone, sel, lf);
    const box = $('zx-groups');
    box.replaceChildren();
    const max = d3.max(GROUPS, (g) => (cur.grp[g] || { total: 0 }).total) || 1;
    GROUPS.forEach((g) => {
      const x = cur.grp[g] || { total: 0, lv: {} };
      box.appendChild(stackRow(g, partsOf(g4of(x.lv)), x.total, max));
    });
    const outs = top(cur.tr.outcome, 10).map((x) => ({ label: x[0], v: x[1], color: x[0] === 'พบเหตุ' ? 'var(--bar)' : 'var(--lv-unk)' }));
    valRows($('zx-outs'), outs, cur.total);
  }
  function renderMonthly() {
    const cur = cohort(zone, sel, lf);
    legG4($('zx-leg3'));
    const box = $('zx-month');
    box.replaceChildren();
    const W = box.clientWidth;
    if (!W) return;
    const H = 230, m = { t: 20, r: 6, b: 26, l: 46 };
    const keys = [...cur.month.keys()].sort();
    const x = d3.scaleBand(keys, [m.l, W - m.r]).padding(0.28);
    const maxV = d3.max(keys, (k) => cur.month.get(k).total) || 1;
    const y = d3.scaleLinear([0, maxV], [H - m.b, m.t]).nice();
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', '0 0 ' + W + ' ' + H).attr('role', 'img').attr('aria-label', 'กราฟแท่งจำนวนเคสรายเดือน แยกตามระดับหน่วย');
    y.ticks(4).forEach((t) => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', 'var(--cds-chart-grid)').attr('stroke-width', 1);
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(fmt(t));
    });
    const c = C();
    const every = x.bandwidth() < 36 ? 2 : 1;
    keys.forEach((k, i) => {
      const v = cur.month.get(k);
      let acc = 0;
      G4.forEach((g) => {
        if (!v[g]) return;
        const y0 = y(acc), y1 = y(acc + v[g]);
        svg.append('rect').attr('x', x(k)).attr('width', x.bandwidth()).attr('y', y1).attr('height', Math.max(0, y0 - y1 - 1)).style('fill', c[g]);
        acc += v[g];
      });
      svg.append('text').attr('x', x(k) + x.bandwidth() / 2).attr('y', y(v.total) - 5).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--color-fg)').text(fmt(v.total));
      if (i % every === 0) svg.append('text').attr('x', x(k) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(monthLabel(k));
      const hit = svg.append('rect').attr('x', x(k) - x.step() * 0.14).attr('width', x.step()).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'transparent');
      const lines = G4.map((g) => [c[g], g + ': ' + fmt(v[g])]).concat([[null, 'รวม: ' + fmt(v.total)]]);
      hit.on('mouseenter', (e) => showTip(e, monthLabel(k), lines)).on('mousemove', moveTip).on('mouseleave', hideTip);
    });
  }

  /* units table */
  const COLS = [['unit', 'หน่วย'], ['group', 'กลุ่ม'], ['Basic', 'Basic'], ['Advance', 'Advance'], ['ML', 'ML'], ['CLS', 'CLS'], ['FR', 'FR'], ['ERB', 'ERB'], ['ไม่ระบุ', 'ไม่ระบุ'], ['total', 'รวม']];
  function buildHead() {
    const tr = el('tr');
    tr.appendChild(el('th', null, 'เทียบ'));
    COLS.forEach((c) => {
      const th = el('th');
      const b = el('button', null, c[1]);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (sort.k === c[0]) sort.dir = -sort.dir; else sort = { k: c[0], dir: (c[0] === 'unit' || c[0] === 'group') ? 1 : -1 };
        renderTable();
      });
      th.appendChild(b);
      tr.appendChild(th);
    });
    const th = el('th'); const b = el('button', null, 'สัดส่วน'); b.disabled = true; th.appendChild(b); tr.appendChild(th);
    $('zx-table').tHead.replaceChildren(tr);
  }
  function renderTable() {
    const cur = cohort(zone, sel, lf);
    const cols = $('zx-table').tHead.rows[0].cells;
    COLS.forEach((c, i) => cols[i + 1].setAttribute('aria-sort', sort.k === c[0] ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'));
    let us = [...cur.unit.values()].map((u) => ({ unit: u.unit, group: u.group, total: u.total, Basic: u.lv.Basic || 0, Advance: u.lv.Advance || 0, ML: u.lv.ML || 0, CLS: u.lv.CLS || 0, FR: u.lv.FR || 0, ERB: u.lv.ERB || 0, 'ไม่ระบุ': u.lv['ไม่ระบุ'] || 0 }));
    const q = query.trim().toLowerCase();
    if (q) us = us.filter((u) => u.unit.toLowerCase().includes(q));
    us.sort((x, y) => {
      const A = x[sort.k], B = y[sort.k];
      return (typeof A === 'string' ? A.localeCompare(B, 'th') : A - B) * sort.dir || y.total - x.total;
    });
    const max = d3.max(cur.unit.values(), (u) => u.total) || 1;
    const tb = $('zx-table').tBodies[0];
    tb.replaceChildren();
    us.forEach((u) => {
      const tr = el('tr', picks.unit.includes(u.unit) ? 'picked' : null);
      const pc = el('td'); pc.appendChild(pickBtn('unit', u.unit)); tr.appendChild(pc);
      COLS.forEach((c) => {
        const v = u[c[0]];
        tr.appendChild(el('td', typeof v === 'number' && v === 0 ? 'z' : null, typeof v === 'number' ? fmt(v) : short(v)));
      });
      const td = el('td'); const bar = el('span', 'bar'); bar.style.width = (u.total / max * 100) + '%'; td.appendChild(bar); td.style.minWidth = '7rem'; tr.appendChild(td);
      tb.appendChild(tr);
    });
    renderPairs('unit');
    $('zx-tbl-note').textContent = fmt(us.length) + ' หน่วย' + (q ? ' ที่ตรงกับคำค้น' : '') + ' · ' + dlabel(zone, sel) + (lf === 'all' ? '' : ' · ' + lf);
  }

  /* pair benchmark: up to 2 pairs (4 picks) of units or hospitals */
  const SLOT = ['A1', 'B1', 'A2', 'B2'];
  function pickBtn(kind, name) {
    const i = picks[kind].indexOf(name);
    const b = el('button', 'zx-pick ' + (i % 2 ? 'sb' : 'sa'), i >= 0 ? SLOT[i] : '＋');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(i >= 0));
    b.setAttribute('aria-label', (i >= 0 ? 'เอาออกจากการเทียบ: ' : 'เลือกมาเทียบ: ') + name);
    b.disabled = i < 0 && picks[kind].length >= 4;
    b.addEventListener('click', () => togglePick(kind, name));
    return b;
  }
  function togglePick(kind, name) {
    const p = picks[kind];
    const i = p.indexOf(name);
    if (i >= 0) p.splice(i, 1); else if (p.length < 4) p.push(name);
    if (kind === 'unit') renderTable(); else renderHosp(cohort(zone, sel, lf));
  }
  function scopedStats(rows, key) {
    const m = new Map();
    rows.forEach((r) => {
      if (!inScope(r, zone, sel)) return;
      if (lf !== 'all' && G4OF[r.level] !== lf) return;
      let x = m.get(r[key]);
      if (!x) { x = { n: 0, adv: 0, found: 0, transported: 0, old: 0, cpr: 0, dead: 0, red: 0, erawan: 0 }; m.set(r[key], x); }
      ['n', 'found', 'transported', 'old', 'cpr', 'dead', 'red', 'erawan'].forEach((k) => { x[k] += +r[k] || 0; });
      if (r.level === 'Advance') x.adv += +r.n;
    });
    return m;
  }
  const rate = (x, k) => (x.n ? x[k] / x.n : 0);
  const METRICS = {
    unit: [
      ['เคสที่ออก', (x) => x.n, 'n'],
      ['สัดส่วน ALS', (x) => rate(x, 'adv'), 'p'],
      ['พบเหตุ', (x) => rate(x, 'found'), 'p'],
      ['นำส่งห้องฉุกเฉิน', (x) => rate(x, 'transported'), 'p'],
      ['ผู้ป่วยสูงอายุ', (x) => rate(x, 'old'), 'p'],
      ['รหัสสีแดง', (x) => rate(x, 'red'), 'p'],
      ['ทำ CPR/AED (เคส)', (x) => x.cpr, 'n'],
      ['เสียชีวิต ณ จุดเกิดเหตุ (เคส)', (x) => x.dead, 'n']
    ],
    hosp: [
      ['เคสที่รับ', (x) => x.n, 'n'],
      ['ส่วนแบ่งของเคสที่นำส่ง', (x) => x.shareAll, 'p'],
      ['มาจากหน่วย ALS', (x) => rate(x, 'adv'), 'p'],
      ['ผู้ป่วยสูงอายุ', (x) => rate(x, 'old'), 'p'],
      ['รหัสสีแดง', (x) => rate(x, 'red'), 'p'],
      ['ทำ CPR/AED (เคส)', (x) => x.cpr, 'n'],
      ['ส่งโดยศูนย์เอราวัณ', (x) => rate(x, 'erawan'), 'p']
    ]
  };
  function renderPairs(kind) {
    const box = $(kind === 'unit' ? 'zx-ucmp' : 'zx-hcmp');
    box.replaceChildren();
    const p = picks[kind];
    const noun = kind === 'unit' ? 'หน่วย' : 'โรงพยาบาล';
    const hint = el('div', 'zx-cmphint');
    hint.appendChild(el('span', null, p.length
      ? 'เทียบ ' + fmt(p.length) + ' ' + noun + ' · ' + dlabel(zone, sel) + (lf === 'all' ? '' : ' · ' + lf) + (p.length < 4 ? ' · กด ＋ เพื่อเลือกเพิ่ม (สูงสุด 2 คู่)' : '')
      : 'Benchmark: กด ＋ หน้า' + noun + 'ในตารางเพื่อจับคู่เทียบกัน เลือกได้สูงสุด 2 คู่ (4 ' + noun + ') ตัวที่ 1–2 เป็นคู่แรก ตัวที่ 3–4 เป็นคู่ที่สอง'));
    if (p.length) {
      const clr = el('button', null, 'ล้างการเลือก');
      clr.type = 'button';
      clr.addEventListener('click', () => { picks[kind] = []; if (kind === 'unit') renderTable(); else renderHosp(cohort(zone, sel, lf)); });
      hint.appendChild(clr);
    }
    box.appendChild(hint);
    if (!p.length) return;
    const stats = kind === 'unit' ? scopedStats(ustats, 'unit') : scopedStats(hstats, 'hosp');
    if (kind === 'hosp') { const tot = d3.sum([...stats.values()], (x) => x.n); stats.forEach((x) => { x.shareAll = tot ? x.n / tot : 0; }); }
    const zero = { n: 0, adv: 0, found: 0, transported: 0, old: 0, cpr: 0, dead: 0, red: 0, erawan: 0, shareAll: 0 };
    const nm = (s) => (kind === 'unit' ? short(s) : s);
    const pairs = el('div', 'zx-pairs');
    for (let k = 0; k < p.length; k += 2) {
      const A = p[k], B = p[k + 1];
      const xa = stats.get(A) || zero, xb = B ? (stats.get(B) || zero) : null;
      const card = el('div', 'zx-pair');
      const hd = el('div', 'hd');
      hd.append(el('span', 'a', SLOT[k] + ' · ' + nm(A)), el('span', 'vs', 'vs'), B ? el('span', 'b', nm(B) + ' · ' + SLOT[k + 1]) : el('span', 'wait', 'เลือกอีก 1 ' + noun));
      card.appendChild(hd);
      METRICS[kind].forEach(([label, f, t]) => {
        const va = f(xa), vb = xb ? f(xb) : null;
        const max = t === 'p' ? 1 : Math.max(va, vb || 0, 1);
        const txt = (v) => (v == null ? '—' : t === 'p' ? pct(v) : fmt(v));
        const row = el('div', 'zx-bf');
        const side = (cls, v, win) => {
          const s1 = el('div', 'side ' + cls);
          const tr = el('div', 't'); const sp = el('span'); sp.style.width = (v == null ? 0 : v / max * 100) + '%'; tr.appendChild(sp);
          s1.append(tr, el('span', 'v' + (win ? ' win' : ''), txt(v)));
          return s1;
        };
        row.append(side('a', va, vb != null && va > vb), el('span', 'm', label), side('b', vb, vb != null && vb > va));
        card.appendChild(row);
      });
      pairs.appendChild(card);
    }
    box.appendChild(pairs);
  }

  function renderCodes() {
    const tb = $('zx-codes').tBodies[0];
    if (tb.rows.length) return;
    [...codeName.entries()].sort((a, b) => +a[0] - +b[0]).forEach(([c, n]) => {
      const tr = el('tr');
      tr.append(el('td', null, c), el('td', null, n));
      tb.appendChild(tr);
    });
  }

  /* maps: OpenStreetMap + Leaflet when available (GitHub Pages), plain SVG otherwise */
  const RAMPS = {
    unit: ['#f1efe3', '#0e3b2c'],
    all: ['#eee8f6', '#43277a'],
    'แดง': ['#fde3e0', '#a3121c'],
    'เหลือง': ['#fff4cc', '#a86b00'],
    'เขียว': ['#e3f4df', '#17703a'],
    'ขาว': ['#eef0f2', '#46525c']
  };
  const MCOLORS = [['all', 'ทุกรหัสสี', '#6a4c9c'], ['แดง', 'แดง', '#c8323c'], ['เหลือง', 'เหลือง', '#d9a21b'], ['เขียว', 'เขียว', '#2f8a4a'], ['ขาว', 'ขาว', '#9aa4ad']];
  /* d3 wants clockwise outer rings (RFC 7946 GeoJSON is counter-clockwise); flip any polygon d3 reads as the whole globe */
  function d3Wind(g) {
    const fix = (poly) => (d3.geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI ? poly.map((ring) => ring.slice().reverse()) : poly);
    if (g.type === 'Polygon') return { type: 'Polygon', coordinates: fix(g.coordinates) };
    if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(fix) };
    return g;
  }
  function zonesOf(d) {
    const zs = [];
    zoneDists.forEach((list, z) => { if (list.some((e) => e.district === d)) zs.push(z); });
    return zs;
  }
  function inZoneScope(d) { return zone === 'all' || zonesOf(d).includes(zone); }
  function mapRender(id, o) {
    const box = $(id);
    const fc = { type: 'FeatureCollection', features: geo.map((g) => ({ type: 'Feature', properties: { district: g.district }, geometry: g.geometry })) };
    const max = d3.max(o.values.values()) || 1;
    const scale = d3.scaleSequentialSqrt(d3.interpolateRgb(o.ramp[0], o.ramp[1])).domain([0, max]);
    const fill = (d) => { const v = o.values.get(d) || 0; return v > 0 ? scale(v) : 'transparent'; };
    const fmtV = o.fmtV || fmt;
    const tipLines = (d) => [[fill(d) === 'transparent' ? null : fill(d), fmtV(o.values.get(d) || 0) + ' ' + o.unitLabel], [null, 'โซน ' + (zonesOf(d).join(' / ') || '—')]];
    let m = maps[id];
    if (window.L) {
      if (!m) {
        box.replaceChildren();
        const map = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.25 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ขอบเขตเขต OpenGISData-Thailand (CC BY 4.0)' }).addTo(map);
        const layer = L.geoJSON(fc).addTo(map);
        m = maps[id] = { map, layer, fitKey: null };
      }
      m.layer.eachLayer((ly) => {
        const d = ly.feature.properties.district;
        const pick = o.pick === d, inz = zone !== 'all' && inZoneScope(d);
        ly.setStyle({ fillColor: fill(d) === 'transparent' ? '#ffffff' : fill(d), fillOpacity: fill(d) === 'transparent' ? 0.05 : 0.72, color: pick ? '#e3b341' : inz ? '#0e3b2c' : '#3d4a44', weight: pick ? 3.5 : inz ? 2 : 0.8, opacity: 0.9 });
        ly.unbindTooltip();
        ly.bindTooltip('<b>เขต' + d + '</b><br>' + fmtV(o.values.get(d) || 0) + ' ' + o.unitLabel + '<br>โซน ' + (zonesOf(d).join(' / ') || '—'), { sticky: true });
        ly.off('click');
        ly.on('click', () => o.onPick(d));
        if (pick) ly.bringToFront();
      });
      const key = zone + '|' + box.clientWidth;
      if (m.fitKey !== key) {
        const sel = m.layer.getLayers().filter((ly) => inZoneScope(ly.feature.properties.district));
        const b = L.featureGroup(sel.length ? sel : m.layer.getLayers()).getBounds();
        m.map.invalidateSize();
        m.map.fitBounds(b, { padding: [8, 8] });
        m.fitKey = key;
      }
      return;
    }
    box.replaceChildren();
    const W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return;
    const focus = { type: 'FeatureCollection', features: fc.features.filter((f) => inZoneScope(f.properties.district)) };
    const proj = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], focus.features.length ? focus : fc);
    const path = d3.geoPath(proj);
    const svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H);
    const feats = fc.features.slice().sort((a, b) => (o.pick === a.properties.district) - (o.pick === b.properties.district));
    feats.forEach((f) => {
      const d = f.properties.district;
      const p = svg.append('path').attr('d', path(f)).attr('class', 'd' + (zone !== 'all' && inZoneScope(d) ? ' inz' : '') + (o.pick === d ? ' pick' : '')).style('fill', fill(d));
      p.on('mouseenter', (e) => showTip(e, 'เขต' + d, tipLines(d))).on('mousemove', moveTip).on('mouseleave', hideTip).on('click', () => { hideTip(); o.onPick(d); });
    });
    if (zone !== 'all') {
      focus.features.forEach((f) => {
        const c = path.centroid(f);
        if (isFinite(c[0])) svg.append('text').attr('class', 'lbl').attr('x', c[0]).attr('y', c[1]).attr('text-anchor', 'middle').text(f.properties.district);
      });
    }
  }
  function mapLegend(id, ramp, max, label, fmtV) {
    const box = $(id);
    box.replaceChildren();
    const r = el('span', 'ramp');
    const it = d3.interpolateRgb(ramp[0], ramp[1]);
    r.style.background = 'linear-gradient(90deg,' + d3.range(0, 1.01, 0.25).map((t) => it(t)).join(',') + ')';
    box.append(el('span', null, '0'), r, el('span', null, (fmtV || fmt)(max) + ' ' + label));
  }
  function mapDetail(id, d, title, rows, base, color) {
    const box = $(id);
    box.replaceChildren();
    if (!d) { box.appendChild(el('span', 'zx-note', 'กดที่เขตบนแผนที่เพื่อดูรายแขวง')); return; }
    box.appendChild(el('h3', null, title));
    const list = el('div', 'zx-rows');
    box.appendChild(list);
    if (!rows.length) { list.appendChild(el('span', 'zx-note', 'ไม่มีเคสในเขตนี้')); return; }
    valRows(list, rows, base, color);
  }

  function renderMaps() {
    if (!geo.length) return;
    const lvOk = (r) => orgOk(r) && (lf === 'all' || G4OF[r.level] === lf);
    // unit map
    const tot = new Map();
    // หน่วยเรียงตามเคสในพื้นที่ที่เลือกบน sidebar (โซน/เขต) แต่แผนที่แสดงทั้ง กทม.
    const here = (d) => (sel !== 'all' ? d === sel : inZoneScope(d));
    unitmap.forEach((r) => { if (lvOk(r) && here(r.district)) tot.set(r.unit, (tot.get(r.unit) || 0) + +r.n); });
    const ulist = [...tot.entries()].sort((a, b) => b[1] - a[1]);
    if (!mapUnit || !tot.has(mapUnit)) mapUnit = ulist.length ? ulist[0][0] : null;
    const sel1 = $('zx-mu');
    sel1.replaceChildren();
    ulist.forEach(([u, n]) => { const op = el('option', null, short(u) + ' (' + fmt(n) + (zone === 'all' && sel === 'all' ? '' : ' ใน' + (sel !== 'all' ? 'เขต' + sel : ' Zone ' + zone)) + ')'); op.value = u; op.selected = u === mapUnit; sel1.appendChild(op); });
    const uv = new Map();
    const ut = new Map();
    unitmap.forEach((r) => {
      if (r.unit !== mapUnit || !lvOk(r)) return;
      uv.set(r.district, (uv.get(r.district) || 0) + +r.n);
      if (r.district === mapPick.u) ut.set(r.tambon, (ut.get(r.tambon) || 0) + +r.n);
    });
    const uTot = d3.sum(uv.values());
    const byZone = new Map();
    uv.forEach((n, d) => zonesOf(d).forEach((z) => byZone.set(z, (byZone.get(z) || 0) + n / zonesOf(d).length)));
    const topD = top(uv, 3).map((x) => x[0] + ' ' + fmt(x[1])).join(' · ');
    const topZ = top(byZone, 1)[0];
    $('zx-mu-sum').textContent = mapUnit ? short(mapUnit) + ' ออกเหตุ ' + fmt(uTot) + ' เคส ใน ' + fmt(uv.size) + ' จาก 50 เขต' + (topZ ? ' · ' + share(topZ[1], uTot) + ' อยู่ใน Zone ' + topZ[0] : '') + ' · มากสุด: ' + (topD || '—') + (lf === 'all' ? '' : ' · เฉพาะ ' + lf) : 'ไม่มีหน่วยในตัวกรองนี้';
    mapRender('zx-mapu', { values: uv, ramp: RAMPS.unit, unitLabel: 'เคส', pick: mapPick.u, onPick: (d) => { mapPick.u = mapPick.u === d ? null : d; renderMaps(); } });
    mapLegend('zx-mapu-leg', RAMPS.unit, d3.max(uv.values()) || 0, 'เคสต่อเขต');
    mapDetail('zx-mapu-det', mapPick.u, 'เขต' + mapPick.u + ' · ' + fmt(uv.get(mapPick.u) || 0) + ' เคส (' + share(uv.get(mapPick.u) || 0, uTot) + ' ของหน่วยนี้)', top(ut, 12).map((x) => ({ label: x[0], v: x[1] })), uv.get(mapPick.u) || 0);

    // color density map
    const chips = $('zx-mc');
    chips.replaceChildren();
    MCOLORS.forEach(([k, label, c]) => {
      const b = el('button');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(mapColor === k));
      const i = el('i'); i.style.background = c;
      b.append(i, document.createTextNode(label));
      b.addEventListener('click', () => { mapColor = k; renderMaps(); });
      chips.appendChild(b);
    });
    const mm = $('zx-mm');
    mm.replaceChildren();
    [['n', 'จำนวนเคส'], ['km2', 'ต่อ ตร.กม.']].forEach(([k, label]) => {
      const b = el('button', null, label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(mapMetric === k));
      b.addEventListener('click', () => { mapMetric = k; renderMaps(); });
      mm.appendChild(b);
    });
    const area = new Map(geo.map((g) => [g.district, g.area]));
    const cv = new Map();
    const ct = new Map();
    colormap.forEach((r) => {
      if (!lvOk(r) || (mapColor !== 'all' && r.color !== mapColor)) return;
      cv.set(r.district, (cv.get(r.district) || 0) + +r.n);
      if (r.district === mapPick.c) ct.set(r.tambon, (ct.get(r.tambon) || 0) + +r.n);
    });
    const cTot = d3.sum(cv.values());
    const vals = mapMetric === 'n' ? cv : new Map([...cv.entries()].map(([d, n]) => [d, area.get(d) ? n / area.get(d) : 0]));
    const f1 = d3.format(',.1f');
    const fmtV = mapMetric === 'n' ? fmt : f1;
    const label = mapMetric === 'n' ? 'เคส' : 'เคส/ตร.กม.';
    const ramp = RAMPS[mapColor];
    const topC = top(vals, 3).map((x) => x[0] + ' ' + fmtV(x[1])).join(' · ');
    const cname1 = mapColor === 'all' ? 'ทุกรหัสสี' : 'รหัส' + mapColor;
    $('zx-mc-sum').textContent = cname1 + ' ' + fmt(cTot) + ' เคส · เขตที่หนาแน่นสุด (' + label + '): ' + (topC || '—') + (lf === 'all' ? '' : ' · เฉพาะ ' + lf);
    mapRender('zx-mapc', { values: vals, ramp, unitLabel: label, fmtV, pick: mapPick.c, onPick: (d) => { mapPick.c = mapPick.c === d ? null : d; renderMaps(); } });
    mapLegend('zx-mapc-leg', ramp, d3.max(vals.values()) || 0, label, fmtV);
    const dn = cv.get(mapPick.c) || 0;
    mapDetail('zx-mapc-det', mapPick.c, 'เขต' + mapPick.c + ' · ' + cname1 + ' ' + fmt(dn) + ' เคส' + (area.get(mapPick.c) ? ' · ' + f1(dn / area.get(mapPick.c)) + ' เคส/ตร.กม.' : ''), top(ct, 12).map((x) => ({ label: x[0], v: x[1] })), dn, ramp[1]);
    $('zx-mapsrc').textContent = (window.L ? 'แผนที่พื้นหลัง © OpenStreetMap contributors · ' : 'แผนที่พื้นหลัง OpenStreetMap แสดงในเวอร์ชันเว็บ (GitHub Pages) · ') + 'ขอบเขต 50 เขต: OpenGISData-Thailand (CC BY 4.0) · กดที่เขตบนแผนที่เพื่อดูรายแขวง · สีเข้ม = เคสมาก';
  }

  function renderFlow() {
    const f = dash.data('screening');
    const tb = $('zx-flow').tBodies[0];
    tb.replaceChildren();
    if (f.status !== 'ok') return;
    f.data.forEach((r) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, r.step));
      tr.appendChild(el('td', null, (r.kind === 'drop' ? '−' : '') + fmt(+r.n)));
      tb.appendChild(tr);
    });
  }

  function setOrg(o) { org = o; mapUnit = null; picks.unit = picks.unit.filter((u) => o === 'all' || (groupOf.get(u) || '') === 'ศูนย์เอราวัณ'); draw(); }
  function setZone(z) { zone = z; sel = 'all'; mapUnit = null; draw(); }
  function setSel(d) { sel = d; mapUnit = null; draw(); }
  function setLf(g) { lf = g; draw(); }

  function draw() {
    const ds = ['cases', 'traits', 'units', 'zones', 'unitstats', 'hospstats', 'codes', 'unitmap', 'colormap', 'geo'].map((k) => dash.data(k));
    const err = $('zx-err');
    if (ds.some((d) => d.status !== 'ok')) {
      err.hidden = ds.some((d) => d.status === 'loading');
      return;
    }
    err.hidden = true;
    cases = ds[0].data;
    traits = ds[1].data;
    groupOf = new Map(ds[2].data.map((r) => [r.unit, r.group]));
    codeName = new Map(ds[6].data.map((r) => [String(r.code), r.name]));
    ustats = ds[4].data;
    unitmap = ds[7].data;
    colormap = ds[8].data;
    geo = ds[9].data.map((r) => ({ district: r.district, area: +r.area, geometry: d3Wind(typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry) }));
    hstats = ds[5].data;
    zoneDists = new Map();
    ds[3].data.forEach((r) => {
      const z = +r.zone;
      if (!zoneDists.has(z)) zoneDists.set(z, []);
      zoneDists.get(z).push({ district: r.district, tambons: r.tambons || '' });
    });
    nMonths = new Set(cases.map((x) => x.month)).size || 11;
    const base = cohort(zone, sel, 'all');
    const cnt = g4of(base.lv);
    $('zx-title').textContent = (org === 'erawan' ? 'รถศูนย์เอราวัณ · ' : '') + (zone === 'all' ? 'กรุงเทพมหานคร · ภาพรวม 11 โซน' : sel === 'all' ? 'Zone ' + zone + ' · ภาพรวม ' + (zoneDists.get(zone) || []).length + ' เขต' : 'Zone ' + zone + ' · เขต' + sel);
    $('zx-sub').textContent = 'Basic ' + fmt(cnt.Basic) + ' · Advance ' + fmt(cnt.Advance) + ' · อื่นๆ ' + fmt(cnt['อื่นๆ']) + ' · ไม่ระบุ ' + fmt(cnt['ไม่ระบุ']) + ' จากทั้งหมด ' + fmt(base.total) + ' เคส' + (lf === 'all' ? '' : ' · กำลังดูเฉพาะ ' + G4LONG[lf]);
    renderSide();
    renderSummary();
    renderHero();
    renderBench();
    renderCompare();
    renderPatients();
    renderTraits();
    renderUnits();
    renderGroups();
    renderMonthly();
    renderTable();
    renderFlow();
    renderCodes();
    renderMaps();
  }

  buildHead();
  buildHospHead();
  $('zx-mu').addEventListener('change', (e) => { mapUnit = e.target.value; mapPick.u = null; renderMaps(); });
  $('zx-q').addEventListener('input', (e) => { query = e.target.value; if (cases.length) renderTable(); });
  $('zx-hq').addEventListener('input', (e) => { hquery = e.target.value; if (cases.length) renderHosp(cohort(zone, sel, lf)); });
  dash.onData(draw);
})();
