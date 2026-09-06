import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

// Loading placeholder for image-heavy lists — specs/013-blue-theme-visual-
// design FR-009, research.md §5. A plain Animated.View opacity pulse using
// React Native's built-in Animated API — no skeleton-loading dependency,
// matching ProductCard's rough shape (image rect + 2 text lines).
export function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="bg-surface rounded-md overflow-hidden border border-border mb-4"
    >
      <View className="w-full h-36 bg-border" />
      <View className="p-3 gap-2">
        <View className="w-2/3 h-4 rounded-sm bg-border" />
        <View className="w-1/3 h-4 rounded-sm bg-border" />
      </View>
    </Animated.View>
  );
}
