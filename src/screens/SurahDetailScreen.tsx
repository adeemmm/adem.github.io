import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Audio } from 'expo-av';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { fetchSurahWithAyahs, getAudioUrl } from '../api/quranApi';
import { markSurahStarted, addBookmark, isBookmarked } from '../utils/storage';
import type { Ayah, SurahWithAyahs } from '../types';
import type { SurahStackParamList } from '../navigation';

type RouteType = RouteProp<SurahStackParamList, 'SurahDetail'>;

const BISMILLAH = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

export default function SurahDetailScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteType>();
  const { surahNumber } = route.params;
  const flatListRef = useRef<FlatList>(null);

  const [surah, setSurah] = useState<SurahWithAyahs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBeginner, setShowBeginner] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(new Set());

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    fetchSurahWithAyahs(surahNumber)
      .then((data) => {
        setSurah(data);
        markSurahStarted(surahNumber);
      })
      .catch((e) => setError(e.message ?? 'Failed to load surah'))
      .finally(() => setLoading(false));

    return () => {
      soundRef.current?.unloadAsync();
    };
  }, [surahNumber]);

  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const playAyah = useCallback(
    async (ayah: Ayah) => {
      await stopSound();
      const idx = surah?.ayahs.findIndex((a) => a.number === ayah.number) ?? -1;
      setPlayingIdx(idx);
      setIsPlaying(true);

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: getAudioUrl(ayah.number) },
          { shouldPlay: true }
        );
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            const nextIdx = idx + 1;
            if (surah && nextIdx < surah.ayahs.length) {
              playAyah(surah.ayahs[nextIdx]);
              flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true, viewOffset: 60 });
            } else {
              setPlayingIdx(null);
              setIsPlaying(false);
            }
          }
        });
      } catch {
        setIsPlaying(false);
        setPlayingIdx(null);
      }
    },
    [surah, stopSound]
  );

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  }, []);

  const handleBookmark = useCallback(
    async (ayah: Ayah) => {
      if (!surah) return;
      if (bookmarkedIds.has(ayah.numberInSurah)) return;
      await addBookmark({
        surahNumber,
        ayahNumberInSurah: ayah.numberInSurah,
        ayahGlobalNumber: ayah.number,
        surahName: surah.englishName,
        ayahText: ayah.text,
      });
      setBookmarkedIds((prev) => new Set([...prev, ayah.numberInSurah]));
    },
    [surah, surahNumber, bookmarkedIds]
  );

  const styles = makeStyles(c, isDark);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>
          Loading surah…
        </Text>
      </View>
    );
  }

  if (error || !surah) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Ionicons name="wifi-outline" size={48} color={c.textMuted} />
        <Text style={[styles.errorText, { color: c.text }]}>
          {error ?? 'Unknown error'}
        </Text>
      </View>
    );
  }

  const playingAyah =
    playingIdx !== null ? surah.ayahs[playingIdx] : null;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        ref={flatListRef}
        data={surah.ayahs}
        keyExtractor={(a) => String(a.number)}
        ListHeaderComponent={
          <SurahHeader surah={surah} isDark={isDark} c={c} />
        }
        renderItem={({ item, index }) => (
          <AyahCard
            ayah={item}
            index={index}
            isPlaying={playingIdx === index && isPlaying}
            isActive={playingIdx === index}
            showBeginner={showBeginner}
            isBookmarked={bookmarkedIds.has(item.numberInSurah)}
            onPlay={() => playAyah(item)}
            onBookmark={() => handleBookmark(item)}
            isDark={isDark}
            c={c}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
      />

      {/* Bottom Player */}
      <View
        style={[
          styles.player,
          { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface, borderTopColor: c.border },
        ]}
      >
        <TouchableOpacity
          style={styles.playerBtn}
          onPress={() => setShowBeginner((v) => !v)}
        >
          <Ionicons
            name={showBeginner ? 'eye' : 'eye-outline'}
            size={20}
            color={showBeginner ? Colors.gold : c.textMuted}
          />
          <Text style={[styles.playerBtnLabel, { color: showBeginner ? Colors.gold : c.textMuted }]}>
            Beginner
          </Text>
        </TouchableOpacity>

        <View style={styles.playerCenter}>
          {playingAyah ? (
            <>
              <TouchableOpacity
                onPress={() => {
                  if (playingIdx !== null && playingIdx > 0) {
                    playAyah(surah.ayahs[playingIdx - 1]);
                  }
                }}
                style={styles.playerIconBtn}
              >
                <Ionicons name="play-skip-back" size={22} color={c.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.playMainBtn, { backgroundColor: Colors.primary }]}
                onPress={togglePlayPause}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color={Colors.gold}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (playingIdx !== null && playingIdx < surah.ayahs.length - 1) {
                    playAyah(surah.ayahs[playingIdx + 1]);
                  }
                }}
                style={styles.playerIconBtn}
              >
                <Ionicons name="play-skip-forward" size={22} color={c.text} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.playMainBtn, { backgroundColor: Colors.primary }]}
              onPress={() => playAyah(surah.ayahs[0])}
            >
              <Ionicons name="play" size={24} color={Colors.gold} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.playerRight}>
          {playingAyah && (
            <Text style={[styles.playerAyahNum, { color: c.textMuted }]}>
              {playingAyah.numberInSurah}/{surah.numberOfAyahs}
            </Text>
          )}
          <TouchableOpacity onPress={stopSound}>
            <Ionicons name="stop-circle-outline" size={28} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function SurahHeader({
  surah, isDark, c,
}: {
  surah: SurahWithAyahs;
  isDark: boolean;
  c: typeof Colors.dark;
}) {
  return (
    <View style={[headerStyles.wrap, { backgroundColor: Colors.primary }]}>
      <Text style={headerStyles.arabicName}>{surah.name}</Text>
      <Text style={headerStyles.translit}>{surah.englishName}</Text>
      <Text style={headerStyles.meaning}>{surah.englishNameTranslation}</Text>
      <View style={headerStyles.metaRow}>
        <View style={headerStyles.badge}>
          <Text style={headerStyles.badgeText}>{surah.revelationType}</Text>
        </View>
        <Text style={headerStyles.metaText}>{surah.numberOfAyahs} Ayahs</Text>
      </View>
      {surah.number !== 9 && (
        <View style={headerStyles.bismillahWrap}>
          <Text style={headerStyles.bismillah}>{BISMILLAH}</Text>
        </View>
      )}
    </View>
  );
}

