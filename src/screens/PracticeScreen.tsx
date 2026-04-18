import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { fetchAllSurahs } from '../api/quranApi';
import type { Surah } from '../types';
import type { RootTabParamList } from '../navigation';

type NavProp = BottomTabNavigationProp<RootTabParamList, 'PracticeTab'>;

export default function PracticeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Surah | null>(null);

  useEffect(() => {
    fetchAllSurahs()
      .then((data) => setSurahs(data.slice(0, 30)))
      .finally(() => setLoading(false));
  }, []);

  const beginnerSurahs = surahs.filter((s) =>
    [1, 112, 113, 114, 110, 108, 103, 102, 101].includes(s.number)
  );

  const styles = makeStyles(c, isDark);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: c.text }]}>Practice Mode</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Select a surah to begin memorization practice
        </Text>
      </View>

      {/* Beginner picks */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
          RECOMMENDED FOR BEGINNERS
        </Text>
        {beginnerSurahs.map((s) => (
          <TouchableOpacity
            key={s.number}
            style={[
              styles.surahRow,
              {
                backgroundColor:
                  selected?.number === s.number
                    ? Colors.primary
                    : isDark ? Colors.dark.surface : Colors.light.surface,
                borderColor:
                  selected?.number === s.number ? Colors.gold : 'transparent',
              },
            ]}
            onPress={() => setSelected(s)}
            activeOpacity={0.8}
          >
            <View style={[styles.numCircle, { borderColor: Colors.gold }]}>
              <Text style={[styles.numText, { color: Colors.gold }]}>
                {s.number}
              </Text>
            </View>
            <View style={styles.surahInfo}>
              <Text
                style={[
                  styles.surahName,
                  { color: selected?.number === s.number ? '#fff' : c.text },
                ]}
              >
                {s.englishName}
              </Text>
              <Text
                style={[
                  styles.surahMeta,
                  {
                    color:
                      selected?.number === s.number
                        ? 'rgba(255,255,255,0.7)'
                        : c.textMuted,
                  },
                ]}
              >
                {s.numberOfAyahs} ayahs · {s.revelationType}
              </Text>
            </View>
            <Text
              style={[
                styles.surahArabic,
                { color: selected?.number === s.number ? Colors.gold : c.textSecondary },
              ]}
            >
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <View style={styles.startWrap}>
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: Colors.primary }]}
            onPress={() => navigation.navigate('SurahsTab')}
            activeOpacity={0.85}
          >
            <Ionicons name="mic" size={20} color={Colors.gold} />
            <Text style={styles.startBtnText}>
              Practice {selected.englishName}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.startNote, { color: c.textMuted }]}>
            Full practice mode with audio recording coming soon
          </Text>
        </View>
      )}

      <View style={[styles.comingSoonCard, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
        <Ionicons name="construct" size={32} color={Colors.gold} style={{ marginBottom: Spacing.sm }} />
        <Text style={[styles.comingSoonTitle, { color: c.text }]}>
          Full Practice Mode
        </Text>
        <Text style={[styles.comingSoonText, { color: c.textSecondary }]}>
          Record your recitation and compare it with a professional reciter.
          Track which ayahs you've mastered.
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(c: typeof Colors.dark, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: Spacing.xxl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerWrap: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
      backgroundColor: Colors.primary,
    },
    title: { ...Typography.heading, color: '#fff' },
    subtitle: { ...Typography.body, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.md },
    sectionLabel: {
      ...Typography.small,
      letterSpacing: 1,
      fontWeight: '700',
      marginBottom: Spacing.sm,
    },
    surahRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radius.md,
      marginBottom: Spacing.sm,
      borderWidth: 1.5,
    },
    numCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    numText: { fontSize: 12, fontWeight: '700' },
    surahInfo: { flex: 1 },
    surahName: { ...Typography.subheading },
    surahMeta: { ...Typography.caption, marginTop: 2 },
    surahArabic: {
      fontFamily: 'NotoNaskhArabic_400Regular',
      fontSize: 18,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginLeft: Spacing.sm,
    },
    startWrap: {
      paddingHorizontal: Spacing.md,
      marginTop: Spacing.xl,
      alignItems: 'center',
    },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.xl,
      borderRadius: Radius.round,
      borderWidth: 1,
      borderColor: Colors.gold,
    },
    startBtnText: {
      color: Colors.gold,
      fontWeight: '700',
      fontSize: 16,
    },
    startNote: {
      ...Typography.caption,
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    comingSoonCard: {
      margin: Spacing.md,
      marginTop: Spacing.xl,
      padding: Spacing.xl,
      borderRadius: Radius.lg,
      alignItems: 'center',
    },
    comingSoonTitle: { ...Typography.subheading, marginBottom: Spacing.sm },
    comingSoonText: { ...Typography.body, textAlign: 'center', lineHeight: 22 },
  });
}
