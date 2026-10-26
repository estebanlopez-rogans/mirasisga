// ===================== CONFIGURACIÓN (único lugar a editar) =====================
const CONFIG = {
  // PLACEHOLDER: reemplazar por el número real de reservas (57 + celular, sin espacios ni signos).
  whatsapp: '573000000000',
  mensaje: 'Hola, quiero reservar en Mirasisga',
};
// ================================================================================

document.querySelectorAll('.js-wa').forEach(a => {
  a.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(a.dataset.msg || CONFIG.mensaje);
  a.target = '_blank'; a.rel = 'noopener';
});
const nav = document.getElementById('nav');
if (nav) {
  const solid = () => nav.classList.toggle('solid', window.scrollY > 40 || document.body.dataset.solid === '1');
  window.addEventListener('scroll', solid); solid();
}
const mb = document.getElementById('menuBtn'), menu = document.getElementById('menu');
if (mb && menu) {
  mb.addEventListener('click', () => { const o = menu.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
}

// ===================== MODELO v5 (mismas fórmulas que model.py) =====================
const Modelo = (() => {
  if (typeof DATOS === 'undefined') return null;
  const D = DATOS, P = D.params;
  const fijo = n => D.fijo_sitio + n * D.fijo_unidad;
  const unidad = plat => D.domo + (plat === 'concreto' ? D.plataforma_alt : D.plataforma) + D.bano;
  const modulos = n => Math.ceil(n / D.domos_por_septico);
  const capex = (n, plat) => (D.comun + D.agua + modulos(n) * D.septico + n * unidad(plat)) * (1 + D.imprevistos);
  function mes(s, ob = s.ob, oa = s.oa, n = s.n) {
    const nb = n * D.bajas_mes * ob, na = n * D.altas_mes * oa, noc = nb + na;
    let bruto = nb * s.tb + na * s.ta;
    if (s.iva === 'mas') bruto *= 1 + P.iva;
    const neto = s.iva === 'noresp' ? bruto : bruto / (1 + P.iva);
    const com = bruto * (s.ota * P.com_ota + (1 - s.ota) * P.com_directa);
    const vari = noc * s.varN;
    const extV = noc * P.extras_noche, extM = extV * P.margen_extras;
    const ventas = neto + extV;
    const ebitda = neto - com - vari + extM - fijo(n);
    return { noches: noc, bruto, neto, ventas, ebitda };
  }
  function equilibrio(s) {
    let lo = 0, hi = 3;
    for (let i = 0; i < 60; i++) {
      const k = (lo + hi) / 2;
      mes(s, Math.min(1, s.ob * k), Math.min(1, s.oa * k)).ebitda > 0 ? hi = k : lo = k;
    }
    const m = mes(s, Math.min(1, s.ob * hi), Math.min(1, s.oa * hi));
    return hi >= 3 ? null : m.noches;
  }
  // Escalado por reinversión desde 1 domo (igual que escalado() en model.py)
  function escalado(s, meta = 10, mesesMax = 240) {
    const sitio = D.fijo_sitio, costoK = k => capex(k, s.plat) - capex(k - 1, s.plat);
    const varUnit = mes(s, s.ob, s.oa, 1).ebitda + sitio;
    const unidades = [0], hitos = { 1: 0 }; let caja = 0;
    for (let t = 1; t <= mesesMax; t++) {
      const e = unidades.filter(u => u < t).reduce((a, u) => a + varUnit * (t - u <= 12 ? D.rampa : 1), 0) - sitio;
      caja += e;
      while (unidades.length < meta && caja >= costoK(unidades.length + 1)) {
        caja -= costoK(unidades.length + 1); unidades.push(t); hitos[unidades.length] = t;
      }
      if (unidades.length >= meta) break;
    }
    return hitos;
  }
  function calcular(s) {
    const m = mes(s), cap = capex(s.n, s.plat), anual = m.ebitda * 12;
    const flujo = [-cap]; for (let y = 1; y <= 10; y++) flujo.push(flujo[y - 1] + anual * (y === 1 ? D.rampa : 1));
    let payR = null;
    for (let y = 1; y <= 10; y++) if (flujo[y] >= 0) { payR = y - 1 + (-flujo[y - 1]) / (flujo[y] - flujo[y - 1]); break; }
    return { ...m, capex: cap, anual, roi: anual / cap, pay: anual > 0 ? cap / anual : null, payR, flujo,
             eq: equilibrio(s), hitos: s.n === 1 ? escalado(s) : null };
  }
  return { calcular, D };
})();

const fmtM = (n, d = 2) => (n < 0 ? '−' : '') + '$' + (Math.abs(n) / 1e6).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' M';
const fmtCOP = n => '$' + Math.round(n).toLocaleString('es-CO');
const fmtPct = n => Math.round(n * 100) + ' %';
const fmtDec = (n, d = 1) => n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });

