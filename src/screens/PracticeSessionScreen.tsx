import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { fetchSurahWithAyahs, getAudioUrl } from '../api/quranApi';
import { markAyahPracticed } from '../utils/storage';
import type { Ayah, SurahWithAyahs } from '../types';
import type { PracticeStackParamList } from '../navigation';

type RouteType = RouteProp<PracticeStackParamList, 'PracticeSession'>;
type NavType = NativeStackNavigationProp<PracticeStackParamList, 'PracticeSession'>;

export default function PracticeSessionScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavType>();
  const { surahNumber } = route.params;

  const [surah, setSurah] = useState<SurahWithAyahs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    fetchSurahWithAyahs(surahNumber)
      .then(setSurah)
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false));

    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [surahNumber]);

  const currentAyah: Ayah | null = surah?.ayahs[currentIdx] ?? null;
  const total = surah?.ayahs.length ?? 0;
  const progressPct = total > 0 ? ((currentIdx + 1) / total) * 100 : 0;

  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (!currentAyah) return;

    if (isPlaying) {
      await stopSound();
      return;
    }

    setIsPlaying(true);
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: getAudioUrl(currentAyah.number) },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch {
      setIsPlaying(false);
    }
  }, [currentAyah, isPlaying, stopSound]);

  const handleReveal = useCallback(() => {
    if (!currentAyah) return;
    setRevealed(true);
    markAyahPracticed(surahNumber, currentAyah.numberInSurah);
  }, [currentAyah, surahNumber]);

  const goNext = useCallback(async () => {
    await stopSound();
    if (currentIdx < total - 1) {
      setCurrentIdx((i) => i + 1);
      setRevealed(false);
    } else {
      setFinished(true);
    }
  }, [currentIdx, total, stopSound]);

  const goPrev = useCallback(async () => {
    if (currentIdx === 0) return;
    await stopSound();
    setCurrentIdx((i) => i - 1);
    setRevealed(false);
  }, [currentIdx, stopSound]);

  const restart = useCallback(async () => {
    await stopSound();
    setCurrentIdx(0);
    setRevealed(false);
    setFinished(false);
  }, [stopSound]);

  const styles = makeStyles(c, isDark);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading…</Text>
      </View>
    );
  }

  if (error || !surah) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Ionicons name="wifi-outline" size={48} color={c.textMuted} />
        <Text style={[styles.errorText, { color: c.text }]}>{error ?? 'Unknown error'}</Text>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={[styles.center, { backgroundColor: c.background, paddingBottom: insets.bottom }]}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.gold} />
        <Text style={[styles.doneTitle, { color: c.text }]}>Surah Complete!</Text>
        <Text style={[styles.doneSub, { color: c.textSecondary }]}>
          You practiced all {total} ayahs of {surah.englishName}.
        </Text>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: Colors.primary, borderColor: Colors.gold }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.doneBtnText, { color: Colors.gold }]}>Choose Another Surah</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.doneBtn, { borderColor: c.border, marginTop: Spacing.sm }]}
          onPress={restart}
        >
          <Text style={[styles.doneBtnText, { color: c.textSecondary }]}>Practice Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>

      {/* Progress bar + label */}
      <View style={[styles.progressWrap, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
        <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
        </View>
        <Text style={[styles.progressLabel, { color: c.textMuted }]}>
          Ayah {currentIdx + 1} of {total}
        </Text>
      </View>

      {/* Ayah content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Translation */}
        <View style={[styles.card, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
          <Text style={[styles.cardLabel, { color: c.textMuted }]}>TRANSLATION</Text>
          <Text style={[styles.translation, { color: c.text }]}>
            {currentAyah?.translation ?? '—'}
          </Text>
        </View>

        {/* Transliteration */}
        <View style={[styles.card, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
          <Text style={[styles.cardLabel, { color: c.textMuted }]}>TRANSLITERATION</Text>
          <Text style={[styles.translit, { color: isDark ? '#7aaa8a' : '#2d6a42' }]}>
            {currentAyah?.transliteration ?? '—'}
          </Text>
        </View>

        {/* Arabic — hidden or revealed */}
        <View style={[styles.card, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
          <Text style={[styles.cardLabel, { color: c.textMuted }]}>ARABIC</Text>
          {revealed ? (
            <Text style={[styles.arabic, { color: c.text }]}>
              {currentAyah?.text}
            </Text>
          ) : (
            <TouchableOpacity
              style={[styles.revealBox, { backgroundColor: isDark ? Colors.dark.surfaceRaised : '#eef4ee', borderColor: c.border }]}
              onPress={handleReveal}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-off-outline" size={30} color={c.textMuted} />
              <Text style={[styles.revealTitle, { color: c.text }]}>Tap to reveal</Text>
              <Text style={[styles.revealHint, { color: c.textMuted }]}>
                Try to recall it from the transliteration first
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dot progress for short surahs */}
        {total <= 12 && (
          <View style={styles.dots}>
            {surah.ayahs.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === currentIdx
                        ? Colors.gold
                        : i < currentIdx
                        ? Colors.primaryLight
                        : c.border,
                    width: i === currentIdx ? 10 : 6,
                    height: i === currentIdx ? 10 : 6,
                    borderRadius: i === currentIdx ? 5 : 3,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={[styles.actions, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface, borderTopColor: c.border }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: Colors.primary, borderColor: Colors.gold }]}
          onPress={togglePlay}
          activeOpacity={0.8}
        >
          <Ionicons name={isPlaying ? 'pause' : 'volume-high'} size={18} color={Colors.gold} />
          <Text style={[styles.actionBtnText, { color: Colors.gold }]}>
            {isPlaying ? 'Pause' : 'Play Ayah'}
          </Text>
        </TouchableOpacity>

        {revealed ? (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: c.border }]}
            onPress={() => setRevealed(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-off-outline" size={18} color={c.textSecondary} />
            <Text style={[styles.actionBtnText, { color: c.textSecondary }]}>Hide</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.gold }]}
            onPress={handleReveal}
            activeOpacity={0.8}
          >
            <Ionicons name="eye" size={18} color={Colors.primary} />
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Reveal</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Prev / Next navigation */}
      <View style={[styles.navRow, { borderTopColor: c.border }]}>
        <TouchableOpacity
          style={[styles.navBtn, { opacity: currentIdx === 0 ? 0.35 : 1 }]}
          onPress={goPrev}
          disabled={currentIdx === 0}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
          <Text style={[styles.navBtnText, { color: c.text }]}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtnNext} onPress={goNext} activeOpacity={0.8}>
          <Text style={[styles.navBtnText, { color: Colors.gold, fontWeight: '700' }]}>
            {currentIdx === total - 1 ? 'Finish' : 'Next'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.gold} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: typeof Colors.dark, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    loadingText: { ...Typography.body, marginTop: Spacing.md },
    errorText: { ...Typography.body, textAlign: 'center' },

    progressWrap: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    progressTrack: { height: 4, borderRadius: 2, marginBottom: Spacing.xs, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 2 },
    progressLabel: { ...Typography.small, textAlign: 'right' },

    scroll: { flex: 1 },
    scrollContent: { padding: Spacing.md, gap: Spacing.sm },

    card: { padding: Spacing.md, borderRadius: Radius.md },
    cardLabel: {
      ...Typography.small,
      letterSpacing: 0.8,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    translation: { ...Typography.body, lineHeight: 24 },
    translit: { ...Typography.subheading, fontStyle: 'italic', lineHeight: 28 },
    arabic: {
      fontFamily: 'NotoNaskhArabic_400Regular',
      fontSize: 28,
      lineHeight: 52,
      textAlign: 'right',
      writingDirection: 'rtl',
    },

    revealBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xl,
      borderWidth: 1,
      borderRadius: Radius.md,
      gap: Spacing.sm,
    },
    revealTitle: { ...Typography.subheading, fontWeight: '700' },
    revealHint: { ...Typography.caption, textAlign: 'center', paddingHorizontal: Spacing.md },

    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
      marginTop: Spacing.xs,
    },
    dot: {},

    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm + 2,
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    actionBtnText: { fontWeight: '700', fontSize: 14 },

    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm },
    navBtnNext: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.sm },
    navBtnText: { ...Typography.subheading },

    doneTitle: { ...Typography.heading, fontSize: 26, marginTop: Spacing.lg, marginBottom: Spacing.sm },
    doneSub: { ...Typography.body, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
    doneBtn: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.round,
      borderWidth: 1,
    },
    doneBtnText: { fontWeight: '700', fontSize: 15 },
  });
}
