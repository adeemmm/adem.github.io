import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import type { QuranWord } from '../api/quranComApi';
import { detectTajweed, TAJWEED_COLORS, TAJWEED_LABELS } from '../utils/tajweed';
import { Colors, Spacing, Radius } from '../theme';

interface Props {
  words: QuranWord[];
  textColor: string;
  isDark: boolean;
}

export default function WordByWordAyah({ words, textColor, isDark }: Props) {
  const [active, setActive] = useState<QuranWord | null>(null);

  const textWords = words.filter((w) => w.char_type_name !== 'pause');

  return (
    <View>
      <View style={styles.row}>
        {textWords.map((word, i) => {
          const rule = detectTajweed(word.text_uthmani);
          const color =
            word.char_type_name === 'word' && TAJWEED_COLORS[rule]
              ? (TAJWEED_COLORS[rule] as string)
              : textColor;
          const isActive = active?.position === word.position;

          return (
            <Pressable
              key={i}
              // @ts-ignore — onHoverIn/onHoverOut are React Native Web extensions
              onHoverIn={() => setActive(word)}
              onHoverOut={() => setActive(null)}
              onPress={() => setActive(isActive ? null : word)}
              style={[
                styles.wordBtn,
                isActive && {
                  backgroundColor: isDark
                    ? 'rgba(201,168,76,0.18)'
                    : 'rgba(201,168,76,0.14)',
                  borderRadius: 6,
                },
              ]}
            >
              <Text style={[styles.arabicWord, { color }]}>
                {word.text_uthmani}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {active && active.char_type_name === 'word' && (
        <View
          style={[
            styles.tooltip,
            {
              backgroundColor: isDark ? Colors.dark.surfaceRaised : '#eef5ee',
              borderColor: isDark ? Colors.dark.border : Colors.light.border,
            },
          ]}
        >
          {!!active.transliteration && (
            <Text style={[styles.tooltipTranslit, { color: isDark ? '#7aaa8a' : '#2d6a42' }]}>
              {active.transliteration}
            </Text>
          )}
          {!!active.translation && (
            <Text style={[styles.tooltipTranslation, { color: isDark ? Colors.dark.text : Colors.light.text }]}>
              {active.translation}
            </Text>
          )}
          {!!TAJWEED_LABELS[detectTajweed(active.text_uthmani)] && (
            <Text
              style={[
                styles.tooltipRule,
                { color: TAJWEED_COLORS[detectTajweed(active.text_uthmani)] ?? Colors.gold },
              ]}
            >
              {TAJWEED_LABELS[detectTajweed(active.text_uthmani)]}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
    marginBottom: Spacing.sm,
  },
  wordBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  arabicWord: {
    fontFamily: 'NotoNaskhArabic_400Regular',
    fontSize: 26,
    lineHeight: 50,
    writingDirection: 'rtl',
  },
  tooltip: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 3,
  },
  tooltipTranslit: {
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  tooltipTranslation: {
    fontSize: 14,
    lineHeight: 20,
  },
  tooltipRule: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
