import React, { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Login'), 600);
    return () => clearTimeout(timer);
  }, [navigation]);

  return <Screen title="GenzFeast" subtitle="Loading..." specRef="UI Design §3 Navigation Map" />;
}
