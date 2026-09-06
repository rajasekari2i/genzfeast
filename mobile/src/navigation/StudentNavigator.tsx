import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SplashScreen } from '../screens/student/SplashScreen';
import { LoginScreen } from '../screens/student/LoginScreen';
import { RegisterScreen } from '../screens/student/RegisterScreen';
import { ForgotPasswordRequestScreen } from '../screens/student/ForgotPasswordRequestScreen';
import { ForgotPasswordVerifyScreen } from '../screens/student/ForgotPasswordVerifyScreen';
import { HomeScreen } from '../screens/student/HomeScreen';
import { CartScreen } from '../screens/student/CartScreen';
import { MyOrdersScreen } from '../screens/student/MyOrdersScreen';
import { OrderDetailScreen } from '../screens/student/OrderDetailScreen';
import { ProfileScreen } from '../screens/student/ProfileScreen';
import { primaryHeaderOptions } from '../theme/navigationHeader';

/** Matches the Student App Navigation Map, UI Design §3. */
export type StudentStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPasswordRequest: undefined;
  ForgotPasswordVerify: undefined;
  Home: undefined;
  Cart: undefined;
  MyOrders: undefined;
  OrderDetail: { orderId: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<StudentStackParamList>();

export function StudentNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ ...primaryHeaderOptions, headerShown: false }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: 'Login' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: 'Register' }} />
      <Stack.Screen
        name="ForgotPasswordRequest"
        component={ForgotPasswordRequestScreen}
        options={{ headerShown: true, title: 'Forgot Password' }}
      />
      <Stack.Screen
        name="ForgotPasswordVerify"
        component={ForgotPasswordVerifyScreen}
        options={{ headerShown: true, title: 'Verify OTP' }}
      />
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: true, title: 'GenzFeast' }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: true, title: 'Cart' }} />
      <Stack.Screen name="MyOrders" component={MyOrdersScreen} options={{ headerShown: true, title: 'My Orders' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ headerShown: true, title: 'Order Detail' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: 'Profile' }} />
    </Stack.Navigator>
  );
}
