export type SectionType =
  | 'paragraph'
  | 'heading'
  | 'letter-grid'
  | 'arabic-example'
  | 'color-rule'
  | 'tip'
  | 'divider';

export interface ArabicExample {
  arabic: string;
  transliteration: string;
  translation?: string;
  note?: string;
}

export interface LetterItem {
  arabic: string;
  name: string;
  sound: string;
}

export interface ColorRuleItem {
  color: string;
  rule: string;
  description: string;
  example: string;
  exampleTranslit: string;
}

export interface Section {
  type: SectionType;
  text?: string;
  items?: LetterItem[];
  example?: ArabicExample;
  rules?: ColorRuleItem[];
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  estimatedMinutes: number;
  sections: Section[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'alphabet',
    title: 'The Arabic Alphabet',
    subtitle: '28 letters · right to left · no capital letters',
    icon: 'language-outline',
    accentColor: '#537FFF',
    estimatedMinutes: 10,
    sections: [
      {
        type: 'paragraph',
        text:
          'Arabic has 28 letters. Every letter is a consonant. The alphabet is written and read from right to left. Unlike English, Arabic has no capital letters — but each letter changes shape depending on where it appears in a word.',
      },
      {
        type: 'tip',
        text: 'You do not need to memorise every letter at once. Focus on recognising their shapes and sounds first.',
      },
      { type: 'heading', text: 'The 28 Letters' },
      {
        type: 'letter-grid',
        items: [
          { arabic: 'ا', name: 'Alef', sound: 'a / silent' },
          { arabic: 'ب', name: 'Ba', sound: 'b' },
          { arabic: 'ت', name: 'Ta', sound: 't' },
          { arabic: 'ث', name: 'Tha', sound: 'th (thin)' },
          { arabic: 'ج', name: 'Jeem', sound: 'j' },
          { arabic: 'ح', name: 'Ha', sound: 'h (heavy)' },
          { arabic: 'خ', name: 'Kha', sound: 'kh' },
          { arabic: 'د', name: 'Dal', sound: 'd' },
          { arabic: 'ذ', name: 'Thal', sound: 'dh (the)' },
          { arabic: 'ر', name: 'Ra', sound: 'r (rolled)' },
          { arabic: 'ز', name: 'Zay', sound: 'z' },
          { arabic: 'س', name: 'Seen', sound: 's' },
          { arabic: 'ش', name: 'Sheen', sound: 'sh' },
          { arabic: 'ص', name: 'Saad', sound: 's (heavy)' },
          { arabic: 'ض', name: 'Daad', sound: 'd (heavy)' },
          { arabic: 'ط', name: 'Ta', sound: 't (heavy)' },
          { arabic: 'ظ', name: 'Dha', sound: 'dh (heavy)' },
          { arabic: 'ع', name: 'Ain', sound: "' (throat)" },
          { arabic: 'غ', name: 'Ghain', sound: 'gh' },
          { arabic: 'ف', name: 'Fa', sound: 'f' },
          { arabic: 'ق', name: 'Qaaf', sound: 'q (deep)' },
          { arabic: 'ك', name: 'Kaaf', sound: 'k' },
          { arabic: 'ل', name: 'Lam', sound: 'l' },
          { arabic: 'م', name: 'Meem', sound: 'm' },
          { arabic: 'ن', name: 'Noon', sound: 'n' },
          { arabic: 'ه', name: 'Ha', sound: 'h' },
          { arabic: 'و', name: 'Waw', sound: 'w / u' },
          { arabic: 'ي', name: 'Ya', sound: 'y / i' },
        ],
      },
      {
        type: 'tip',
        text: 'Six letters (ا د ذ ر ز و) only connect to the letter before them, never after. This is why some words look "broken" — it is correct.',
      },
    ],
  },

