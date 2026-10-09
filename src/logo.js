// HM Group logotipi — asl belgidan o'lchab chizilgan, to'liq bo'yalgan shakllar.
// O'lcham: 634 × 200 birlik. index.html (#hm-logo) va public/favicon.svg dagi path bilan bir xil.
export const HM_W = 634;
export const HM_H = 200;

export const HM_PARTS = [
  'M0 0H36V200H0Z', // H — chap ustun
  'M255 0H291V200H255V116H58L77 84H255Z', // H — qiya uchli ko'ndalang va o'ng ustun
  'M314 52L349.5 81.5V200H314Z', // M — chap oyoq
  'M314 0H342.5L471.5 107.5L600.5 0H634V200H598V47L472 154L314 21.5Z', // M — "V" va o'ng ustun
];

export const HM_D = HM_PARTS.join('');
