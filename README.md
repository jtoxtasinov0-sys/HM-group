# HM Group — 3D veb-sayt

"Biz — Koreyada. Hamkorlarimiz — butun dunyoda"

Skroll orqali hikoya qiluvchi premium sayt:

1. **Garaj**: oq dumaloq showroom (shiftda katta yorug' doira), 11 ta mashina bir qatorda oq platformalarda
   (qora rezina halqa bilan) turadi. Sichqoncha mashina ustiga borsa, mashina kattalashadi va tomoshabinga qarab
   buriladi. Bosilsa, o'sha mashina tanlanadi. Telefonda ‹ › tugmalari bilan mashinalar almashtiriladi.
2. **Sahna**: tanlangan mashina joyidan haydab chiqadi (g'ildiraklar aylanadi, old g'ildiraklar buriladi,
   tormozda kuzov biroz egiladi), markaziy platformaga kiradi va platforma uni ~1–1.3 marta aylantiradi, orqada katta nomi ko'rinadi,
   pastda ma'lumotlar paneli chiqadi (yil, dvigatel, quvvat, probeg).
3. **Konteyner**: eshik ochiladi, mashina HM GROUP konteyneriga kiradi, eshiklar yopiladi.
4. **Kema**: hovli asta portga almashadi (konteyner joyida qoladi — "match dissolve"), kran konteynerni
   ko'taradi va strela bo'ylab kemadagi bo'sh uyachaga qo'yadi.
5. **Yetkazish**: kema quyosh tomon suzib ketadi — "40–45 kun".

Undan keyin oddiy bo'limlar keladi: Sotuvda, Obzorlar, Sotildi, Mijozlar, Biz haqimizda, Logistika, Kontakt.

- **Sotuvda** — haqiqiy mashinalar (Instagram e'lonlaridan): har birida 4 ta rasm (surib ko'riladi), ma'lumotlar,
  «Instagram» (postga) va «Ma'lumot olish» tugmalari. Filtr: SUV / Sedan / Sport.
- **Obzorlar** — Instagram Reels videolari saytning o'zida: kartochkalarda hamma videolar ovozsiz o'ynab turadi (12 soniyalik parcha),
  bosilsa katta oynada to'liq video ovozi bilan ochiladi (‹ › — keyingi video, oynada «Instagram'da ochish» ham bor).
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

Vercel loyihasi GitHub'ga ulangan — `main` ga push qilinganda sayt avtomatik yig'iladi va yangilanadi
(sozlamalar `vercel.json` da). Qo'lda joylash kerak bo'lsa:

```bash
npm run deploy
```

Bu saytni yig'adi va Vercel'dagi `hmgroup-uz` loyihasiga yuklaydi (bir marta `vercel login` kerak).

Telegram, Instagram, WhatsApp'da havola rasm bilan chiqadi: rasm — `public/og.jpg` (1200×630),
sarlavha va matn — `index.html` dagi `og:` teglari. Manzil o'zgarsa, `tools/deploy.mjs` dagi `PROJECT` ni o'zgartiring.
Telegram eski preview'ni eslab qolsa, @WebpageBot ga havolani yuboring — u yangilaydi.

Zaxira: `npm run deploy:github` — GitHub Pages'ga (`gh-pages` branch).

## Ma'lumotlarni o'zgartirish

| Nima | Qayerda |
|---|---|
| Sotuvdagi mashinalar (rasm, yil, dvigatel, ot kuchi, rang, Instagram post) | `src/data/stock.js` → `STOCK` |
| Obzor videolari (Instagram Reels) | `src/data/stock.js` → `REELS`, fayllar `public/reels/` (`npm run reels`) |
| 3D garajdagi mashinalar | `src/data/cars.js` |
| "Sotildi" ro'yxati | `src/data/cars.js` → `SOLD` |
| Garajdagi mashinalar va ularning tartibi | `src/data/cars.js` → `GARAGE` (joylar: `src/three/garage.js` → `G.slots`) |
| Barcha matnlar (UZ / RU) | `src/i18n.js` |
| Telefon, Telegram, Instagram | `index.html` va `src/main.js` (`TG`, `IG`) |
| Ranglar | `src/styles.css` (`:root`) |
| Animatsiyalar (kirish, paydo bo'lish, logistika yo'li) | `src/styles.css` ("Paydo bo'lish animatsiyalari") va `src/main.js` |
| Shrift (Inter) | `index.html` (Google Fonts) va `src/styles.css` (`--font`) |
| Logotip (HM belgisi) | `src/logo.js` — sayt, 3D sahna va ikonkalar shu shakldan chiziladi |
| Favicon va telefon ikonkalari | `npm run icons` — `public/` ga yozadi (`tools/icons.mjs`) |

**Muhim:** `src/data/cars.js` dagi "Sotildi" ro'yxati **namuna** — haqiqiy sotilganlar bilan almashtiring.
"Mijozlar" bo'limidagi kartochkalar Instagram'ga olib boradi — xohlasangiz haqiqiy videolarni qo'shing.

## Sotuvdagi mashina qo'shish

