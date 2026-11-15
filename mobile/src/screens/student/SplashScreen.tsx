import React, { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { colors, radius } from '../../theme/tokens';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

/**
 * Cold-launch splash — specs/017-ui-refresh FR-023.
 *
 * No artboard (FR-029), so it is composed from the Login hero's own
 * treatment: the brand ground with the sun disc and the espresso logo tile.
 * It sits on the same brand colour as the native splash
 * (values/colors.xml splashscreen_background) and the launcher icon
 * background, so the icon appears to expand into the app rather than
 * cutting between three different grounds.
 *
 * Renders outside Screen deliberately — Screen supplies a ground and
 * padding, and this is a full-bleed brand field.
 */
export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 600);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View
      style={{ backgroundColor: colors.primary }}
      className="flex-1 items-center justify-center gap-md"
      accessibilityLabel="GenzFeast"
    >
      <View
        style={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: radius.pill,
          backgroundColor: colors.accent,
          top: -60,
          right: -60,
        }}
      />
      <View
        style={{ borderRadius: radius['6xl'] }}
        className="w-6xl h-6xl bg-espresso items-center justify-center overflow-hidden"
      >
        <Image
          source={require('../../../assets/brand/gf-mark-white.png')}
          style={{ width: 64, height: 64 }}
          resizeMode="contain"
          accessibilityLabel=""
        />
      </View>
      <Text className="text-display text-espresso">
        Genz<Text className="text-surface">Feast</Text>
      </Text>
    </View>
  );
}
