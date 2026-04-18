import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { getProgress, getLastSurah } from '../utils/storage';
import { fetchAllSurahs } from '../api/quranApi';
import type { Progress, Surah } from '../types';
import type { RootTabParamList } from '../navigation';

type HomeNavProp = BottomTabNavigationProp<RootTabParamList, 'HomeTab'>;

export default function HomeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNavProp>();

  const [progress, setProgress] = useState<Progress | null>(null);
  const [lastSurah, setLastSurah] = useState<Surah | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const [prog, lastNum] = await Promise.all([getProgress(), getLastSurah()]);
        if (!active) return;
        setProgress(prog);
        if (lastNum) {
          const surahs = await fetchAllSurahs();
          const found = surahs.find((s) => s.number === lastNum) ?? null;
          if (active) setLastSurah(found);
        }
      }
      load();
      return () => { active = false; };
    }, [])
  );

  const styles = makeStyles(c, isDark);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <Text style={styles.bismillah}>بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</Text>
        <Text style={styles.bismillahTranslit}>
          Bismillāhi r-raḥmāni r-raḥīm
        </Text>
        <Text style={styles.headerTitle}>Quran Beginners</Text>
        <Text style={styles.headerSubtitle}>
          Learn to read & recite the Holy Quran
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard
          icon="book"
          value={progress?.surahsStarted.length ?? 0}
          label="Surahs"
          color={Colors.gold}
          isDark={isDark}
          c={c}
        />
        <StatCard
          icon="checkmark-circle"
          value={progress?.totalAyahsPracticed ?? 0}
          label="Ayahs"
          color="#4caf8c"
          isDark={isDark}
          c={c}
        />
        <StatCard
          icon="flame"
          value={progress?.streak ?? 0}
          label="Day Streak"
          color="#e8794c"
          isDark={isDark}
          c={c}
        />
      </View>

      {/* Continue or Start */}
      {lastSurah ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
            CONTINUE LEARNING
          </Text>
          <TouchableOpacity
            style={styles.continueCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SurahsTab')}
          >
            <View style={styles.continueLeft}>
              <Text style={[styles.surahNumBadge, { color: Colors.gold }]}>
                {lastSurah.number}
              </Text>
              <View>
                <Text style={[styles.continueArabic, { color: c.text }]}>
                  {lastSurah.name}
                </Text>
                <Text style={[styles.continueEnglish, { color: c.textSecondary }]}>
                  {lastSurah.englishName} · {lastSurah.numberOfAyahs} ayahs
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gold} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
          GET STARTED
        </Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            icon="book"
            title="Browse Surahs"
            subtitle="All 114 surahs"
            onPress={() => navigation.navigate('SurahsTab')}
            isDark={isDark}
            c={c}
          />
          <ActionCard
            icon="mic"
            title="Practice"
            subtitle="Memorize ayahs"
            onPress={() => navigation.navigate('PracticeTab')}
            isDark={isDark}
            c={c}
          />
          <ActionCard
            icon="bar-chart"
            title="My Progress"
            subtitle="Track learning"
            onPress={() => navigation.navigate('ProgressTab')}
            isDark={isDark}
            c={c}
          />
          <ActionCard
            icon="star"
            title="Al-Fatiha"
            subtitle="Start here"
            onPress={() => navigation.navigate('SurahsTab')}
            isDark={isDark}
            c={c}
          />
        </View>
      </View>

      {/* Beginner Tip */}
      <View style={[styles.tipCard, { backgroundColor: isDark ? Colors.dark.surfaceRaised : '#eaf4ee' }]}>
        <Ionicons name="bulb" size={20} color={Colors.gold} style={{ marginRight: Spacing.sm }} />
        <Text style={[styles.tipText, { color: c.textSecondary }]}>
          <Text style={{ fontWeight: '700', color: c.text }}>Tip: </Text>
          Start with Al-Fatiha (Chapter 1) — it's recited in every prayer and
          has only 7 short ayahs.
        </Text>
      </View>
    </ScrollView>
  );
}

function StatCard({
  icon, value, label, color, isDark, c,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: number;
  label: string;
  color: string;
  isDark: boolean;
  c: typeof Colors.dark;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon, title, subtitle, onPress, isDark, c,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  isDark: boolean;
  c: typeof Colors.dark;
}) {
  return (
    <TouchableOpacity
      style={[actionStyles.card, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[actionStyles.iconWrap, { backgroundColor: Colors.primary }]}>
        <Ionicons name={icon} size={20} color={Colors.gold} />
      </View>
      <Text style={[actionStyles.title, { color: c.text }]}>{title}</Text>
      <Text style={[actionStyles.subtitle, { color: c.textMuted }]}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(c: typeof Colors.dark, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: Spacing.xxl },
    header: {
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.xxl,
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    headerDecor: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      borderWidth: 1,
      borderColor: 'rgba(201,168,76,0.15)',
      top: -80,
      right: -60,
    },
    bismillah: {
      ...Typography.arabicMedium,
      color: Colors.gold,
      marginBottom: Spacing.xs,
    },
    bismillahTranslit: {
      ...Typography.caption,
      color: 'rgba(255,255,255,0.6)',
      marginBottom: Spacing.lg,
      letterSpacing: 0.3,
    },
    headerTitle: {
      ...Typography.heading,
      color: '#fff',
      marginBottom: Spacing.xs,
    },
    headerSubtitle: {
      ...Typography.body,
      color: 'rgba(255,255,255,0.7)',
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      marginHorizontal: Spacing.md,
      marginTop: -Spacing.lg,
      gap: Spacing.sm,
    },
    section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.md },
    sectionTitle: {
      ...Typography.small,
      letterSpacing: 1,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    continueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: Colors.gold,
    },
    continueLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    surahNumBadge: { ...Typography.heading, fontWeight: '700', width: 32, textAlign: 'center' },
    continueArabic: {
      fontFamily: 'NotoNaskhArabic',
      fontSize: 18,
      textAlign: 'right',
    },
    continueEnglish: { ...Typography.caption, marginTop: 2 },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    tipCard: {
      flexDirection: 'row',
      marginHorizontal: Spacing.md,
      marginTop: Spacing.xl,
      padding: Spacing.md,
      borderRadius: Radius.md,
      alignItems: 'flex-start',
    },
    tipText: { ...Typography.body, flex: 1, lineHeight: 22 },
  });
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  value: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  label: { fontSize: 11, fontWeight: '500', marginTop: 2 },
});

const actionStyles = StyleSheet.create({
  card: {
    width: '47.5%',
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { ...Typography.subheading, marginBottom: 2 },
  subtitle: { ...Typography.caption },
});
