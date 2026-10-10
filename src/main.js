import Lenis from 'lenis';
import { CARS, SOLD, GARAGE, GARAGE_START, byId } from './data/cars.js';
import { applyI18n, setLang, onLang, t, getLang } from './i18n.js';
import { World, detectQuality } from './three/world.js';
import { seg } from './three/story.js';

const TG = 'https://t.me/+ETmfnYnu1mVkMjk1';
const IG = 'https://www.instagram.com/hmgroup.uz/';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

applyI18n();

// Debug (faqat dev): ?p=0.5 — hikoyani shu nuqtada to'xtatadi (skrollga qaramaydi)
const DEBUG_P = import.meta.env.DEV ? new URLSearchParams(location.search).get('p') : null;

// Hikoya har doim garajdan boshlanadi
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) scrollTo(0, 0);

// Harakatni kamaytirish so'ralgan bo'lsa (OS sozlamasi): silliq skroll va uchish animatsiyalari o'chadi
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

// ---------------- Lenis (silliq skroll) ----------------
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: !REDUCE });
lenis.stop();
requestAnimationFrame(function raf(time) { lenis.raf(time); requestAnimationFrame(raf); });

const story = $('#story');
const storyRange = () => Math.max(1, story.offsetHeight - innerHeight);
const progressAt = (y) => Math.min(1, Math.max(0, (y - story.offsetTop) / storyRange()));
const scrollToP = (p, duration = 2.2) => lenis.scrollTo(story.offsetTop + p * storyRange(), { duration, easing: (x) => 1 - Math.pow(1 - x, 4) });

// ---------------- Navigatsiya ----------------
const nav = $('#nav');
const burger = $('#burger');
function setMenu(open) {
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
}
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
document.addEventListener('click', (e) => { if (nav.classList.contains('is-open') && !nav.contains(e.target)) setMenu(false); });
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id === '#top') { e.preventDefault(); lenis.scrollTo(0, { duration: 2.4 }); return; }
  const el = $(id);
  if (!el) return;
  e.preventDefault();
  setMenu(false);
  lenis.scrollTo(el, { offset: -60, duration: REDUCE ? 0.6 : 2.4, easing: (x) => 1 - Math.pow(1 - x, 4) });
}));
// Til almashinuvi: View Transitions bor brauzerda butun sahifa yumshoq almashadi
$$('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  const next = b.dataset.lang;
  if (next === getLang()) return;
  if (document.startViewTransition && !REDUCE) document.startViewTransition(() => setLang(next));
  else setLang(next);
}));

