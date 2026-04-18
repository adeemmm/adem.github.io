export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  transliteration?: string;
  translation?: string;
  surahNumber: number;
  juz?: number;
  page?: number;
}

export interface SurahWithAyahs extends Surah {
  ayahs: Ayah[];
}

export interface Progress {
  surahsStarted: number[];
  ayahsPracticed: Record<string, boolean>;
  streak: number;
  lastPracticeDate: string | null;
  totalAyahsPracticed: number;
}

export interface Bookmark {
  id: string;
  surahNumber: number;
  ayahNumberInSurah: number;
  ayahGlobalNumber: number;
  surahName: string;
  ayahText: string;
  note?: string;
  timestamp: number;
}

export type ReciterId = 'ar.alafasy' | 'ar.abdullahbasfar' | 'ar.husary';

export interface Reciter {
  id: ReciterId;
  name: string;
}
