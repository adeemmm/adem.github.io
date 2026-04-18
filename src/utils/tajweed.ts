export type TajweedRule = 'none' | 'qalqalah' | 'ghunna' | 'madd' | 'ikhfa' | 'idgham';

export const TAJWEED_COLORS: Record<TajweedRule, string | null> = {
  none: null,
  qalqalah: '#DD0008',
  ghunna: '#FF8C00',
  madd: '#537FFF',
  ikhfa: '#54BAB9',
  idgham: '#169200',
};

export const TAJWEED_LABELS: Record<TajweedRule, string> = {
  none: '',
  qalqalah: 'Qalqalah — slight bounce/echo',
  ghunna: 'Ghunna — nasalize through the nose',
  madd: 'Madd — elongate the vowel',
  ikhfa: 'Ikhfa — partially hide the n-sound',
  idgham: 'Idgham — merge into next letter',
};

const SUKOON = '\u0652';
const SHADDAH = '\u0651';
const SUPERSCRIPT_ALEF = '\u0670';
const MADDAH_ABOVE = '\u0653';

export function detectTajweed(word: string): TajweedRule {
  // Qalqalah: ق ط ب ج د with sukoon
  for (const letter of ['\u0642', '\u0637', '\u0628', '\u062C', '\u062F']) {
    if (word.includes(letter + SUKOON)) return 'qalqalah';
  }

  // Ghunna: ن or م with shaddah
  if (word.includes('\u0646' + SHADDAH) || word.includes('\u0645' + SHADDAH)) {
    return 'ghunna';
  }

  // Madd: آ (U+0622), superscript alef, or maddah-above
  if (word.includes('\u0622') || word.includes(SUPERSCRIPT_ALEF) || word.includes(MADDAH_ABOVE)) {
    return 'madd';
  }

  // Ikhfa: ن with sukoon
  if (word.includes('\u0646' + SUKOON)) return 'ikhfa';

  // Idgham: shaddah on ي ن م و ل ر
  for (const letter of ['\u064A', '\u0646', '\u0645', '\u0648', '\u0644', '\u0631']) {
    if (word.includes(letter + SHADDAH)) return 'idgham';
  }

  return 'none';
}
