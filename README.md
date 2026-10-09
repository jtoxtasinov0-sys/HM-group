# HM Group — 3D veb-sayt

"Biz — Koreyada. Hamkorlarimiz — butun dunyoda"

Skroll orqali hikoya qiluvchi premium sayt:

1. **Garaj**: oq dumaloq showroom (shiftda katta yorug' doira), 6 ta mashina oq platformalarda (qora rezina halqa bilan) turadi.
   Sichqoncha mashina ustiga borsa, mashina kattalashadi va aylanadi. Bosilsa, o'sha mashina tanlanadi.
2. **Sahna**: tanlangan mashina joyidan haydab chiqadi (g'ildiraklar aylanadi, old g'ildiraklar buriladi,
   tormozda kuzov biroz egiladi), markaziy platformaga kiradi va platforma uni aylantiradi, orqada katta nomi ko'rinadi,
   pastda ma'lumotlar paneli chiqadi (yil, dvigatel, quvvat, probeg).
3. **Konteyner**: eshik ochiladi, mashina HM GROUP konteyneriga kiradi, eshiklar yopiladi.
4. **Kema**: hovli asta portga almashadi (konteyner joyida qoladi — "match dissolve"), kran konteynerni
   ko'taradi va strela bo'ylab kemadagi bo'sh uyachaga qo'yadi.
5. **Yetkazish**: kema quyosh tomon suzib ketadi — "~25 kun".

Undan keyin oddiy bo'limlar keladi: Sotuvda, Sotildi, Mijozlar, Biz haqimizda, Logistika, Kontakt.
Sayt ikki tilli (UZ / RU) va telefonga moslashgan.

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda: http://localhost:5173

Production uchun:

```bash
npm run build
```

Tayyor sayt `dist/` papkasida bo'ladi.

Saytni internetga joylash (asosiy manzil: **https://hmgroup-uz.vercel.app**):

```bash
npm run deploy
```

Bu saytni yig'adi va Vercel'dagi `hmgroup-uz` loyihasiga yuklaydi (bir marta `vercel login` kerak).
Har o'zgarishdan keyin qayta ishga tushiring.

Telegram, Instagram, WhatsApp'da havola rasm bilan chiqadi: rasm — `public/og.jpg` (1200×630),
sarlavha va matn — `index.html` dagi `og:` teglari. Manzil o'zgarsa, `tools/deploy.mjs` dagi `PROJECT` ni o'zgartiring.
Telegram eski preview'ni eslab qolsa, @WebpageBot ga havolani yuboring — u yangilaydi.

Zaxira: `npm run deploy:github` — GitHub Pages'ga (`gh-pages` branch).

## Ma'lumotlarni o'zgartirish

| Nima | Qayerda |
|---|---|
| Mashinalar (model, yil, dvigatel, ot kuchi, rang, izoh) | `src/data/cars.js` |
| "Sotildi" ro'yxati | `src/data/cars.js` → `SOLD` |
| Barcha matnlar (UZ / RU) | `src/i18n.js` |
| Telefon, Telegram, Instagram | `index.html` va `src/main.js` (`TG`, `IG`) |
| Ranglar | `src/styles.css` (`:root`) |
| Shrift (Inter) | `index.html` (Google Fonts) va `src/styles.css` (`--font`) |
| Logotip (HM belgisi) | `src/logo.js` — sayt, 3D sahna va ikonkalar shu shakldan chiziladi |
| Favicon va telefon ikonkalari | `npm run icons` — `public/` ga yozadi (`tools/icons.mjs`) |

**Muhim:** `src/data/cars.js` dagi mashinalar va "Sotildi" ro'yxati **namuna**.
Haqiqiy sotuvdagi mashinalar va haqiqiy sotilganlar bilan almashtiring.
"Mijozlar" bo'limidagi kartochkalar Instagram'ga olib boradi — xohlasangiz haqiqiy videolarni qo'shing.

## 3D modellar

Asl `.glb` fayllar juda og'ir edi (jami ~1 GB). Ular siqildi va `public/models/` ga yozildi:
geometriya soddalashtirildi, meshopt bilan siqildi, teksturalar WebP ga o'tkazildi
(masalan, Maybach: 81 MB → 3.4 MB).

Garajdagi mashinalar va kema saytda yuklanadi (~27 MB). `ghost`, `escalade`, `x6`, `sportage`
faqat katalog rasmlari uchun ishlatilgan.

Yangi model qo'shish:

1. `.glb` faylni loyiha papkasiga qo'ying.
2. `tools/optimize-models.mjs` dagi `MODELS` ro'yxatiga qo'shing (`length` — haqiqiy uzunlik, metr).
3. `npm run models -- <id>` — siqilgan model `public/models/<id>.glb` ga tushadi.
4. `src/data/cars.js` ga mashinani qo'shing. `paintRe` — kuzov materiali nomi.
   Material nomlarini ko'rish: `node tools/inspect.mjs public/models/<id>.glb`.
5. Katalog rasmi: `npm run dev`, keyin http://localhost:5173/dev/render.html oching —
   barcha rasmlar `public/renders/` ga avtomatik saqlanadi.

Garajda mashina bo'lishi uchun `garage: true` qo'ying (6 ta joy bor).
G'ildiraklar avtomatik topiladi (`src/three/wheels.js`). Tekshirish: http://localhost:5173/dev/wheels.html —
qizil doira g'ildirakka to'g'ri tushmasa, `cars.js` da `wheels: { r: 0.39 }` bilan radiusni bering.
Kuzov rangi: `paint` (`pearl`, `navy`, `obsidian`, `silver`, `ice`, `graphite` — `src/three/materials.js`).

## Fayllar tuzilishi

```
index.html              — sahifa
src/main.js             — skroll, tillar, katalog, overlaylar
src/logo.js             — HM logotipi (SVG path)
src/styles.css          — dizayn
src/i18n.js             — UZ / RU matnlar
src/data/cars.js        — mashinalar
src/three/world.js      — renderer va post-effektlar (bloom, tone mapping), yuklash, hover / tanlash
src/three/story.js      — skroll hikoyasi (kamera, konteyner, kran, kema)
src/three/garage.js     — garaj sahnasi
src/three/container.js  — HM GROUP konteyneri (ochiladigan eshiklar bilan)
src/three/port.js       — port: prichal, konteyner steklari, kema (va undagi joy)
src/three/crane.js      — konteyner krani (STS)
src/three/ocean.js      — aks beruvchi okean (FFT to'lqinlar)
src/three/sky.js        — osmon (quyosh, bulutlar) va undan muhit xaritasi
src/three/textures.js   — protsedural teksturalar (bo'yoq, zang, beton, devor, darvoza)
src/three/materials.js  — mashina bo'yoqlari
src/three/wheels.js     — g'ildiraklarni ajratish (aylanish, rul, podveska)
tools/                  — model optimizatsiyasi
dev/                    — model ko'ruvchi, g'ildirak tekshiruvi va katalog renderi
```

Dev rejimda `http://localhost:5173/?p=0.45` — hikoyani istalgan nuqtada ko'rish uchun (0 dan 1 gacha).
