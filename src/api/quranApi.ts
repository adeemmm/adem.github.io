import { Surah, SurahWithAyahs, Ayah, ReciterId } from '../types';

const BASE_URL = 'https://api.alquran.cloud/v1';
const AUDIO_CDN = 'https://cdn.islamic.network/quran/audio/128';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(json.status || 'API error');
  return json.data as T;
}

export async function fetchAllSurahs(): Promise<Surah[]> {
  return apiFetch<Surah[]>('/surah');
}

export async function fetchSurahWithAyahs(
  surahNumber: number
): Promise<SurahWithAyahs> {
  type EditionData = {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: string;
    ayahs: Array<{
      number: number;
      numberInSurah: number;
      text: string;
      juz: number;
      page: number;
    }>;
  };

  const editions = await apiFetch<EditionData[]>(
    `/surah/${surahNumber}/editions/quran-uthmani,en.transliteration,en.asad`
  );

  const [arabic, transliteration, translation] = editions;

  const ayahs: Ayah[] = arabic.ayahs.map((ayah, idx) => ({
    number: ayah.number,
    numberInSurah: ayah.numberInSurah,
    text: ayah.text,
    transliteration: transliteration.ayahs[idx]?.text,
    translation: translation.ayahs[idx]?.text,
    surahNumber,
    juz: ayah.juz,
    page: ayah.page,
  }));

  return {
    number: arabic.number,
    name: arabic.name,
    englishName: arabic.englishName,
    englishNameTranslation: arabic.englishNameTranslation,
    numberOfAyahs: arabic.numberOfAyahs,
    revelationType: arabic.revelationType as 'Meccan' | 'Medinan',
    ayahs,
  };
}

export function getAudioUrl(
  globalAyahNumber: number,
  reciter: ReciterId = 'ar.alafasy'
): string {
  return `${AUDIO_CDN}/${reciter}/${globalAyahNumber}.mp3`;
}

export const RECITERS = [
  { id: 'ar.alafasy' as ReciterId, name: 'Mishary Alafasy' },
  { id: 'ar.abdullahbasfar' as ReciterId, name: 'Abdullah Basfar' },
  { id: 'ar.husary' as ReciterId, name: 'Mahmoud Khalil Al-Husary' },
];