1. Rasmlarni `HM_Group_mashinalar/<raqam_nomi>/` papkasiga qo'ying (masalan, `11_BMW_X5/`).
2. `src/data/stock.js` dagi `STOCK` ga mashinani qo'shing (`dir` — papka nomi, `photos` — rasmlar soni, `ig` — Instagram post).
3. `npm run photos -- <id>` — rasmlar siqilib `public/cars/<id>/1.webp, 2.webp, ...` ga tushadi.

## Obzor videosi qo'shish

1. `src/data/stock.js` dagi `REELS` ga reel ID sini va sarlavhasini qo'shing (`instagram.com/reel/<ID>/` dagi qism).
2. `npm run reels -- <ID>` — video Instagram'dan yuklanadi (`yt-dlp`), siqiladi (`ffmpeg`) va `public/reels/` ga tushadi:
   `<ID>.mp4` (to'liq, ovozli, 540×960), `<ID>-preview.mp4` (12 soniyalik ovozsiz parcha) va `<ID>.webp` (muqova).

Kerak: `winget install Gyan.FFmpeg yt-dlp.yt-dlp`. Instagram yuklashga ruxsat bermasa, videoni
`HM_Group_mashinalar/obzorlar/<ID>.mp4` nomi bilan qo'lda qo'ying va buyruqni qayta ishga tushiring.

## 3D modellar

Asl `.glb` fayllar juda og'ir edi (jami ~1 GB). Ular siqildi va `public/models/` ga yozildi:
geometriya soddalashtirildi, meshopt bilan siqildi, teksturalar WebP ga o'tkazildi
(masalan, Maybach: 81 MB → 3.4 MB).

Garajdagi barcha mashinalar va kema saytda yuklanadi (~42 MB). Sayt tez ochilishi uchun faqat birinchi
kadrda kerakli modellar kutiladi: kompyuterda markazdagi 2 ta fayl (G 63 + Urus, ~6.7 MB), telefonda —
tanlangan mashina (G 63, ~3.4 MB). Qolganlari markazdan chetga tartibda, bir vaqtda 2 tadan fonda
yuklanadi va platformada silliq paydo bo'ladi; kema oxirida (foydalanuvchi skrollni boshlasa — oldinroq).
Sichqoncha borgan / tanlangan mashina navbatda oldinga o'tadi. Bir model bir necha
rangda ishlatilishi mumkin (`file`: masalan, oq va qora G 63 — bitta `g63.glb`).

Tezlik uchun (qotmasligi uchun):

- fondagi og'ir ishlar (model tayyorlash, shaderlar, teksturalarni GPU'ga yuklash) brauzer bo'sh paytlariga
  bo'lib qo'yiladi; port sahnasi (kran, kema, okean) hikoyaga yetib kelguncha oldindan tayyorlanadi;
- meshopt geometriyasi alohida oqimlarda (Web Worker) ochiladi;
- garajdagi soya xaritasi faqat biror narsa qimirlaganda qayta chiziladi;
- kuchsiz GPU'da sifat avtomatik pasayadi (MSAA → piksel zichligi → pol aksi);
- `manifest.json` dagi `v` — model fayli xeshi: model `?v=...` bilan so'raladi va brauzer keshida
  uzoq saqlanadi (`vercel.json` → `headers`). Model o'zgarsa `npm run models` xeshni o'zi yangilaydi.

Yangi model qo'shish:

1. `.glb` faylni loyiha papkasiga qo'ying.
2. `tools/optimize-models.mjs` dagi `MODELS` ro'yxatiga qo'shing (`length` — haqiqiy uzunlik, metr).
3. `npm run models -- <id>` — siqilgan model `public/models/<id>.glb` ga tushadi.
4. `src/data/cars.js` ga mashinani qo'shing. `paintRe` — kuzov materiali nomi.
   Material nomlarini ko'rish: `node tools/inspect.mjs public/models/<id>.glb`.
5. Katalog rasmi: `npm run dev`, keyin http://localhost:5173/dev/render.html oching —
   barcha rasmlar `public/renders/` ga avtomatik saqlanadi.

Garajga mashina qo'shish: `cars.js` dagi `GARAGE` ro'yxatiga id ni yozing va `garage.js` dagi `G.slots` ga
shuncha joy qo'shing (hozir 11 ta, oraliq 4 m). Joylar surilsa, haydash yo'llari qo'shni mashinalarga
tegmasligini tekshiring.
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
src/data/cars.js        — 3D garaj mashinalari va "Sotildi"
src/data/stock.js       — sotuvdagi mashinalar (rasmlar bilan) va obzor videolari (public/reels)
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
tools/                  — model, rasm va video optimizatsiyasi
HM_Group_mashinalar/    — sotuvdagi mashinalarning asl rasmlari (saytga public/cars ichidagi siqilganlari ketadi)
dev/                    — model ko'ruvchi, g'ildirak tekshiruvi va katalog renderi
```

Dev rejimda `http://localhost:5173/?p=0.45` — hikoyani istalgan nuqtada ko'rish uchun (0 dan 1 gacha).
