import Lenis from 'lenis';
import { CARS, SOLD, GARAGE, GARAGE_START, byId } from './data/cars.js';
import { STOCK, REELS, reelUrl } from './data/stock.js';
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

// ---------------- Katalog (sotuvdagi mashinalar), Obzorlar, Sotildi, Mijozlar ----------------
// sayt papkada joylashsa ham ishlashi uchun (masalan, GitHub Pages: /HM-group/)
const BASE = import.meta.env.BASE_URL;
const renderSrc = (id) => `${BASE}renders/${id}.webp`;
const photoSrc = (id, n) => `${BASE}cars/${id}/${n}.webp`;
const specRow = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
const lang = () => getLang();
const IG_ICON = '<svg class="ig-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.9"/></svg>';

// Til almashganda qayta chiziladi: bo'lim allaqachon ochilgan bo'lsa, kartochkalar qayta "paydo bo'lmaydi"
const seen = (root) => (root.querySelector('.reveal.is-in') ? ' is-in' : '');

function cardHTML(car, inCls = '') {
  const name = `${car.brand} ${car.model}`;
  const n = car.photos;
  const specs = [
    car.year && specRow(t('spec.year'), car.year),
    car.engine && specRow(t('spec.engine'), car.engine[lang()]),
    car.hp && specRow(t('spec.power'), `${car.hp} <small>${t('spec.hp')}</small>`),
    car.km === 0 ? specRow(t('spec.mileage'), t('spec.new')) : car.km && specRow(t('spec.mileage'), `${car.km} km`),
  ].filter(Boolean);
  const meta = [car.color?.[lang()], car.note?.[lang()]].filter(Boolean);
  return `
  <article class="card reveal${inCls}" data-type="${car.type}">
    <div class="card__media gallery">
      <div class="gallery__track">
        ${Array.from({ length: n }, (_, i) => `<img src="${photoSrc(car.id, i + 1)}" alt="${name} — ${i + 1}/${n}" loading="lazy" decoding="async" draggable="false">`).join('')}
      </div>
      ${car.year ? `<span class="card__tag">${car.year}</span>` : ''}
      <span class="gallery__count"><b>1</b> / ${n}</span>
      <button type="button" class="gallery__btn gallery__btn--prev" data-dir="-1" aria-label="${t('gallery.prev')}" disabled>‹</button>
      <button type="button" class="gallery__btn gallery__btn--next" data-dir="1" aria-label="${t('gallery.next')}">›</button>
      <div class="gallery__dots" aria-hidden="true">${'<i></i>'.repeat(n)}</div>
    </div>
    <div class="card__body">
      <div class="card__title">
        <span class="card__brand">${car.brand}</span>
        <h3 class="card__model">${car.model}</h3>
        ${car.trim ? `<span class="card__trim">${car.trim}</span>` : ''}
      </div>
      ${specs.length ? `<dl class="card__specs">${specs.join('')}</dl>` : `<p class="card__ask">${t('spec.ask')}</p>`}
      ${meta.length ? `<ul class="card__meta">${meta.map((m) => `<li>${m}</li>`).join('')}</ul>` : ''}
      <div class="card__foot">
        <span class="card__price">${t('spec.price')}</span>
        <div class="card__btns">
          <a class="btn btn--navy-ghost" href="${car.ig}" target="_blank" rel="noopener">${IG_ICON}Instagram</a>
          <a class="btn btn--navy" href="${TG}" target="_blank" rel="noopener">${t('spec.cta')}</a>
        </div>
      </div>
    </div>
  </article>`;
}

let filter = 'all';
function renderCatalog() {
  const inCls = seen($('#catalog'));
  $('#catalog').innerHTML = STOCK.map((c) => cardHTML(c, inCls)).join('');
  $$('#catalog .gallery').forEach(syncGallery);
  applyFilter();
  observeReveal($('#catalog'));
}

// Kartochkadagi rasmlar: barmoq bilan surish (scroll-snap), strelkalar, nuqtalar
function syncGallery(g) {
  const track = $('.gallery__track', g);
  const count = track.children.length;
  const i = Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
  if (g._i === i) return;
  g._i = i;
  $$('.gallery__dots i', g).forEach((d, k) => d.classList.toggle('is-on', k === i));
  $('.gallery__count b', g).textContent = String(i + 1);
  $('.gallery__btn--prev', g).disabled = i === 0;
  $('.gallery__btn--next', g).disabled = i === count - 1;
}
$('#catalog').addEventListener('click', (e) => {
  const b = e.target.closest('.gallery__btn');
  if (!b) return;
  const track = $('.gallery__track', b.parentElement);
  track.scrollBy({ left: track.clientWidth * Number(b.dataset.dir), behavior: 'smooth' });
});
// scroll hodisasi ko'tarilmaydi (bubble) — capture bilan ushlanadi
$('#catalog').addEventListener('scroll', (e) => {
  const g = e.target.closest?.('.gallery');
  if (g) syncGallery(g);
}, { capture: true, passive: true });

