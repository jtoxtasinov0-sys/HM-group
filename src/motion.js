// Sahifa bo'ylab harakatlar (3D hikoyadan tashqari):
//  - yuqorida sahifa progress chizig'i;
//  - hikoya oxirida brendlar lentasi 3D sahna ustiga "parda" bo'lib ko'tariladi, sahna esa kichrayib orqaga ketadi;
//  - lenta skroll tezligi va yo'nalishi bilan tezlashadi / qiyshayadi;
//  - "Biz haqimizda" sarlavhasi skroll bilan so'zma-so'z yonadi;
//  - kompyuterda kartochkalar sichqonchaga qarab egiladi (ustida yorug'lik);
//  - footer'dagi katta HM GROUP belgisi sahifa oxirida pastdan ko'tariladi.
// Faqat transform / opacity (GPU) — telefonda ham silliq. prefers-reduced-motion'da harakat o'chadi.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Element ekranga yaqinmi (on); yaqinlashganda onEnter — skroll hodisasini kutmasdan holatni yangilash uchun */
const near = (el, margin = '15% 0px', onEnter = null) => {
  const state = { on: false };
  new IntersectionObserver(([en]) => {
    state.on = en.isIntersecting;
    if (state.on) onEnter?.();
  }, { rootMargin: margin }).observe(el);
  return state;
};

export function initMotion({ lenis, reduce }) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const progress = $('#progress');
  const marquee = createMarquee($('#marquee'), lenis, reduce);
  const curtain = createCurtain($('#story'), $('.curtain'), reduce);
  const kinetic = createKinetic($('#aboutTitle'), reduce);
  const mark = createRise($('#footerMark'), reduce);
  if (fine && !reduce) ['#catalog', '#clients'].forEach((s) => tilt($(s)));

  let lastP = -1;
  const update = () => {
    const p = Math.round(clamp01(lenis.progress || 0) * 1000) / 1000;
    if (p !== lastP) { lastP = p; progress.style.transform = `scaleX(${p})`; }
    curtain.update();
    kinetic.update();
    mark.update();
  };
  lenis.on('scroll', update);
  addEventListener('resize', () => { marquee.measure(); update(); });
  update();
  kinetic.update(true); // so'zlar boshidan xira turadi

  return {
    /** til almashganda: sarlavha qayta so'zlarga ajratiladi */
    refresh() { kinetic.split(); kinetic.update(true); },
  };
}

/** Cheksiz brendlar lentasi: tezligi skroll tezligiga qo'shiladi, yo'nalishi skroll yo'nalishiga ergashadi */
function createMarquee(root, lenis, reduce) {
  const track = $('.marquee__track', root);
  // uzluksiz aylanish uchun mazmun ikki marta (yarmi ekrandan keng bo'lishi kerak)
  track.append(...[...track.children].map((n) => n.cloneNode(true)));
  let half = 0;
  const measure = () => { half = track.scrollWidth / 2; };
  measure();
  document.fonts?.ready.then(measure);
  if (reduce) return { measure };

  const seen = near(root, '10% 0px');
  const base = innerWidth < 760 ? 38 : 64; // px/s
  let x = 0, dir = -1, vel = 0, skew = 0, last = 0, running = false;
  const frame = (now) => {
    if (!seen.on) { running = false; return; }
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const v = lenis.velocity || 0; // px / kadr
    if (Math.abs(v) > 0.5) dir = v > 0 ? -1 : 1;
    vel += (Math.min(60, Math.abs(v)) - vel) * (1 - Math.exp(-dt * 6));
    skew += (Math.max(-7, Math.min(7, -v * 0.35)) - skew) * (1 - Math.exp(-dt * 8));
    x += dir * (base + vel * 22) * dt;
    if (half) x = ((x % half) - half) % half; // [-half, 0)
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !running) { running = true; last = 0; requestAnimationFrame(frame); }
  }, { rootMargin: '10% 0px' }).observe(root);
  return { measure };
}

/** "Parda": lenta va undan keyingi bo'lim 3D sahna ustiga chiqadi, sahna kichrayib, qorayib orqaga ketadi */
function createCurtain(story, curtain, reduce) {
  const sticky = $('.story__sticky', story);
  let last = -1;
  return {
    update() {
      // har skrollda bitta o'lchov (IntersectionObserver kechikadi — tez sakrashda parda "qotib" qolmasin)
      const top = curtain.getBoundingClientRect().top;
      const q = Math.round(clamp01(1 - top / innerHeight) * 1000) / 1000;
      if (q === last) return;
      last = q;
      sticky.style.setProperty('--q', reduce ? 0 : q);
      sticky.classList.toggle('is-covered', q > 0);
    },
  };
}

/** Sarlavha so'zlarga ajratiladi; skroll bilan so'zlar chapdan o'ngga navbat bilan yonadi */
function createKinetic(el, reduce) {
  let words = [];
  const seen = near(el, '20% 0px', () => api.update());
  const split = () => {
    if (reduce) return;
    const walk = (node) => [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span');
          w.className = 'k';
          w.textContent = part;
          frag.append(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
    });
    walk(el);
    words = $$('.k', el);
    words.forEach((w) => { w._o = -1; });
  };
  split();
  const api = {
    split,
    update(force = false) {
      if (!words.length || (!seen.on && !force)) return;
      const r = el.getBoundingClientRect();
      // sarlavha ekranning pastki qismidan yuqori uchdan biriga chiqquncha to'liq yonadi
      const p = clamp01((innerHeight * 0.92 - r.top) / (innerHeight * 0.55));
      const n = words.length;
      words.forEach((w, i) => {
        const o = Math.round((0.16 + 0.84 * clamp01(p * (n + 2) - i)) * 100) / 100;
        if (o !== w._o) { w._o = o; w.style.opacity = o; }
      });
    },
  };
  return api;
}

/** Footer belgisi: sahifa oxiriga yaqinlashganda pastdan ko'tariladi (HM, keyin GROUP) */
function createRise(el, reduce) {
  const seen = near(el, '10% 0px', () => api.update());
  let last = -1;
  const api = {
    update() {
      if (reduce || !seen.on) return;
      const r = el.getBoundingClientRect();
      const q = Math.round(clamp01((innerHeight - r.top) / (r.height * 1.1)) * 1000) / 1000;
      if (q === last) return;
      last = q;
      el.style.setProperty('--r', q);
    },
  };
  return api;
}

/** Kartochka sichqonchaga qarab biroz egiladi, ustida yorug'lik dog'i yuradi (faqat kompyuterda) */
function tilt(root) {
  if (!root) return;
  let card = null, raf = 0, ev = null;
  const apply = () => {
    raf = 0;
    if (!card || !ev) return;
    const r = card.getBoundingClientRect();
    const u = clamp01((ev.clientX - r.left) / r.width), v = clamp01((ev.clientY - r.top) / r.height);
    card.style.setProperty('--ry', `${((u - 0.5) * 7).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((0.5 - v) * 6).toFixed(2)}deg`);
    card.style.setProperty('--gx', `${(u * 100).toFixed(1)}%`);
    card.style.setProperty('--gy', `${(v * 100).toFixed(1)}%`);
  };
  const leave = () => { if (card) card.classList.remove('is-tilt'); card = null; };
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const c = e.target.closest('.card, .clip');
    if (c !== card) { leave(); card = c; if (c) c.classList.add('is-tilt'); }
    ev = e;
    if (card && !raf) raf = requestAnimationFrame(apply);
  });
  root.addEventListener('pointerleave', leave);
}
