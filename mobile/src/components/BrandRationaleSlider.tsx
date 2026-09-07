import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { colors, spacing } from '../theme/tokens';

/**
 * "Brand Direction Rationale" from the GenzFeast brand board — shown as a
 * swipeable slider under the Login screen's registration link. No carousel
 * library is added for this: a horizontal, paging ScrollView plus a manual
 * dot indicator covers the one thing this needs (three cards, swipe
 * between them), matching this project's existing preference for
 * zero-dependency UI where a full library would be overkill.
 */
const CARDS = [
  {
    emoji: '👥',
    badgeBg: '#FFE4D6',
    title: 'Youthful Campus Energy',
    description: 'A modern, friendly identity that resonates with Gen Z students and celebrates campus life.',
  },
  {
    emoji: '🍲',
    badgeBg: '#DCF3E8',
    title: 'Appetizing Food Warmth',
    description: 'Warm, vibrant colors and a food-centric mark that instantly feels delicious and inviting.',
  },
  {
    emoji: '📱',
    badgeBg: '#E3EAF2',
    title: 'Clear Mobile Usability',
    description: 'A clean, simple, scalable design that works beautifully on mobile and builds instant trust.',
  },
] as const;

// Matches Screen's own horizontal padding (p-6 = spacing.lg on both sides),
// so a page's card lines up exactly with the rest of the screen's content.
const HORIZONTAL_PADDING = spacing.lg;

export function BrandRationaleSlider() {
  const { width } = useWindowDimensions();
  const pageWidth = width - HORIZONTAL_PADDING * 2;
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setActiveIndex(index);
  }

  return (
    <View className="mt-8">
      <Text className="text-h2 text-text-primary text-center">Brand Direction Rationale</Text>
      <Text className="text-caption text-text-secondary text-center mt-1">
        Simple food · Stronger connections · Brighter tomorrows
      </Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        className="mt-4"
        style={{ width: pageWidth }}
      >
        {CARDS.map((card) => (
          <View key={card.title} style={{ width: pageWidth }} className="items-center px-2">
            <View
              className="items-center justify-center rounded-pill"
              style={{ width: 56, height: 56, backgroundColor: card.badgeBg }}
            >
              <Text style={{ fontSize: 26 }}>{card.emoji}</Text>
            </View>
            <Text className="text-body-bold text-text-primary text-center mt-3">{card.title}</Text>
            <Text className="text-body text-text-secondary text-center mt-1">{card.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row justify-center gap-2 mt-3">
        {CARDS.map((card, index) => (
          <View
            key={card.title}
            style={{
              width: index === activeIndex ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: index === activeIndex ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}
