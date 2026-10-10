// HM Group — avtomobillar ro'yxati.
// DIQQAT: bu NAMUNA ma'lumotlar. Haqiqiy sotuvdagi mashinalar, yil, probeg va
// komplektatsiyani shu yerda o'zgartiring. Narx ko'rsatilmaydi — "so'rov bo'yicha".
//
// paint      — garajdagi 3D model rangi (src/three/materials.js → PAINTS)
// paintRe    — modeldagi kuzov materiali nomi (regex)
// file       — ixtiyoriy: 3D model fayli (public/models/<file>.glb), bo'lmasa id; bir model turli rangda ishlatilishi mumkin
// type       — katalog filtri: suv | sedan | van | ev
// wheels     — ixtiyoriy: { r } g'ildirak radiusi (metr; odatda shinadan avtomatik o'lchanadi) — src/three/wheels.js
// creaseNormals — ixtiyoriy: kuzov normallarini qayta hisoblash (gradus) — siqishda yuzasi "g'ijimlangan" modellar uchun
// hideRe     — ixtiyoriy: shu materialdagi qismlar yashiriladi (regex)

export const CARS = [
  {
    id: 'staria', brand: 'Hyundai', model: 'Staria Hybrid', outline: 'STARIA',
    year: 2025, hp: 245, seats: 7, km: 0, type: 'van',
    engine: { uz: '1.6 T-GDi Gibrid', ru: '1.6 T-GDi Гибрид' },
    color: { uz: 'Qora', ru: 'Чёрный' },
    note: { uz: 'Lounge komplektatsiya, panorama tom', ru: 'Комплектация Lounge, панорамная крыша' },
    // modeldagi material nomlari aralashgan: kuzov — "CalipersPart"
    paint: 'obsidian', paintRe: /Premium_CalipersPart$/,
  },
  {
    id: 'ev9', brand: 'Kia', model: 'EV9 GT-Line', outline: 'EV9',
    year: 2024, hp: 385, seats: 6, km: 0, type: 'ev',
    engine: { uz: 'Elektr · 99.8 kVt·soat · AWD', ru: 'Электро · 99.8 кВт·ч · AWD' },
    color: { uz: 'To\'q ko\'k metallik', ru: 'Тёмно-синий металлик' },
    note: { uz: '6 o\'rindiq, aylanuvchi kreslolar', ru: '6 мест, поворотные кресла' },
    paint: 'navy', paintRe: /^CarPaint$/,
    // orqa oynadagi isitish simlari siqishda qalin to'q sariq chiziqlarga aylangan
    creaseNormals: 60, hideRe: /^OragneCh$/,
  },
  {
    id: 'g63', brand: 'Mercedes-AMG', model: 'G 63', outline: 'G 63',
    year: 2024, hp: 585, seats: 5, km: 0, type: 'suv',
    engine: { uz: '4.0 V8 Biturbo', ru: '4.0 V8 Biturbo' },
    color: { uz: 'Obsidian qora', ru: 'Чёрный обсидиан' },
    note: { uz: 'Night paket, AMG Driver\'s package', ru: 'Night пакет, AMG Driver\'s package' },
    paint: 'obsidian', paintRe: /Paint_Material1$/,
  },
  {
    id: 'g63w', file: 'g63', brand: 'Mercedes-AMG', model: 'G 63', outline: 'G 63',
    year: 2024, hp: 585, seats: 5, km: 0, type: 'suv',
    engine: { uz: '4.0 V8 Biturbo', ru: '4.0 V8 Biturbo' },
    color: { uz: 'Oq', ru: 'Белый' },
    note: { uz: 'AMG Line, 22" disklar', ru: 'AMG Line, 22" диски' },
    paint: 'pearl', paintRe: /Paint_Material1$/,
  },
  {
    id: 'maybach', brand: 'Mercedes-Maybach', model: 'S 580', outline: 'MAYBACH',
    year: 2023, hp: 503, seats: 4, km: 0, type: 'sedan',
    engine: { uz: '4.0 V8 Biturbo · EQ Boost', ru: '4.0 V8 Biturbo · EQ Boost' },
    color: { uz: 'Kumush / to\'q ko\'k', ru: 'Серебро / тёмно-синий' },
    note: { uz: 'Pnevmo-podveska, Executive orqa o\'rindiqlar', ru: 'Пневмоподвеска, задние кресла Executive' },
    paint: 'silver', paintRe: /Car_Paint_With_Flakes/,
  },
  {
    id: 'urus', brand: 'Lamborghini', model: 'Urus SE', outline: 'URUS',
    year: 2025, hp: 800, seats: 5, km: 0, type: 'suv',
    engine: { uz: '4.0 V8 Plug-in gibrid', ru: '4.0 V8 Plug-in гибрид' },
    color: { uz: 'Muz ko\'k', ru: 'Ледяной синий' },
    note: { uz: '0–100 km/soat: 3.4 s', ru: '0–100 км/ч: 3.4 с' },
    paint: 'ice', paintRe: /Paint_Material1$/,
  },
  {
    id: 'rrsport', brand: 'Land Rover', model: 'Range Rover Sport', outline: 'RANGE',
    year: 2023, hp: 400, seats: 5, km: 0, type: 'suv',
    engine: { uz: '3.0 I6 Mild-hybrid', ru: '3.0 I6 Mild-hybrid' },
    color: { uz: 'Grafit', ru: 'Графит' },
    note: { uz: 'Dynamic SE, pnevmo-podveska', ru: 'Dynamic SE, пневмоподвеска' },
    paint: 'graphite', paintRe: /Firenze_Red|RedMain/,
  },
  {
    id: 'ghost', brand: 'Rolls-Royce', model: 'Ghost', outline: 'GHOST',
    year: 2023, hp: 571, seats: 5, km: 0, type: 'sedan',
    engine: { uz: '6.75 V12 Biturbo', ru: '6.75 V12 Biturbo' },
    color: { uz: 'Tungi safir', ru: 'Ночной сапфир' },
    note: { uz: 'Starlight osmon', ru: 'Звёздное небо Starlight' },
    paint: 'navy', paintRe: /rrghost_paint$/, paint2: 'silver', paint2Re: /rrghost_paint_b/,
  },
  {
    id: 'escalade', brand: 'Cadillac', model: 'Escalade', outline: 'ESCALADE',
    year: 2023, hp: 420, seats: 7, km: 0, type: 'suv',
    engine: { uz: '6.2 V8', ru: '6.2 V8' },
    color: { uz: 'Qora', ru: 'Чёрный' },
    note: { uz: 'Premium Luxury, 7 o\'rindiq', ru: 'Premium Luxury, 7 мест' },
    paint: 'obsidian', paintRe: /EPaint_Body/,
  },
  {
    id: 'x6', brand: 'BMW', model: 'X6 xDrive40i', outline: 'X6',
    year: 2022, hp: 340, seats: 5, km: 0, type: 'suv',
    engine: { uz: '3.0 I6 Turbo', ru: '3.0 I6 Turbo' },
    color: { uz: 'Oq', ru: 'Белый' },
    note: { uz: 'M Sport paket', ru: 'Пакет M Sport' },
    paint: 'pearl', paintRe: /^CarPaint$/,
  },
  {
    id: 'sportage', brand: 'Kia', model: 'Sportage Hybrid', outline: 'SPORTAGE',
    year: 2024, hp: 230, seats: 5, km: 0, type: 'suv',
    engine: { uz: '1.6 T-GDi Gibrid', ru: '1.6 T-GDi Гибрид' },
    color: { uz: 'Kumush', ru: 'Серебристый' },
    note: { uz: 'Signature komplektatsiya', ru: 'Комплектация Signature' },
    paint: 'silver', paintRe: /Wolf_Gray/,
  },
];

// "Sotildi" bo'limi — namunaviy. Haqiqiy sotilgan mashinalar bilan almashtiring.
export const SOLD = ['ghost', 'g63', 'escalade', 'staria', 'x6', 'maybach'];

export const byId = (id) => CARS.find((c) => c.id === id);

// Garajdagi tartib — chapdan o'ngga (src/three/garage.js → G.slots bilan bir xil sonda).
// Markazdagilari birinchi yuklanadi, chetdagilari sayt ochilgandan keyin qo'shiladi.
export const GARAGE = [
  'ev9', 'sportage', 'escalade', 'maybach', 'g63w', 'g63',
  'urus', 'staria', 'ghost', 'rrsport', 'x6',
].map(byId);
// sayt ochilganda tanlangan mashina
export const GARAGE_START = GARAGE.findIndex((c) => c.id === 'g63');