const AyahCard = React.memo(function AyahCard({
  ayah, index, isPlaying, isActive, showBeginner,
  isBookmarked, onPlay, onBookmark, isDark, c,
}: {
  ayah: Ayah;
  index: number;
  isPlaying: boolean;
  isActive: boolean;
  showBeginner: boolean;
  isBookmarked: boolean;
  onPlay: () => void;
  onBookmark: () => void;
  isDark: boolean;
  c: typeof Colors.dark;
}) {
  return (
    <View
      style={[
        cardStyles.card,
        {
          backgroundColor: isActive
            ? isDark
              ? 'rgba(201,168,76,0.08)'
              : 'rgba(201,168,76,0.06)'
            : isDark
            ? Colors.dark.surface
            : Colors.light.surface,
          borderLeftWidth: isActive ? 3 : 0,
          borderLeftColor: Colors.gold,
        },
      ]}
    >
      {/* Ayah number + actions row */}
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.numCircle, { borderColor: isDark ? Colors.dark.border : Colors.light.border }]}>
          <Text style={[cardStyles.numText, { color: Colors.gold }]}>
            {ayah.numberInSurah}
          </Text>
        </View>
        <View style={cardStyles.actions}>
          <TouchableOpacity onPress={onBookmark} style={cardStyles.actionBtn}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isBookmarked ? Colors.gold : c.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onPlay} style={cardStyles.actionBtn}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={22}
              color={isActive ? Colors.gold : c.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Arabic text */}
      <Text style={[cardStyles.arabic, { color: c.text }]}>{ayah.text}</Text>

      {/* Transliteration */}
      {ayah.transliteration && (
        <Text style={[cardStyles.translit, { color: c.textSecondary }]}>
          {ayah.transliteration}
        </Text>
      )}

      {/* Translation */}
      {ayah.translation && (
        <Text style={[cardStyles.translation, { color: c.textMuted }]}>
          {ayah.translation}
        </Text>
      )}

      {/* Beginner mode hint */}
      {showBeginner && (
        <View style={[cardStyles.beginnerHint, { backgroundColor: isDark ? Colors.dark.surfaceRaised : '#eaf4ee' }]}>
          <Text style={[cardStyles.beginnerText, { color: Colors.gold }]}>
            Tap the play button to hear this ayah · Follow the transliteration above
          </Text>
        </View>
      )}
    </View>
  );
});

function makeStyles(c: typeof Colors.dark, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { ...Typography.body, marginTop: Spacing.md },
    errorText: { ...Typography.body, marginTop: Spacing.md, textAlign: 'center' },
    list: { paddingBottom: Spacing.md },
    player: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    playerBtn: { alignItems: 'center', width: 64 },
    playerBtnLabel: { ...Typography.small, marginTop: 2 },
    playerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,
    },
    playerRight: {
      width: 64,
      alignItems: 'center',
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'flex-end',
    },
    playerAyahNum: { ...Typography.small },
    playMainBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerIconBtn: { padding: Spacing.xs },
  });
}

const headerStyles = StyleSheet.create({
  wrap: {
    padding: Spacing.xl,
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  arabicName: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 36,
    color: '#fff',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: Spacing.xs,
  },
  translit: { ...Typography.heading, color: Colors.gold, marginBottom: Spacing.xs },
  meaning: { ...Typography.body, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.round,
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  badgeText: { color: Colors.gold, fontWeight: '700', fontSize: 12 },
  metaText: { color: 'rgba(255,255,255,0.7)', ...Typography.caption },
  bismillahWrap: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  bismillah: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 24,
    color: Colors.goldLight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  numCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { padding: Spacing.xs },
  arabic: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 26,
    lineHeight: 48,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: Spacing.sm,
  },
  translit: {
    ...Typography.body,
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: Spacing.sm,
    color: '#7aaa8a',
  },
  translation: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  beginnerHint: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  beginnerText: {
    ...Typography.small,
    lineHeight: 18,
    textAlign: 'center',
  },
});
