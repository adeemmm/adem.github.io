import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { fetchAllSurahs } from '../api/quranApi';
import type { Surah } from '../types';
import type { PracticeStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<PracticeStackParamList, 'PracticeSelect'>;

const BEGINNER_NUMBERS = [1, 112, 113, 114, 110, 108, 103, 102, 101, 100, 99, 98];

export default function PracticeScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllSurahs()
      .then(setSurahs)
      .finally(() => setLoading(false));
  }, []);

  const beginnerSurahs = surahs.filter((s) => BEGINNER_NUMBERS.includes(s.number))
    .sort((a, b) => BEGINNER_NUMBERS.indexOf(a.number) - BEGINNER_NUMBERS.indexOf(b.number));

  const otherShortSurahs = surahs
    .filter((s) => !BEGINNER_NUMBERS.includes(s.number) && s.numberOfAyahs <= 30)
    .sort((a, b) => a.numberOfAyahs - b.numberOfAyahs);

  const handleSelect = (surah: Surah) => {
    navigation.navigate('PracticeSession', {
      surahNumber: surah.number,
      surahName: surah.name,
      englishName: surah.englishName,
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <View style={[styles.header, { backgroundColor: Colors.primary }]}>
            <Ionicons name="mic" size={28} color={Colors.gold} style={{ marginBottom: Spacing.sm }} />
            <Text style={styles.headerTitle}>Practice Mode</Text>
            <Text style={styles.headerSub}>
              Select a surah · read the transliteration · reveal Arabic to check yourself
            </Text>
          </View>

          <SectionLabel label="RECOMMENDED FOR BEGINNERS" c={c} />
          {beginnerSurahs.map((s) => (
            <SurahRow key={s.number} surah={s} onPress={handleSelect} isDark={isDark} c={c} />
          ))}

          <SectionLabel label="OTHER SHORT SURAHS" c={c} />
        </>
      }
      data={otherShortSurahs}
      keyExtractor={(s) => String(s.number)}
      renderItem={({ item }) => (
        <SurahRow surah={item} onPress={handleSelect} isDark={isDark} c={c} />
      )}
    />
  );
}

function SectionLabel({ label, c }: { label: string; c: typeof Colors.dark }) {
  return (
    <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>{label}</Text>
  );
}

const SurahRow = React.memo(function SurahRow({
  surah, onPress, isDark, c,
}: {
  surah: Surah;
  onPress: (s: Surah) => void;
  isDark: boolean;
  c: typeof Colors.dark;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}
      onPress={() => onPress(surah)}
      activeOpacity={0.75}
    >
      <View style={styles.numCircle}>
        <Text style={styles.numText}>{surah.number}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: c.text }]}>{surah.englishName}</Text>
        <Text style={[styles.meta, { color: c.textMuted }]}>
          {surah.numberOfAyahs} ayahs · {surah.revelationType}
        </Text>
      </View>
      <Text style={[styles.arabic, { color: c.textSecondary }]}>{surah.name}</Text>
      <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ marginLeft: Spacing.xs }} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {},
  header: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  headerTitle: { ...Typography.heading, color: '#fff', marginBottom: Spacing.xs },
  headerSub: { ...Typography.caption, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 18 },
  sectionLabel: {
    ...Typography.small,
    letterSpacing: 1,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    marginHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  numCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  numText: { color: Colors.gold, fontSize: 12, fontWeight: '700' },
  info: { flex: 1 },
  name: { ...Typography.subheading },
  meta: { ...Typography.caption, marginTop: 2 },
  arabic: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 18,
    writingDirection: 'rtl',
    marginLeft: Spacing.sm,
  },
});
