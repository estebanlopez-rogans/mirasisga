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

