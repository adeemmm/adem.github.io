import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { Colors, Spacing, Radius, Typography } from '../theme';
import { LESSONS } from '../data/lessons';
import type { ColorRuleItem, Section } from '../data/lessons';
import type { LearnStackParamList } from '../navigation';

type RouteType = RouteProp<LearnStackParamList, 'Lesson'>;

export default function LessonScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteType>();

  const lesson = LESSONS.find((l) => l.id === route.params.lessonId);

  if (!lesson) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.text }}>Lesson not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Lesson hero */}
      <View style={[styles.hero, { backgroundColor: Colors.primary }]}>
        <View style={[styles.heroIcon, { backgroundColor: lesson.accentColor + '33' }]}>
          <Ionicons name={lesson.icon as any} size={32} color={lesson.accentColor} />
        </View>
        <Text style={styles.heroTitle}>{lesson.title}</Text>
        <Text style={styles.heroSub}>{lesson.subtitle}</Text>
        <View style={styles.heroMeta}>
          <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.6)" />
          <Text style={styles.heroMetaText}>{lesson.estimatedMinutes} min read</Text>
        </View>
      </View>

      {/* Sections */}
      <View style={styles.sections}>
        {lesson.sections.map((section, i) => (
          <SectionBlock key={i} section={section} isDark={isDark} c={c} />
        ))}
      </View>
    </ScrollView>
  );
}

function SectionBlock({
  section,
  isDark,
  c,
}: {
  section: Section;
  isDark: boolean;
  c: typeof Colors.dark;
}) {
  switch (section.type) {
    case 'heading':
      return (
        <Text style={[styles.heading, { color: c.text }]}>{section.text}</Text>
      );

    case 'paragraph':
      return (
        <Text style={[styles.paragraph, { color: c.textSecondary }]}>{section.text}</Text>
      );

    case 'tip':
      return (
        <View
          style={[
            styles.tipBox,
            {
              backgroundColor: isDark ? Colors.dark.surfaceRaised : '#eef7ee',
              borderColor: Colors.primaryLight,
            },
          ]}
        >
          <Ionicons name="bulb-outline" size={16} color={Colors.gold} style={{ marginTop: 1 }} />
          <Text style={[styles.tipText, { color: c.textSecondary }]}>{section.text}</Text>
        </View>
      );

    case 'arabic-example':
      if (!section.example) return null;
      return (
        <View
          style={[
            styles.exampleCard,
            { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface },
          ]}
        >
          <Text style={[styles.exampleArabic, { color: c.text }]}>
            {section.example.arabic}
          </Text>
          <Text style={[styles.exampleTranslit, { color: isDark ? '#7aaa8a' : '#2d6a42' }]}>
            {section.example.transliteration}
          </Text>
          {!!section.example.translation && (
            <Text style={[styles.exampleTranslation, { color: c.textMuted }]}>
              "{section.example.translation}"
            </Text>
          )}
          {!!section.example.note && (
            <Text style={[styles.exampleNote, { color: c.textMuted }]}>
              {section.example.note}
            </Text>
          )}
        </View>
      );

    case 'letter-grid':
      if (!section.items) return null;
      return (
        <View style={styles.grid}>
          {section.items.map((item, i) => (
            <View
              key={i}
              style={[
                styles.gridCell,
                { backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface },
              ]}
            >
              <Text style={[styles.gridArabic, { color: c.text }]}>{item.arabic}</Text>
              <Text style={[styles.gridName, { color: c.textSecondary }]}>{item.name}</Text>
              <Text style={[styles.gridSound, { color: c.textMuted }]}>{item.sound}</Text>
            </View>
          ))}
        </View>
      );

    case 'color-rule':
      if (!section.rules) return null;
      return (
        <View style={styles.ruleList}>
          {section.rules.map((rule: ColorRuleItem, i: number) => (
            <View
              key={i}
              style={[
                styles.ruleCard,
                {
                  backgroundColor: isDark ? Colors.dark.surface : Colors.light.surface,
                  borderLeftColor: rule.color,
                },
              ]}
            >
              <View style={styles.ruleHeader}>
                <View style={[styles.ruleDot, { backgroundColor: rule.color }]} />
                <Text style={[styles.ruleName, { color: rule.color }]}>{rule.rule}</Text>
              </View>
              <Text style={[styles.ruleDesc, { color: c.textSecondary }]}>{rule.description}</Text>
              <View style={styles.ruleExample}>
                <Text style={[styles.ruleArabic, { color: c.text }]}>{rule.example}</Text>
                <Text style={[styles.ruleTranslit, { color: c.textMuted }]}>{rule.exampleTranslit}</Text>
              </View>
            </View>
          ))}
        </View>
      );

    case 'divider':
      return <View style={[styles.divider, { backgroundColor: c.border }]} />;

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {},
  hero: {
    padding: Spacing.xl,
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: { ...Typography.heading, fontSize: 24, color: '#fff', textAlign: 'center', marginBottom: Spacing.xs },
  heroSub: { ...Typography.body, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20, marginBottom: Spacing.sm },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { ...Typography.small, color: 'rgba(255,255,255,0.6)' },

  sections: { padding: Spacing.md, gap: Spacing.md },

  heading: { ...Typography.subheading, fontSize: 18, marginTop: Spacing.sm },
  paragraph: { ...Typography.body, lineHeight: 24 },

  tipBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  tipText: { ...Typography.body, flex: 1, lineHeight: 22 },

  exampleCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 6,
  },
  exampleArabic: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 32,
    lineHeight: 56,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  exampleTranslit: {
    fontSize: 17,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  exampleTranslation: { ...Typography.body, fontStyle: 'italic' },
  exampleNote: { ...Typography.caption, lineHeight: 18 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridCell: {
    width: '30%',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    gap: 2,
  },
  gridArabic: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 28,
    lineHeight: 44,
  },
  gridName: { ...Typography.small, fontWeight: '700', textAlign: 'center' },
  gridSound: { ...Typography.small, textAlign: 'center', fontStyle: 'italic' },

  ruleList: { gap: Spacing.sm },
  ruleCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
    gap: Spacing.sm,
  },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  ruleDot: { width: 10, height: 10, borderRadius: 5 },
  ruleName: { ...Typography.subheading, fontWeight: '700' },
  ruleDesc: { ...Typography.body, lineHeight: 22 },
  ruleExample: { gap: 2 },
  ruleArabic: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 22,
    lineHeight: 40,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ruleTranslit: { ...Typography.caption, fontStyle: 'italic' },

  divider: { height: 1, marginVertical: Spacing.sm },
});
