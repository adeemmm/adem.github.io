import AsyncStorage from '@react-native-async-storage/async-storage';
import { Progress, Bookmark } from '../types';

const KEYS = {
  PROGRESS: '@quran_progress',
  BOOKMARKS: '@quran_bookmarks',
  LAST_SURAH: '@quran_last_surah',
  DARK_MODE: '@quran_dark_mode',
};

const DEFAULT_PROGRESS: Progress = {
  surahsStarted: [],
  ayahsPracticed: {},
  streak: 0,
  lastPracticeDate: null,
  totalAyahsPracticed: 0,
};

export async function getProgress(): Promise<Progress> {
  const raw = await AsyncStorage.getItem(KEYS.PROGRESS);
  return raw ? { ...DEFAULT_PROGRESS, ...JSON.parse(raw) } : DEFAULT_PROGRESS;
}

export async function markSurahStarted(surahNumber: number): Promise<void> {
  const progress = await getProgress();
  if (!progress.surahsStarted.includes(surahNumber)) {
    progress.surahsStarted.push(surahNumber);
    await AsyncStorage.setItem(KEYS.PROGRESS, JSON.stringify(progress));
  }
}

export async function markAyahPracticed(
  surahNumber: number,
  ayahNumber: number
): Promise<void> {
  const progress = await getProgress();
  const key = `${surahNumber}:${ayahNumber}`;
  if (!progress.ayahsPracticed[key]) {
    progress.ayahsPracticed[key] = true;
    progress.totalAyahsPracticed += 1;

    const today = new Date().toDateString();
    if (progress.lastPracticeDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      progress.streak =
        progress.lastPracticeDate === yesterday ? progress.streak + 1 : 1;
      progress.lastPracticeDate = today;
    }

    await AsyncStorage.setItem(KEYS.PROGRESS, JSON.stringify(progress));
  }
}

export async function getBookmarks(): Promise<Bookmark[]> {
  const raw = await AsyncStorage.getItem(KEYS.BOOKMARKS);
  return raw ? JSON.parse(raw) : [];
}

export async function addBookmark(
  bookmark: Omit<Bookmark, 'id' | 'timestamp'>
): Promise<void> {
  const bookmarks = await getBookmarks();
  const existing = bookmarks.find(
    (b) =>
      b.surahNumber === bookmark.surahNumber &&
      b.ayahNumberInSurah === bookmark.ayahNumberInSurah
  );
  if (existing) return;
  bookmarks.unshift({
    ...bookmark,
    id: `${bookmark.surahNumber}:${bookmark.ayahNumberInSurah}`,
    timestamp: Date.now(),
  });
  await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(bookmarks));
}

export async function removeBookmark(id: string): Promise<void> {
  const bookmarks = await getBookmarks();
  await AsyncStorage.setItem(
    KEYS.BOOKMARKS,
    JSON.stringify(bookmarks.filter((b) => b.id !== id))
  );
}

export async function isBookmarked(
  surahNumber: number,
  ayahNumberInSurah: number
): Promise<boolean> {
  const bookmarks = await getBookmarks();
  return bookmarks.some(
    (b) =>
      b.surahNumber === surahNumber &&
      b.ayahNumberInSurah === ayahNumberInSurah
  );
}

export async function saveLastSurah(surahNumber: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.LAST_SURAH, String(surahNumber));
}

export async function getLastSurah(): Promise<number | null> {
  const val = await AsyncStorage.getItem(KEYS.LAST_SURAH);
  return val ? Number(val) : null;
}