if (Modelo && document.getElementById('simulador')) {
  const $ = id => document.getElementById(id);
  const ESC = Modelo.D.esc;
  const BASE = { n: 1, tb: Modelo.D.params.tarifa_baja, ta: Modelo.D.params.tarifa_alta, ob: ESC.Base[0], oa: ESC.Base[1],
                 ota: Modelo.D.params.pct_ota, varN: Modelo.D.var_noche, iva: 'incluido', plat: 'madera' };
  const ctl = { n: 'sDomos', tb: 'sTb', ta: 'sTa', ob: 'sOb', oa: 'sOa', ota: 'sOta', varN: 'sVar' };
  const set = s => { for (const k in ctl) $(ctl[k]).value = s[k]; $('sIva').value = s.iva; $('sPlat').value = s.plat; };
  const get = () => { const s = {}; for (const k in ctl) s[k] = +$(ctl[k]).value; s.iva = $('sIva').value; s.plat = $('sPlat').value; return s; };
  function chart(flujo) {
    const W = 520, H = 220, L = 58, B = 26, T = 12, R = 10;
    const mx = Math.max(...flujo, 0), mn = Math.min(...flujo, 0), span = (mx - mn) || 1;
    const x = i => L + i * (W - L - R) / 10, y = v => T + (mx - v) * (H - T - B) / span;
    let g = `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#2A2724" stroke-width="1"/>`;
    flujo.forEach((v, i) => { const bw = 26, yy = Math.min(y(v), y(0)), hh = Math.abs(y(v) - y(0));
      g += `<rect x="${x(i) - bw / 2}" y="${yy}" width="${bw}" height="${Math.max(hh, 1)}" rx="3" fill="${v < 0 ? '#B5653F' : '#3F5A3C'}"/>`;
      g += `<text x="${x(i)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="#5d564e">${i}</text>`; });
    [mx, 0, mn].forEach(v => g += `<text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="#5d564e">${fmtM(v, 0)}</text>`);
    $('chart').innerHTML = g;
  }
  function render() {
    const s = get(), r = Modelo.calcular(s);
    $('oDomos').textContent = s.n; $('oTb').textContent = fmtCOP(s.tb); $('oTa').textContent = fmtCOP(s.ta);
    $('oOb').textContent = fmtPct(s.ob); $('oOa').textContent = fmtPct(s.oa); $('oOta').textContent = fmtPct(s.ota); $('oVar').textContent = fmtCOP(s.varN);
    $('rCapex').textContent = fmtM(r.capex, 1); $('rVentas').textContent = fmtM(r.ventas); $('rEbitda').textContent = fmtM(r.ebitda);
    $('rAnual').textContent = fmtM(r.anual); $('rRoi').textContent = fmtPct(r.roi);
    $('rPay').textContent = r.pay ? fmtDec(r.pay) + ' años' : 'no recupera';
    $('rPayR').textContent = r.payR ? fmtDec(r.payR) + ' años' : '> 10 años';
    $('rNoches').textContent = fmtDec(r.noches); $('rEq').textContent = r.eq ? fmtDec(r.eq) : 'no alcanza';
    $('boxEbitda').className = 'out ' + (r.ebitda >= 0 ? 'pos' : 'neg');
    if (r.hitos) { const h = r.hitos, f = k => h[k] != null ? 'mes ' + h[k] : '—';
      $('rEscala').textContent = `${f(3)} · ${f(5)} · ${f(10)}`; }
    else $('rEscala').textContent = 'Aplica con 1 domo de arranque';
    chart(r.flujo);
    document.querySelectorAll('#scenBtns button').forEach(b => {
      const e = ESC[b.dataset.esc]; b.classList.toggle('on', Math.abs(e[0] - s.ob) < 1e-9 && Math.abs(e[1] - s.oa) < 1e-9); });
    window.__sim = r;
  }
  document.querySelectorAll('#simulador input, #simulador select').forEach(el => el.addEventListener('input', render));
  document.querySelectorAll('#scenBtns button').forEach(b => b.addEventListener('click', () => {
    const e = ESC[b.dataset.esc]; $('sOb').value = e[0]; $('sOa').value = e[1]; render(); }));
  $('btnReset').addEventListener('click', () => { set(BASE); render(); });
  set(BASE); render();
  // Auto-chequeo contra model.py (solo consola)
  const ref = Modelo.D.ref, r0 = Modelo.calcular(BASE);
  const ok = Math.abs(r0.ebitda - ref.base_ebitda) < 1 && Math.abs(r0.capex - ref.capex1) < 1;
  console[ok ? 'log' : 'warn']('Simulador v5 vs model.py:', ok ? 'OK' : 'DIFERENCIA', Math.round(r0.ebitda), Math.round(ref.base_ebitda));
}
