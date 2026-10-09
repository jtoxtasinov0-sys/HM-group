import Lenis from 'lenis';
import { CARS, SOLD, GARAGE, byId } from './data/cars.js';
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

// ---------------- Lenis (silliq skroll) ----------------
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true });
lenis.stop();
requestAnimationFrame(function raf(time) { lenis.raf(time); requestAnimationFrame(raf); });

const story = $('#story');
const storyRange = () => Math.max(1, story.offsetHeight - innerHeight);
const progressAt = (y) => Math.min(1, Math.max(0, (y - story.offsetTop) / storyRange()));
const scrollToP = (p, duration = 2.2) => lenis.scrollTo(story.offsetTop + p * storyRange(), { duration, easing: (x) => 1 - Math.pow(1 - x, 4) });

// ---------------- Navigatsiya ----------------
const nav = $('#nav');
$('#burger').addEventListener('click', () => nav.classList.toggle('is-open'));
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id === '#top') { e.preventDefault(); lenis.scrollTo(0, { duration: 2.4 }); return; }
  const el = $(id);
  if (!el) return;
  e.preventDefault();
  nav.classList.remove('is-open');
  lenis.scrollTo(el, { offset: -60, duration: 2.4, easing: (x) => 1 - Math.pow(1 - x, 4) });
}));
$$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

// ---------------- Katalog, Sotildi, Mijozlar ----------------
// sayt papkada joylashsa ham ishlashi uchun (masalan, GitHub Pages: /HM-group/)
const BASE = import.meta.env.BASE_URL;
const renderSrc = (id) => `${BASE}renders/${id}.webp`;
const specRow = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
const lang = () => getLang();

function cardHTML(car) {
  return `
  <article class="card reveal" data-type="${car.type}">
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
  $('#catalog').innerHTML = CARS.map(cardHTML).join('');
  applyFilter();
  observeReveal($('#catalog'));
}
function applyFilter() {
  $$('#catalog .card').forEach((c) => c.classList.toggle('is-hidden', filter !== 'all' && c.dataset.type !== filter));
  $$('#filters .chip').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === filter));
}
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  applyFilter();
  $$('#catalog .card:not(.is-hidden)').forEach((c) => c.classList.add('is-in'));
});

function renderSold() {
  $('#sold').innerHTML = SOLD.map((id) => {
    const c = byId(id);
    return `<div class="sold-card">
      <div class="sold-card__media"><img src="${renderSrc(id)}" alt="${c.brand} ${c.model}" loading="lazy" onerror="this.remove()"><span class="sold-card__stamp">${t('sold.badge')}</span></div>
      <div class="sold-card__body"><strong>${c.brand} ${c.model}</strong><span>${c.year}</span></div>
    </div>`;
  }).join('');
}

function renderClients() {
  const ids = ['staria', 'g63', 'ev9', 'escalade'];
  $('#clients').innerHTML = ids.map((id) => {
    const c = byId(id);
    return `<a class="clip reveal" href="${IG}" target="_blank" rel="noopener">
      <span class="clip__play" aria-hidden="true"></span>
      <img src="${renderSrc(id)}" alt="" loading="lazy" onerror="this.remove()">
      <strong>${c.brand} ${c.model}</strong>
      <span>${lang() === 'ru' ? 'Видео клиента' : 'Mijoz videosi'} · Instagram</span>
    </a>`;
  }).join('');
  observeReveal($('#clients'));
}

// ---------------- Reveal + raqamlar ----------------
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    io.unobserve(en.target);
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
    const step = (now) => {
      const k = Math.min(1, (now - start) / 1600);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => countIO.observe(el));

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
let lastDays = -1;

function updateLayers(p) {
  setLayer('hero', 1 - seg(p, 0.002, 0.016));
  for (const [k, [a, b, c, d]] of Object.entries(WIN)) setLayer(k, seg(p, a, b) * (1 - seg(p, c, d)));
  railFill.style.transform = `scaleY(${p})`;
  const idx = p < 0.27 ? 0 : p < 0.53 ? 1 : p < 0.79 ? 2 : 3;
  railItems.forEach((li, i) => li.classList.toggle('is-active', i <= idx));
  rail.classList.toggle('is-hidden', p < 0.01);
  const days = Math.round(25 * seg(p, 0.815, 0.9));
  if (days !== lastDays) { lastDays = days; daysNum.textContent = String(days); }
}

// ---------------- Tanlangan mashina ma'lumotlari ----------------
let world = null;
let selected = GARAGE[2];

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
});
addEventListener('resize', () => { if (world && DEBUG_P === null) world.targetP = progressAt(lenis.scroll); });

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
    await document.fonts.load('200 100px Montserrat').catch(() => {});
    const manifest = await fetch(`${BASE}models/manifest.json`).then((r) => r.json());
    const quality = detectQuality();
    world = new World($('#webgl'), { cars: CARS, manifest, quality, onProgress: setLoad });
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
    document.body.classList.remove('is-loading');
    lenis.start();
  }, 450);
}
boot();
