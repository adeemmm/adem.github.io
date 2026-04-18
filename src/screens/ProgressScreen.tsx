import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { getProgress, getBookmarks } from '../utils/storage';
import type { Progress, Bookmark } from '../types';

const TOTAL_SURAHS = 114;
const TOTAL_AYAHS = 6236;

export default function ProgressScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [progress, setProgress] = useState<Progress | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getProgress(), getBookmarks()]).then(([p, b]) => {
        if (!active) return;
        setProgress(p);
        setBookmarks(b);
      });
      return () => { active = false; };
    }, [])
  );

  const styles = makeStyles(c, isDark);
  const surahPct = ((progress?.surahsStarted.length ?? 0) / TOTAL_SURAHS) * 100;
  const ayahPct = ((progress?.totalAyahsPracticed ?? 0) / TOTAL_AYAHS) * 100;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: Colors.primary }]}>
        <Text style={styles.headerTitle}>My Progress</Text>
        <Text style={styles.headerSub}>Keep up your learning journey</Text>
      </View>

      {/* Streak Card */}
      <View style={[styles.streakCard, { backgroundColor: Colors.primaryDark }]}>
        <View style={styles.streakLeft}>
          <Ionicons name="flame" size={40} color="#e8794c" />
        </View>
        <View>
          <Text style={styles.streakNum}>{progress?.streak ?? 0}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
          {progress?.lastPracticeDate && (
            <Text style={styles.streakSub}>
              Last practiced: {progress.lastPracticeDate}
            </Text>
          )}
        </View>
      </View>

      {/* Progress Bars */}
      <View style={[styles.card, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Overall Progress</Text>

        <ProgressBar
          label="Surahs Started"
          value={progress?.surahsStarted.length ?? 0}
          total={TOTAL_SURAHS}
          percent={surahPct}
          color={Colors.gold}
          c={c}
        />
        <ProgressBar
          label="Ayahs Practiced"
          value={progress?.totalAyahsPracticed ?? 0}
          total={TOTAL_AYAHS}
          percent={ayahPct}
          color="#4caf8c"
          c={c}
        />
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatTile
          icon="book"
          value={progress?.surahsStarted.length ?? 0}
          label="Surahs Started"
          color={Colors.gold}
          isDark={isDark}
          c={c}
        />
        <StatTile
          icon="checkmark-done"
          value={progress?.totalAyahsPracticed ?? 0}
          label="Ayahs Practiced"
          color="#4caf8c"
          isDark={isDark}
          c={c}
        />
        <StatTile
          icon="bookmark"
          value={bookmarks.length}
          label="Bookmarks"
          color="#7c9cdf"
          isDark={isDark}
          c={c}
        />
        <StatTile
          icon="flame"
          value={progress?.streak ?? 0}
          label="Day Streak"
          color="#e8794c"
          isDark={isDark}
          c={c}
        />
      </View>

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
            BOOKMARKS
          </Text>
          {bookmarks.slice(0, 5).map((b) => (
            <View
              key={b.id}
              style={[
                styles.bookmarkRow,
                { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface },
              ]}
            >
              <Ionicons name="bookmark" size={16} color={Colors.gold} style={{ marginRight: Spacing.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bookmarkTitle, { color: c.text }]}>
                  {b.surahName} · Ayah {b.ayahNumberInSurah}
                </Text>
                <Text
                  style={[styles.bookmarkText, { color: c.textSecondary }]}
                  numberOfLines={1}
                >
                  {b.ayahText}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Empty state */}
      {!progress?.surahsStarted.length && (
        <View style={[styles.emptyCard, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
          <Ionicons name="book-outline" size={48} color={c.textMuted} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>
            Start Learning
          </Text>
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            Read or listen to any surah to start tracking your progress here.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function ProgressBar({
  label, value, total, percent, color, c,
}: {
  label: string;
  value: number;
  total: number;
  percent: number;
  color: string;
  c: typeof Colors.dark;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={[Typography.caption, { color: c.textSecondary }]}>{label}</Text>
        <Text style={[Typography.caption, { color: c.textMuted }]}>
          {value} / {total}
        </Text>
      </View>
      <View style={[pbStyles.track, { backgroundColor: 'rgba(150,150,150,0.15)' }]}>
        <View
          style={[
            pbStyles.fill,
            { width: `${Math.min(percent, 100)}%` as any, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

function StatTile({
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
    <View
      style={[
        tileStyles.tile,
        { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface },
      ]}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[tileStyles.value, { color }]}>{value}</Text>
      <Text style={[tileStyles.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

function makeStyles(c: typeof Colors.dark, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: Spacing.xxl },
    header: {
      padding: Spacing.xl,
      paddingTop: Spacing.lg,
    },
    headerTitle: { ...Typography.heading, color: '#fff' },
    headerSub: { ...Typography.body, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    streakCard: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: Spacing.md,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
    },
    streakLeft: { marginRight: Spacing.lg },
    streakNum: { fontSize: 42, fontWeight: '800', color: '#fff' },
    streakLabel: { ...Typography.subheading, color: Colors.gold },
    streakSub: { ...Typography.caption, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
    card: {
      margin: Spacing.md,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
    },
    cardTitle: { ...Typography.subheading, marginBottom: Spacing.md },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
    sectionLabel: {
      ...Typography.small,
      letterSpacing: 1,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    bookmarkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radius.md,
      marginBottom: Spacing.xs,
    },
    bookmarkTitle: { ...Typography.caption, fontWeight: '600' },
    bookmarkText: { ...Typography.small, marginTop: 2 },
    emptyCard: {
      margin: Spacing.md,
      marginTop: Spacing.xl,
      padding: Spacing.xl,
      borderRadius: Radius.lg,
      alignItems: 'center',
    },
    emptyTitle: { ...Typography.subheading, marginTop: Spacing.md, marginBottom: Spacing.sm },
    emptyText: { ...Typography.body, textAlign: 'center', lineHeight: 22 },
  });
}

const pbStyles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});

const tileStyles = StyleSheet.create({
  tile: {
    width: '47.5%',
    padding: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  value: { fontSize: 28, fontWeight: '800', marginTop: 6, marginBottom: 2 },
  label: { ...Typography.small, textAlign: 'center' },
});
