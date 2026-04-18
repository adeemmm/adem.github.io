const BASE = 'https://api.quran.com/api/v4';

export interface QuranWord {
  position: number;
  text_uthmani: string;
  char_type_name: 'word' | 'end' | 'pause';
  transliteration: string;
  translation: string;
}

export interface QuranVerse {
  verse_number: number;
  words: QuranWord[];
}

export async function fetchSurahWords(surahNum: number): Promise<QuranVerse[]> {
  const url =
    `${BASE}/verses/by_chapter/${surahNum}` +
    `?words=true&word_fields=transliteration,translation&per_page=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Word data unavailable (${res.status})`);
  const data = await res.json();

  return (data.verses ?? []).map((v: any) => ({
    verse_number: v.verse_number,
    words: (v.words ?? []).map((w: any) => ({
      position: w.position,
      text_uthmani: w.text_uthmani ?? w.text ?? '',
      char_type_name: w.char_type_name ?? 'word',
      transliteration: w.transliteration?.text ?? '',
      translation: w.translation?.text ?? '',
    })),
  }));
}