// Hozir ko'rinib turgan bo'lim menyuda belgilanadi
const navLinks = $$('#navLinks a');
const spy = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === `#${en.target.id}`;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((a) => { const el = $(a.getAttribute('href')); if (el) spy.observe(el); });
new IntersectionObserver(([en]) => {
  if (en.isIntersecting) navLinks.forEach((a) => { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
}, { rootMargin: '-45% 0px -50% 0px' }).observe($('#story'));

// ---------------- Katalog, Sotildi, Mijozlar ----------------
// sayt papkada joylashsa ham ishlashi uchun (masalan, GitHub Pages: /HM-group/)
const BASE = import.meta.env.BASE_URL;
const renderSrc = (id) => `${BASE}renders/${id}.webp`;
const specRow = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
const lang = () => getLang();

// Til almashganda qayta chiziladi: bo'lim allaqachon ochilgan bo'lsa, kartochkalar qayta "paydo bo'lmaydi"
const seen = (root) => (root.querySelector('.reveal.is-in') ? ' is-in' : '');

function cardHTML(car, inCls = '') {
  return `
  <article class="card reveal${inCls}" data-type="${car.type}">
    <div class="card__media">
      <span class="card__bg" aria-hidden="true">${car.outline}</span>
      <span class="card__tag">${car.year}</span>
      <img src="${renderSrc(car.id)}" alt="${car.brand} ${car.model}" loading="lazy" onerror="this.remove()">
    </div>
    <div class="card__body">
      <div class="card__title">
        <span class="card__brand">${car.brand}</span>
        <h3 class="card__model">${car.model}</h3>
      </div>
      <dl class="card__specs">
        ${specRow(t('spec.engine'), car.engine[lang()].split('·')[0].trim())}
        ${specRow(t('spec.power'), `${car.hp} <small>${t('spec.hp')}</small>`)}
        ${specRow(t('spec.mileage'), `${car.km} km`)}
      </dl>
      <div class="card__foot">
        <span class="card__price">${t('spec.price')}</span>
        <a class="btn btn--navy" href="${TG}" target="_blank" rel="noopener">${t('spec.cta')}</a>
      </div>
    </div>
  </article>`;
}

let filter = 'all';
function renderCatalog() {
  const inCls = seen($('#catalog'));
  $('#catalog').innerHTML = CARS.map((c) => cardHTML(c, inCls)).join('');
  applyFilter();
  observeReveal($('#catalog'));
}
function applyFilter() {
  $$('#catalog .card').forEach((c) => c.classList.toggle('is-hidden', filter !== 'all' && c.dataset.type !== filter));
  $$('#filters .chip').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.filter === filter);
    b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
  });
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b || b.dataset.filter === filter) return;
  filter = b.dataset.filter;
  applyFilter();
  // filtrdan keyin qolgan mashinalar navbat bilan joyiga tushadi
  $$('#catalog .card:not(.is-hidden)').forEach((c, i) => {
    c.classList.add('is-in');
    if (REDUCE) return;
    c.animate([{ opacity: 0, transform: 'translateY(18px) scale(.985)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, delay: Math.min(i, 6) * 55, easing: EASE_OUT, fill: 'backwards' });
  });
});

function renderSold() {
  const inCls = seen($('#sold'));
  $('#sold').innerHTML = SOLD.map((id) => {
    const c = byId(id);
    return `<div class="sold-card reveal${inCls}">
      <div class="sold-card__media"><img src="${renderSrc(id)}" alt="${c.brand} ${c.model}" loading="lazy" onerror="this.remove()"><span class="sold-card__stamp">${t('sold.badge')}</span></div>
      <div class="sold-card__body"><strong>${c.brand} ${c.model}</strong><span>${c.year}</span></div>
    </div>`;
  }).join('');
  observeReveal($('#sold'));
}

function renderClients() {
  const ids = ['staria', 'g63', 'ev9', 'escalade'];
  const inCls = seen($('#clients'));
  $('#clients').innerHTML = ids.map((id) => {
    const c = byId(id);
    return `<a class="clip reveal${inCls}" href="${IG}" target="_blank" rel="noopener">
      <span class="clip__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg></span>
      <img src="${renderSrc(id)}" alt="" loading="lazy" onerror="this.remove()">
      <strong>${c.brand} ${c.model}</strong>
      <span>${lang() === 'ru' ? 'Видео клиента' : 'Mijoz videosi'} · Instagram</span>
    </a>`;
  }).join('');
  observeReveal($('#clients'));
}

// ---------------- Reveal + raqamlar ----------------
// Bir vaqtda ekranga kirgan elementlar navbat bilan ochiladi (kechikish 5 qadam bilan cheklangan).
// Animatsiya tugagach kechikish olib tashlanadi — hover darhol javob beradi.
const io = new IntersectionObserver((entries) => {
  entries.filter((en) => en.isIntersecting).forEach((en, i) => {
    const el = en.target;
    const k = Math.min(i, 5);
    if (k) el.style.setProperty('--i', k);
    el.classList.add('is-in');
    io.unobserve(el);
    if (k) setTimeout(() => el.style.removeProperty('--i'), 1300 + k * 70);
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
function observeReveal(root = document) { $$('.reveal:not(.is-in)', root).forEach((el) => io.observe(el)); }

const countIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    countIO.unobserve(en.target);
    const el = en.target;
    const to = parseFloat(el.dataset.count);
    const dec = String(el.dataset.count).includes('.') ? 1 : 0;
    const start = performance.now();
    const fmt = (v) => `${el.dataset.prefix || ''}${v.toFixed(dec).replace('.', ',')}${el.dataset.suffix || ''}`;
    if (REDUCE) { el.textContent = fmt(to); return; }
    const step = (now) => {
      const k = Math.min(1, (now - start) / 1600);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => countIO.observe(el));

// ---------------- Logistika: yo'l chizig'i skroll bilan to'ladi ----------------
// Bir qatordagi qadamlar chapdan o'ngga navbat bilan to'ladi; telefonda (bitta ustun) — har biri o'z joyida.
const steps = $$('#steps .step');
const routeLine = $('#routebar .routebar__line');
let logActive = false;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
function updateLogistics() {
  if (!logActive) return;
  const vh = innerHeight;
  const rows = new Map();
  for (const st of steps) {
    const top = Math.round(st.getBoundingClientRect().top);
    if (!rows.has(top)) rows.set(top, []);
    rows.get(top).push(st);
  }
  for (const [top, row] of rows) {
    const p = clamp01((vh * 0.88 - top) / (vh * 0.4));
    row.forEach((st, j) => {
      const k = clamp01(p * row.length - j);
      st.style.setProperty('--k', k.toFixed(3));
      st.classList.toggle('is-on', k > 0.35);
    });
  }
  const rt = routeLine.closest('.routebar').getBoundingClientRect().top;
  routeLine.style.setProperty('--p', clamp01((vh * 0.95 - rt) / (vh * 0.45)).toFixed(3));
}
new IntersectionObserver(([en]) => { logActive = en.isIntersecting; updateLogistics(); }, { rootMargin: '10% 0px' }).observe($('#logistika'));

function renderAll() { renderCatalog(); renderSold(); renderClients(); }
renderAll();
observeReveal();
onLang(() => { renderAll(); updateShowcase(); updateHint(); });

// ---------------- 3D hikoya qatlamlari ----------------
const layers = {
  hero: $('[data-layer="hero"]'),
  showcase: $('[data-layer="showcase"]'),
  ch1: $('[data-layer="ch1"]'),
  ch2: $('[data-layer="ch2"]'),
  ch3: $('[data-layer="ch3"]'),
};
const WIN = {
  showcase: [0.075, 0.1, 0.24, 0.262],
  ch1: [0.29, 0.315, 0.475, 0.5],
  ch2: [0.57, 0.6, 0.755, 0.778],
  ch3: [0.81, 0.85, 2, 3],
};
const lastO = {};
function setLayer(name, o) {
  o = Math.round(o * 1000) / 1000;
  if (lastO[name] === o) return;
  lastO[name] = o;
  const el = layers[name];
  el.style.opacity = o;
  el.style.setProperty('--o', o);
  el.classList.toggle('is-on', o > 0.5);
}

const rail = $('#rail');
const railItems = $$('#rail li');
const railFill = $('#railFill');
const daysNum = $('#daysNum');
const DAYS = [40, 45]; // Koreyadan O'zbekistonga yetkazish muddati (kun)
let lastDays = '';

function updateLayers(p) {
  setLayer('hero', 1 - seg(p, 0.002, 0.016));
  for (const [k, [a, b, c, d]] of Object.entries(WIN)) setLayer(k, seg(p, a, b) * (1 - seg(p, c, d)));
  railFill.style.transform = `scaleY(${p})`;
  const idx = p < 0.27 ? 0 : p < 0.53 ? 1 : p < 0.79 ? 2 : 3;
  railItems.forEach((li, i) => li.classList.toggle('is-active', i <= idx));
  rail.classList.toggle('is-hidden', p < 0.01);
  const k = seg(p, 0.815, 0.9);
  const days = `${Math.round(DAYS[0] * k)}–${Math.round(DAYS[1] * k)}`;
  if (days !== lastDays) { lastDays = days; daysNum.textContent = days; }
}

// ---------------- Tanlangan mashina ma'lumotlari ----------------
let world = null;
let selected = GARAGE[GARAGE_START];
let shownIdx = -1;

// Mashina almashganda raqam va nom yo'nalish bo'yicha "aylanadi"
function roll(el, dir) {
  if (REDUCE || !el.animate) return;
  el.animate([{ opacity: 0, transform: `translateY(${dir * 40}%)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT });
}

function updateShowcase() {
  const c = selected;
  if (!c) return;
  $('#scBrand').textContent = c.brand;
  $('#scModel').textContent = c.model;
  $('#scSpecs').innerHTML = [
    specRow(t('spec.year'), c.year),
    specRow(t('spec.engine'), c.engine[lang()]),
    specRow(t('spec.power'), `${c.hp}<small>${t('spec.hp')}</small>`),
    specRow(t('spec.mileage'), t('spec.new')),
  ].join('');
  const idx = GARAGE.indexOf(c);
  $('#counterNum').textContent = String(idx + 1).padStart(2, '0');
  $('#counterName').textContent = `${c.brand} ${c.model}`;
  if (shownIdx >= 0 && idx !== shownIdx) {
    const dir = idx > shownIdx ? 1 : -1;
    roll($('#counterNum'), dir);
    roll($('#counterName'), dir);
    roll($('#scModel'), dir);
  }
  shownIdx = idx;
}
$('.counter__total').textContent = `/ ${String(GARAGE.length).padStart(2, '0')}`;
updateShowcase();

function updateHint() {
  const touch = matchMedia('(pointer: coarse)').matches;
  $('#hintText').textContent = t(touch ? 'hero.hintTouch' : 'hero.hint');
}
updateHint();

// hover tooltip
const tip = $('#cartip');
function updateTip() {
  if (!world) return;
  const i = world.hovered;
  const show = i >= 0 && world.p < 0.012 && !world.quality.mobile && !world.portrait;
  tip.classList.toggle('is-on', show);
  if (!show) return;
  const e = world.entities[i];
  const top = e.root.position.clone();
  top.y += e.size.y * 1.12 + 0.45;
  const s = world.project(top);
  tip.style.left = `${s.x}px`;
  tip.style.top = `${s.y}px`;
}
function fillTip(i) {
  if (i < 0) return;
  const c = world.entities[i].car;
  $('#tipBrand').textContent = c.brand;
  $('#tipModel').textContent = c.model;
  $('#tipMeta').textContent = `${c.year} · ${c.hp} ${t('spec.hp')} · ${t('hero.choose')} →`;
}

// ---------------- Header holati ----------------
function updateNav(y) {
  const pastStory = y > story.offsetTop + story.offsetHeight - 90;
  nav.classList.toggle('is-solid', pastStory);
}

lenis.on('scroll', ({ scroll }) => {
  const p = progressAt(scroll);
  if (world && DEBUG_P === null) world.targetP = p;
  updateNav(scroll);
  updateLogistics();
});
addEventListener('resize', () => {
  if (world && DEBUG_P === null) world.targetP = progressAt(lenis.scroll);
  updateLogistics();
});

// ---------------- Kirish animatsiyasi ----------------
// Sarlavha so'zlarga ajratiladi: har bir so'z o'z niqobi ichidan ko'tariladi.
// Til almashganda matn qayta yoziladi va oddiy (ajratilmagan) holda qoladi.
function splitWords(root) {
  let n = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.textContent = part;
          inner.style.setProperty('--d', 120 + n++ * 55);
          w.append(inner);
          frag.append(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
    });
  };
  walk(root);
}
if (!REDUCE) splitWords($('.hero__title'));

// Yuklovchidagi HM belgisi sarlavhadagi logotip joyiga uchib boradi (bir xil shakl — uzluksiz o'tish)
function handoffLogo(done) {
  const from = $('.loader__logo');
  const to = $('#navLogo');
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (REDUCE || !from.animate || !a.width || !b.width) { done(); return; }
  const s = b.width / a.width;
  const anim = from.animate([
    { transform: 'none', fill: '#ffffff' },
    { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${s})`, fill: getComputedStyle(to).color },
  ], { duration: 950, easing: EASE_OUT, fill: 'forwards' });
  anim.onfinish = done;
  anim.oncancel = done;
}

// ---------------- 3D ishga tushirish ----------------
const loader = $('#loader');
const loaderBar = $('#loaderBar');
const loaderPct = $('#loaderPct');
let shownPct = 0;
const setLoad = (k) => {
  const pct = Math.round(k * 100);
  if (pct < shownPct) return;
  shownPct = pct;
  loaderBar.style.transform = `scaleX(${k})`;
  loaderPct.textContent = `${pct}%`;
};

async function boot() {
  try {
    await document.fonts.load('600 100px Inter').catch(() => {});
    const manifest = await fetch(`${BASE}models/manifest.json`).then((r) => r.json());
    const quality = detectQuality();
    world = new World($('#webgl'), { cars: GARAGE, start: GARAGE_START, manifest, quality, onProgress: setLoad });
    await world.init();
    world.targetP = DEBUG_P !== null ? parseFloat(DEBUG_P) : progressAt(lenis.scroll || scrollY);
    world.p = world.targetP;
    if (import.meta.env.DEV) {
      Object.assign(window, { __world: world, __lenis: lenis, __setP: (p) => { world.targetP = world.p = p; } });
    }

    world.on('select', (i, car) => { selected = car; updateShowcase(); });
    world.on('hover', (i) => fillTip(i));
    world.on('choose', () => scrollToP(0.178, 2.6));
    world.on('frame', (p) => { updateLayers(p); updateTip(); });

    // mobil boshqaruv
    $('#prevCar').addEventListener('click', () => world.setFocus(world.focus - 1));
    $('#nextCar').addEventListener('click', () => world.setFocus(world.focus + 1));
    $('#chooseCar').addEventListener('click', () => { world.selectCar(world.focus); scrollToP(0.178, 2.6); });
    let sx = null;
    $('#webgl').addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    $('#webgl').addEventListener('touchend', (e) => {
      if (sx === null || world.p > 0.02) return;
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) world.setFocus(world.focus + (dx < 0 ? 1 : -1));
      sx = null;
    }, { passive: true });

    // hikoya ko'rinmaganda render to'xtaydi
    new IntersectionObserver(([en]) => world.setActive(en.isIntersecting), { threshold: 0 }).observe(story);
  } catch (err) {
    console.error(err);
    document.body.classList.add('no-webgl');
    setLayer('hero', 1);
  }
  setLoad(1);
  setTimeout(() => {
    loader.classList.add('is-done');
    document.body.classList.add('is-ready');
    handoffLogo(() => {
      document.body.classList.remove('is-loading');
      lenis.start();
    });
  }, 450);
}
boot();
