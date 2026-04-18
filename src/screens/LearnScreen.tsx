import React from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { LESSONS } from '../data/lessons';
import type { LearnStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<LearnStackParamList, 'LearnHome'>;

export default function LearnScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: Colors.primary }]}>
        <Ionicons name="school" size={30} color={Colors.gold} style={{ marginBottom: Spacing.sm }} />
        <Text style={styles.headerTitle}>Learn to Read</Text>
        <Text style={styles.headerSub}>
          Seven lessons from letters to Al-Fatiha — inspired by the Jalis ul Quran method
        </Text>
      </View>

      {/* Tajweed colour strip */}
      <View style={[styles.colorStrip, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}>
        <Text style={[styles.colorStripLabel, { color: c.textMuted }]}>TAJWEED COLOURS</Text>
        <View style={styles.colorDots}>
          {[
            { color: '#DD0008', label: 'Qalqalah' },
            { color: '#FF8C00', label: 'Ghunna' },
            { color: '#537FFF', label: 'Madd' },
            { color: '#54BAB9', label: 'Ikhfa' },
            { color: '#169200', label: 'Idgham' },
          ].map((item) => (
            <View key={item.color} style={styles.colorDot}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={[styles.dotLabel, { color: c.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Lesson cards */}
      <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>LESSONS</Text>
      {LESSONS.map((lesson, index) => (
        <TouchableOpacity
          key={lesson.id}
          style={[styles.card, { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface }]}
          onPress={() => navigation.navigate('Lesson', { lessonId: lesson.id })}
          activeOpacity={0.75}
        >
          <View style={[styles.cardIcon, { backgroundColor: lesson.accentColor + '22' }]}>
            <Ionicons name={lesson.icon as any} size={22} color={lesson.accentColor} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <View style={[styles.lessonNum, { backgroundColor: lesson.accentColor }]}>
                <Text style={styles.lessonNumText}>{index + 1}</Text>
              </View>
              <Text style={[styles.cardTitle, { color: c.text }]}>{lesson.title}</Text>
            </View>
            <Text style={[styles.cardSub, { color: c.textMuted }]} numberOfLines={2}>
              {lesson.subtitle}
            </Text>
            <View style={styles.cardMeta}>
              <Ionicons name="time-outline" size={12} color={c.textMuted} />
              <Text style={[styles.cardMetaText, { color: c.textMuted }]}>
                {lesson.estimatedMinutes} min
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </TouchableOpacity>
      ))}

      {/* Footer tip */}
      <View style={[styles.footerTip, { backgroundColor: isDark ? Colors.dark.surfaceRaised : '#eef5ee', borderColor: isDark ? Colors.dark.border : Colors.light.border }]}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.gold} />
        <Text style={[styles.footerTipText, { color: c.textSecondary }]}>
          After each lesson, practise in the Surahs tab with Word View and tajweed colouring turned on.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {},
  header: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  headerTitle: { ...Typography.heading, color: '#fff', marginBottom: Spacing.xs },
  headerSub: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  colorStrip: {
    padding: Spacing.md,
  },
  colorStripLabel: {
    ...Typography.small,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  colorDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  colorDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLabel: { ...Typography.small },
  sectionLabel: {
    ...Typography.small,
    letterSpacing: 1,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    marginHorizontal: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  lessonNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardTitle: { ...Typography.subheading, flex: 1 },
  cardSub: { ...Typography.caption, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardMetaText: { ...Typography.small },
  footerTip: {
    flexDirection: 'row',
    gap: Spacing.sm,
    margin: Spacing.md,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  footerTipText: { ...Typography.caption, flex: 1, lineHeight: 18 },
});
