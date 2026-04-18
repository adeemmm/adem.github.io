import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { fetchAllSurahs } from '../api/quranApi';
import type { Surah } from '../types';
import type { SurahStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<SurahStackParamList, 'SurahList'>;

type FilterType = 'All' | 'Meccan' | 'Medinan';

export default function SurahListScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');

  useEffect(() => {
    fetchAllSurahs()
      .then(setSurahs)
      .catch((e) => setError(e.message ?? 'Failed to load surahs'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return surahs.filter((s) => {
      if (filter !== 'All' && s.revelationType !== filter) return false;
      if (!q) return true;
      return (
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        String(s.number).includes(q) ||
        s.name.includes(query)
      );
    });
  }, [surahs, query, filter]);

  const handlePress = useCallback(
    (surah: Surah) => {
      navigation.navigate('SurahDetail', {
        surahNumber: surah.number,
        surahName: surah.name,
        englishName: surah.englishName,
      });
    },
    [navigation]
  );

  const styles = makeStyles(c, isDark);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>
          Loading surahs…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Ionicons name="wifi-outline" size={48} color={c.textMuted} />
        <Text style={[styles.errorTitle, { color: c.text }]}>
          Connection Error
        </Text>
        <Text style={[styles.errorText, { color: c.textSecondary }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchAllSurahs()
              .then(setSurahs)
              .catch((e) => setError(e.message ?? 'Failed to load surahs'))
              .finally(() => setLoading(false));
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top > 0 ? 0 : Spacing.sm }]}>
      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: c.background }]}>
        <View style={[styles.searchBar, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={c.textMuted} style={{ marginRight: Spacing.sm }} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="Search by name or number…"
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter chips */}
        <View style={styles.filters}>
          {(['All', 'Meccan', 'Medinan'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    filter === f ? Colors.primary : c.surface,
                  borderColor: filter === f ? Colors.gold : c.border,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: filter === f ? Colors.gold : c.textSecondary },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={[styles.countText, { color: c.textMuted }]}>
            {filtered.length} surahs
          </Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.number)}
        renderItem={({ item }) => (
          <SurahRow surah={item} onPress={handlePress} isDark={isDark} c={c} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
      />
    </View>
  );
}

const SurahRow = React.memo(function SurahRow({
  surah,
  onPress,
  isDark,
  c,
}: {
  surah: Surah;
  onPress: (s: Surah) => void;
  isDark: boolean;
  c: typeof Colors.dark;
}) {
  return (
    <TouchableOpacity
      style={[
        rowStyles.row,
        { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface },
      ]}
      activeOpacity={0.75}
      onPress={() => onPress(surah)}
    >
      {/* Number badge */}
      <View style={rowStyles.numBadge}>
        <View
          style={[
            rowStyles.numInner,
            { borderColor: Colors.gold, backgroundColor: Colors.primary },
          ]}
        >
          <Text style={rowStyles.numText}>{surah.number}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={rowStyles.info}>
        <Text style={[rowStyles.translit, { color: c.text }]}>
          {surah.englishName}
        </Text>
        <Text style={[rowStyles.meaning, { color: c.textSecondary }]}>
          {surah.englishNameTranslation}
        </Text>
        <View style={rowStyles.meta}>
          <View
            style={[
              rowStyles.badge,
              {
                backgroundColor:
                  surah.revelationType === 'Meccan'
                    ? 'rgba(201,168,76,0.15)'
                    : 'rgba(76,175,140,0.15)',
              },
            ]}
          >
            <Text
              style={[
                rowStyles.badgeText,
                {
                  color:
                    surah.revelationType === 'Meccan'
                      ? Colors.gold
                      : '#4caf8c',
                },
              ]}
            >
              {surah.revelationType}
            </Text>
          </View>
          <Text style={[rowStyles.ayahCount, { color: c.textMuted }]}>
            {surah.numberOfAyahs} ayahs
          </Text>
        </View>
      </View>

      {/* Arabic name */}
      <Text style={[rowStyles.arabic, { color: c.text }]}>{surah.name}</Text>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={c.textMuted}
        style={{ marginLeft: Spacing.xs }}
      />
    </TouchableOpacity>
  );
});

function makeStyles(c: typeof Colors.dark, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    loadingText: { ...Typography.body, marginTop: Spacing.md },
    errorTitle: { ...Typography.heading, marginTop: Spacing.md, marginBottom: Spacing.sm },
    errorText: { ...Typography.body, textAlign: 'center' },
    retryBtn: {
      marginTop: Spacing.lg,
      backgroundColor: Colors.primary,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.round,
    },
    retryText: { color: Colors.gold, fontWeight: '700' },
    searchWrap: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...Typography.body,
      paddingVertical: 2,
    },
    filters: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.sm,
      gap: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 5,
      borderRadius: Radius.round,
      borderWidth: 1,
    },
    chipText: { ...Typography.caption, fontWeight: '600' },
    countText: { ...Typography.caption, marginLeft: 'auto' },
    list: { paddingBottom: Spacing.xxl },
  });
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: Radius.md,
  },
  numBadge: { width: 44, alignItems: 'center', marginRight: Spacing.md },
  numInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: Colors.gold, fontSize: 12, fontWeight: '700' },
  info: { flex: 1 },
  translit: { ...Typography.subheading },
  meaning: { ...Typography.caption, marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: Spacing.sm },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.round,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  ayahCount: { ...Typography.small },
  arabic: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 20,
    textAlign: 'right',
    maxWidth: 100,
    writingDirection: 'rtl',
  },
});