// Obzor videolari (public/reels, npm run reels): kartochkalarda hamma videolar ovozsiz o'ynab turadi
// (12 soniyalik parcha), bosilsa — katta oynada to'liq video ovozi bilan. Kartochkalar bir marta yaratiladi
// (til almashganda faqat matn yangilanadi — videolar qayta yuklanmaydi).
const reelSrc = (id, suffix) => `${BASE}reels/${id}${suffix}`;
const SOUND_ICON = '<svg class="ig-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const MUTED_ICON = '<svg class="ig-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
const player = $('#player');
const playerVideo = $('.player__video', player);
let playerIndex = 0;

// Ekranda ko'rinib turgan har bir video o'ynaydi (bir piksel ko'rinsa ham), ko'rinmaydigani to'xtaydi — trafik tejaladi.
// Telefonda «trafik tejash» yoqilgan bo'lsa — faqat muqova.
const PREVIEW_AUTOPLAY = !navigator.connection?.saveData;
const previewIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => { en.target._inView = en.isIntersecting; syncPreview(en.target); });
}, { rootMargin: '120px 0px' });
function syncPreview(v) {
  if (v._inView && !player.open) v.play().catch(() => {});
  else v.pause();
}

function renderReels() {
  $('#reels').innerHTML = REELS.map((r, i) => `
    <article class="reel reveal">
      <video class="reel__video" src="${reelSrc(r.id, '-preview.mp4')}" poster="${reelSrc(r.id, '.webp')}" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true"></video>
      <span class="reel__muted" aria-hidden="true">${MUTED_ICON}</span>
      <div class="reel__cap">
        <strong class="reel__title"></strong>
        <span class="reel__go">${SOUND_ICON}<span class="reel__watch"></span></span>
      </div>
      <button type="button" class="reel__link" data-reel="${i}"></button>
    </article>`).join('');
  updateReels();
  observeReveal($('#reels'));
  $$('#reels .reel__video').forEach((v) => {
    v.muted = true; // avtomatik o'ynash faqat ovozsiz videoga ruxsat etiladi
    if (PREVIEW_AUTOPLAY) previewIO.observe(v);
  });
}
function updateReels() {
  $$('#reels .reel').forEach((el, i) => {
    const title = REELS[i].title[lang()];
    $('.reel__title', el).textContent = title;
    $('.reel__watch', el).textContent = t('reels.watch');
    $('.reel__link', el).setAttribute('aria-label', `${title} — ${t('reels.watch')}`);
  });
}
$('#reels').addEventListener('click', (e) => {
  const b = e.target.closest('[data-reel]');
  if (b) openPlayer(Number(b.dataset.reel));
});

// play() bosish ichida chaqiriladi — brauzer ovozli videoni shundagina o'ynatadi
function openPlayer(i) {
  playerIndex = (i + REELS.length) % REELS.length;
  const r = REELS[playerIndex];
  playerVideo.poster = reelSrc(r.id, '.webp');
  playerVideo.src = reelSrc(r.id, '.mp4');
  updatePlayer();
  if (!player.open) {
    player.showModal();
    document.documentElement.classList.add('has-player');
    $$('#reels .reel__video').forEach(syncPreview);
  }
  playerVideo.play().catch(() => {});
}
function updatePlayer() {
  const r = REELS[playerIndex];
  const title = r.title[lang()];
  $('.player__title', player).textContent = title;
  player.setAttribute('aria-label', title);
  const ig = $('.player__ig', player);
  ig.href = reelUrl(r.id);
  ig.innerHTML = `${IG_ICON}<span>${t('reels.open')}</span> ↗`;
  $('[data-close]', player).setAttribute('aria-label', t('reels.close'));
  $('.player__nav--prev', player).setAttribute('aria-label', t('reels.prev'));
  $('.player__nav--next', player).setAttribute('aria-label', t('reels.next'));
}
player.addEventListener('click', (e) => {
  // oynaning bo'sh joyi (video atrofi) yoki × — yopiladi
  if (e.target === player || e.target.closest('[data-close]')) { player.close(); return; }
  const nav = e.target.closest('[data-dir]');
  if (nav) openPlayer(playerIndex + Number(nav.dataset.dir));
});
player.addEventListener('keydown', (e) => {
  // video tanlangan bo'lsa, strelkalar videoni oldinga/orqaga suradi (brauzerning o'zi)
  if (e.target === playerVideo || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  e.preventDefault();
  openPlayer(playerIndex + (e.key === 'ArrowRight' ? 1 : -1));
});
player.addEventListener('close', () => {
  playerVideo.pause();
  playerVideo.removeAttribute('src');
  playerVideo.load(); // yuklashni to'xtatadi
  document.documentElement.classList.remove('has-player');
  $$('#reels .reel__video').forEach(syncPreview);
});
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
renderReels();
observeReveal();
onLang(() => { renderAll(); updateReels(); updateShowcase(); updateHint(); });

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
let lastP = -1;

function updateLayers(p) {
  if (p === lastP) return; // skroll to'xtaganda DOM har kadrda qayta yozilmaydi
  lastP = p;
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
    // shrift (canvas yozuvlari uchun) va modellar ro'yxati bir vaqtda; shrift sekin kelsa — uzoq kutilmaydi
    const font = document.fonts.load('600 100px Inter').catch(() => {});
    const [manifest] = await Promise.all([
      fetch(`${BASE}models/manifest.json`, { cache: 'no-cache' }).then((r) => r.json()),
      Promise.race([font, new Promise((r) => setTimeout(r, 2500))]),
    ]);
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
