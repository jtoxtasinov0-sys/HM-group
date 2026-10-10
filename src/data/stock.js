// HM Group — sotuvdagi haqiqiy mashinalar (Instagram @hmgroup.uz postlaridan, HM_Group_mashinalar/ papkasi).
// Rasmlar: HM_Group_mashinalar/<dir>/*.jpg  →  npm run photos  →  public/cars/<id>/1.webp, 2.webp, ...
// Ma'lumoti yo'q maydonni yozmang — kartochkada shu qator chiqmaydi.
//
// type    — katalog filtri: suv | sedan | sport
// trim    — komplektatsiya (ixtiyoriy)
// engine  — hajm va yoqilg'i, hp — ot kuchi, km — probeg
// ig      — Instagram post (kartochkadagi «Instagram» tugmasi)

const PETROL = (l) => ({ uz: `${l} L · benzin`, ru: `${l} л · бензин` });

export const STOCK = [
  {
    id: 'porsche-911-turbo-s', dir: '01_Porsche_911_Turbo_S_Green', photos: 4,
    brand: 'Porsche', model: '911 Turbo S', type: 'sport',
    year: '2026.07',
    color: { uz: 'Oak Green Metallic Neo · salon qora', ru: 'Oak Green Metallic Neo · салон чёрный' },
    ig: 'https://www.instagram.com/p/Dd73bx-k9gf/',
  },
  {
    id: 'porsche-911-carrera-4-gts', dir: '02_Porsche_911_Carrera_4_GTS', photos: 4,
    brand: 'Porsche', model: '911 Carrera 4 GTS', type: 'sport',
    ig: 'https://www.instagram.com/p/DctMLnXiWvH/',
  },
  {
    id: 'range-rover-p530-lwb', dir: '03_Range_Rover_P530_LWB', photos: 4,
    brand: 'Land Rover', model: 'Range Rover P530 LWB', trim: 'Autobiography', type: 'suv',
    year: '2026', engine: PETROL('4.4'), hp: 530, km: 0,
    color: { uz: 'Belgravia Green', ru: 'Belgravia Green' },
    ig: 'https://www.instagram.com/p/Db8j5XZCZ40/',
  },
  {
    id: 'range-rover-sport-p400', dir: '04_Range_Rover_P400_Sport', photos: 4,
    brand: 'Land Rover', model: 'Range Rover Sport P400', trim: 'Autobiography', type: 'suv',
    km: 0,
    ig: 'https://www.instagram.com/p/DbVeG8wCUWa/',
  },
  {
    id: 'mercedes-e300-amg', dir: '05_Mercedes_E300_AMG', photos: 4,
    brand: 'Mercedes-Benz', model: 'E 300 AMG', type: 'sedan',
    year: '2026', engine: PETROL('2.0'), hp: 285, km: 0,
    note: { uz: 'To\'liq privod', ru: 'Полный привод' },
    ig: 'https://www.instagram.com/p/DaknlXcCStf/',
  },
  {
    id: 'porsche-911-gt3', dir: '06_Porsche_911_GT3', photos: 4,
    brand: 'Porsche', model: '911 GT3', type: 'sport',
    engine: { uz: '4.0 L', ru: '4.0 л' }, hp: 510,
    ig: 'https://www.instagram.com/p/DaZo0saCUsh/',
  },
  {
    id: 'bmw-530i-xdrive', dir: '07_BMW_530i_xDrive', photos: 4,
    brand: 'BMW', model: '530i xDrive', type: 'sedan',
    year: '2026', km: 0,
    color: { uz: 'Carbon Black · salon jigarrang', ru: 'Carbon Black · салон коричневый' },
    note: { uz: 'Buyurtma uchun mavjud', ru: 'Доступен под заказ' },
    ig: 'https://www.instagram.com/p/DZ6yBreCa6p/',
  },
  {
    id: 'mercedes-g63-amg', dir: '08_Mercedes_G63_AMG', photos: 4,
    brand: 'Mercedes-Benz', model: 'G 63 AMG', type: 'suv',
    year: '2026', km: 0,
    color: { uz: 'Oq · salon qizil', ru: 'Белый · салон красный' },
    ig: 'https://www.instagram.com/p/DZ4ptcPCdX-/',
  },
  {
    id: 'cadillac-escalade', dir: '09_Cadillac_Escalade', photos: 4,
    brand: 'Cadillac', model: 'Escalade', trim: 'Sport Platinum', type: 'suv',
    year: '2026', engine: PETROL('6.2'), km: 0,
    ig: 'https://www.instagram.com/p/DZrE-6WCbu_/',
  },
  {
    id: 'mercedes-maybach-s580', dir: '10_Mercedes_Maybach_S580', photos: 4,
    brand: 'Mercedes-Maybach', model: 'S 580', type: 'sedan',
    year: '2026', engine: PETROL('4.0'), km: 0,
    ig: 'https://www.instagram.com/p/DV5kD4lE5Fz/',
  },
];

// Obzor videolari (Instagram Reels) — «Obzorlar» bo'limi
export const REELS = [
  { id: 'DTNWGIZko-m', title: { uz: 'BMW 740i va Mercedes G63 — miniobzor', ru: 'BMW 740i и Mercedes G63 — мини-обзор' } },
  { id: 'DYi_R_rplIA', title: { uz: 'Mercedes-Benz GLS 450 full option', ru: 'Mercedes-Benz GLS 450 full option' } },
  { id: 'DYMBIUsJLRT', title: { uz: 'Mercedes-Benz G63', ru: 'Mercedes-Benz G63' } },
  { id: 'DX63AbFJ_U3', title: { uz: 'Mercedes-Benz E300 AMG (140 yillik)', ru: 'Mercedes-Benz E300 AMG (140 лет)' } },
  { id: 'DWYvFwZCSps', title: { uz: 'Mercedes-AMG GT 63 S Performance', ru: 'Mercedes-AMG GT 63 S Performance' } },
  { id: 'DUpvHsvjAGi', title: { uz: 'Mercedes-AMG GT 63 E Performance', ru: 'Mercedes-AMG GT 63 E Performance' } },
  { id: 'Dd_o381p09S', title: { uz: 'Mercedes-Benz S450L AMG', ru: 'Mercedes-Benz S450L AMG' } },
  { id: 'Dd81cNzzegW', title: { uz: 'Porsche 911 Turbo S', ru: 'Porsche 911 Turbo S' } },
];
export const reelUrl = (id) => `https://www.instagram.com/reel/${id}/`;