  {
    id: 'harakat',
    title: 'Short Vowels (Harakat)',
    subtitle: 'The small marks that give letters their sound',
    icon: 'musical-notes-outline',
    accentColor: '#c9a84c',
    estimatedMinutes: 8,
    sections: [
      {
        type: 'paragraph',
        text:
          'Arabic letters on their own are consonants with no vowel sound. Harakat are small diacritical marks written above or below a letter to tell you which vowel sound to use. The Quran always includes harakat to ensure correct pronunciation.',
      },
      { type: 'heading', text: 'Fatha — the "a" sound' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'بَ',
          transliteration: 'ba',
          note: 'A small diagonal stroke above the letter → "a" sound after the consonant',
        },
      },
      { type: 'heading', text: 'Kasra — the "i" sound' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'بِ',
          transliteration: 'bi',
          note: 'A small diagonal stroke below the letter → "i" sound after the consonant',
        },
      },
      { type: 'heading', text: 'Dhamma — the "u" sound' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'بُ',
          transliteration: 'bu',
          note: 'A small loop above the letter → "u" sound after the consonant',
        },
      },
      { type: 'heading', text: 'Combining harakat: reading a word' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'كَتَبَ',
          transliteration: 'ka-ta-ba',
          translation: 'he wrote',
          note: 'Read each consonant + its vowel mark left to right within each letter, but the whole word right to left',
        },
      },
      {
        type: 'tip',
        text: 'Practise reading: ب with fatha = ba, with kasra = bi, with dhamma = bu. Repeat for ت, ن, and م.',
      },
    ],
  },

  {
    id: 'long-vowels',
    title: 'Long Vowels & Madd',
    subtitle: 'Elongating vowel sounds — 2 counts long',
    icon: 'resize-outline',
    accentColor: '#537FFF',
    estimatedMinutes: 7,
    sections: [
      {
        type: 'paragraph',
        text:
          'When a short vowel is followed by its matching "long" letter, the vowel sound is stretched to two counts. This stretching is called Madd (مَدّ), meaning "extension".',
      },
      { type: 'heading', text: 'Three long vowels' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'بَا',
          transliteration: 'baa',
          note: 'Fatha + Alef (ا) → stretch the "a" sound: baa (2 counts)',
        },
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'بِي',
          transliteration: 'bii',
          note: 'Kasra + Ya (ي) → stretch the "i" sound: bii (2 counts)',
        },
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'بُو',
          transliteration: 'buu',
          note: 'Dhamma + Waw (و) → stretch the "u" sound: buu (2 counts)',
        },
      },
      { type: 'heading', text: 'Madd in a real Quranic word' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'الرَّحْمَٰنِ',
          transliteration: 'ar-Rahmaan',
          translation: 'The Most Merciful',
          note: 'The "aa" in Rahmaan is a long vowel — hold it for two counts',
        },
      },
      {
        type: 'tip',
        text: 'In the Surah Reader, blue words contain a Madd (elongation). Hover over them to see which type.',
      },
    ],
  },

  {
    id: 'tanween',
    title: 'Tanween — Double Vowels',
    subtitle: 'Adding an "n" sound to the end of a word',
    icon: 'repeat-outline',
    accentColor: '#169200',
    estimatedMinutes: 6,
    sections: [
      {
        type: 'paragraph',
        text:
          'Tanween (تنوين) is a double vowel mark. It adds an "n" sound after the vowel and typically appears at the end of a word. It never appears on letters in the middle of a word.',
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'كِتَابٌ',
          transliteration: 'kitaabun',
          translation: 'a book',
          note: 'Tanween Dhamma (ٌ) → "un" at the end',
        },
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'كِتَابٍ',
          transliteration: 'kitaabin',
          translation: 'of a book',
          note: 'Tanween Kasra (ٍ) → "in" at the end',
        },
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'كِتَابًا',
          transliteration: 'kitaaban',
          translation: 'a book (object)',
          note: 'Tanween Fatha (ً) → "an" at the end',
        },
      },
      {
        type: 'tip',
        text: 'You will hear tanween a lot in Quranic recitation. Listen carefully for the "n" sound at the end of words.',
      },
    ],
  },

  {
    id: 'sukoon-shaddah',
    title: 'Sukoon & Shaddah',
    subtitle: 'No vowel · doubled consonant',
    icon: 'layers-outline',
    accentColor: '#DD0008',
    estimatedMinutes: 7,
    sections: [
      {
        type: 'paragraph',
        text:
          'Two more marks you will see frequently: Sukoon stops the vowel, Shaddah doubles the letter.',
      },
      { type: 'heading', text: 'Sukoon (ْ) — the rest mark' },
      {
        type: 'paragraph',
        text:
          'A small circle (ْ) above a letter means there is NO vowel after that consonant. You pronounce the letter and stop — no vowel sound follows it.',
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'مَلِكْ',
          transliteration: 'malik',
          translation: 'king',
          note: 'The final ك has sukoon — pronounce "k" with no vowel after it',
        },
      },
      { type: 'heading', text: 'Shaddah (ّ) — the double mark' },
      {
        type: 'paragraph',
        text:
          'A small "w" shape (ّ) above a letter means the letter is doubled. Pronounce it as if the letter appears twice — once with no vowel (sukoon) and once with the vowel shown.',
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'الرَّحْمَٰنِ',
          transliteration: 'ar-Rahmaan',
          translation: 'The Most Merciful',
          note: 'The ر has a shaddah — it sounds like "rr" (double r)',
        },
      },
      {
        type: 'arabic-example',
        example: {
          arabic: 'إِيَّاكَ',
          transliteration: "iyyaa-ka",
          translation: 'You alone',
          note: 'The ي has a shaddah — pronounce "yy"',
        },
      },
      {
        type: 'tip',
        text: 'Shaddah + Ghunna: when ن or م has a shaddah, you also nasalise through the nose for 2 counts. This shows as orange in the Surah Reader.',
      },
    ],
  },

  {
    id: 'tajweed-intro',
    title: 'Tajweed Colour Guide',
    subtitle: 'What each colour in the Surah Reader means',
    icon: 'color-palette-outline',
    accentColor: '#FF8C00',
    estimatedMinutes: 8,
    sections: [
      {
        type: 'paragraph',
        text:
          "Tajweed (تجويد) means 'to make excellent'. It is the set of rules that govern the correct pronunciation of the Quran, preserving the exact way it was revealed. In the Surah Reader, words are colour-coded by rule.",
      },
      {
        type: 'color-rule',
        rules: [
          {
            color: '#DD0008',
            rule: 'Qalqalah',
            description: 'A slight bounce or echo sound on the letters ق ط ب ج د when they have sukoon.',
            example: 'قَدْ',
            exampleTranslit: "qad",
          },
          {
            color: '#FF8C00',
            rule: 'Ghunna',
            description: 'Nasalise through the nose for 2 counts. Occurs on ن or م with a shaddah.',
            example: 'إِنَّ',
            exampleTranslit: 'inna',
          },
          {
            color: '#537FFF',
            rule: 'Madd',
            description: 'Elongate the vowel. Stretches the vowel sound for 2 or more counts depending on context.',
            example: 'الرَّحْمَٰنِ',
            exampleTranslit: 'ar-Rahmaan',
          },
          {
            color: '#54BAB9',
            rule: 'Ikhfa',
            description: 'Hide the n-sound partially. Occurs when noon sakinah is followed by certain letters.',
            example: 'مِن كُلِّ',
            exampleTranslit: 'min kulli',
          },
          {
            color: '#169200',
            rule: 'Idgham',
            description: 'Merge into the next letter. The noon sakinah disappears into certain following letters.',
            example: 'مِن يَوْمٍ',
            exampleTranslit: 'min yawm',
          },
        ],
      },
      {
        type: 'tip',
        text: 'Open any surah in the Surah Reader and tap "Words" to see these colours applied word-by-word. Hover over a coloured word to see the rule name.',
      },
    ],
  },

  {
    id: 'al-fatiha',
    title: 'Al-Fatiha: Your First Surah',
    subtitle: 'The Opening — recited in every prayer',
    icon: 'star-outline',
    accentColor: '#c9a84c',
    estimatedMinutes: 12,
    sections: [
      {
        type: 'paragraph',
        text:
          'Al-Fatiha is the first surah of the Quran and is recited at least 17 times every day in the five prayers. It has 7 ayahs and is the most repeated passage in the Quran. Learning it is the first step for any Muslim.',
      },
      { type: 'heading', text: 'Ayah 1 — Bismillah' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
          transliteration: 'bis-mil-laah-ir-Rah-maa-nir-Ra-heem',
          translation: 'In the name of Allah, the Most Gracious, the Most Merciful',
        },
      },
      { type: 'heading', text: 'Ayah 2' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
          transliteration: "al-Ham-du lil-laah-i rab-bil-'aa-la-meen",
          translation: 'All praise is due to Allah, Lord of all the worlds',
        },
      },
      { type: 'heading', text: 'Ayah 3' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'الرَّحْمَٰنِ الرَّحِيمِ',
          transliteration: 'ar-Rah-maa-nir-Ra-heem',
          translation: 'The Most Gracious, the Most Merciful',
        },
      },
      { type: 'heading', text: 'Ayah 4' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'مَالِكِ يَوْمِ الدِّينِ',
          transliteration: 'maa-li-ki yaw-mid-deen',
          translation: 'Master of the Day of Judgement',
        },
      },
      { type: 'heading', text: 'Ayah 5' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
          transliteration: "iy-yaa-ka na'-bu-du wa-iy-yaa-ka nas-ta-'een",
          translation: 'You alone we worship, and You alone we ask for help',
        },
      },
      { type: 'heading', text: 'Ayah 6' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
          transliteration: 'ih-di-nas-si-raa-tal-mus-ta-qeem',
          translation: 'Guide us to the straight path',
        },
      },
      { type: 'heading', text: 'Ayah 7' },
      {
        type: 'arabic-example',
        example: {
          arabic: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
          transliteration: "si-raa-tal-la-thee-na an-'am-ta 'a-lay-him ghay-ril-magh-duu-bi 'a-lay-him wa-lad-daal-leen",
          translation: 'The path of those You have blessed, not those who earned anger, nor those who went astray',
        },
      },
      {
        type: 'tip',
        text: 'Go to Surahs → Al-Fatiha and tap "Words" to see each word colour-coded with tajweed. Tap each word to hear its meaning.',
      },
    ],
  },
];
