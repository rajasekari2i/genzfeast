import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient } from '../../api/client';
import { formatRupees } from '../../theme/money';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/005-staff-order-fulfilment-otp';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'OrderFulfilment'>;

const client = createTypedClient<paths>();

type OrderDetail = {
  reference: string;
  items: { name: string; quantity: number; price: number }[];
  total_amount: number;
};

/**
 * UI Design §5.7 — item/total detail, 6-digit numeric OTP input, Verify &
 * Deliver. The correct code is never fetched or shown here (FR-009) — only
 * what Staff types is ever submitted (specs/005).
 */
export function OrderFulfilmentScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [delivered, setDelivered] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await client.GET('/tenant/staff/orders/{orderId}', {
        params: { path: { orderId } },
      });
      if (!error && data) {
        setOrder(data as OrderDetail);
      } else {
        setErrorMessage('Could not load this order — it may have already been delivered.');
      }
      setLoadingOrder(false);
    })();
  }, [orderId]);

  async function handleVerify() {
    if (!code.trim()) {
      setErrorMessage('Ask the student for their pickup code.');
      return;
    }

    setVerifying(true);
    setErrorMessage(null);
    try {
      const { data, error, response } = await client.POST('/tenant/staff/orders/{orderId}/verify', {
        params: { path: { orderId } },
        body: { code: code.trim() },
      });

      if (error) {
        // 409: already delivered (FR-008). 422: mismatch (FR-007) — clear
        // inline error, order unchanged, retry immediately, no attempt limit.
        setErrorMessage(
          (error as { message?: string })?.message ??
            (response.status === 409
              ? 'This order has already been delivered.'
              : 'That code does not match. Please try again.'),
        );
        return;
      }

      setDelivered(true);
      Alert.alert('Delivered', `Order ${order?.reference ?? ''} marked delivered.`, [
        { text: 'Back to Incoming Orders', onPress: () => navigation.navigate('IncomingOrders') },
      ]);
      void data;
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  }

  if (loadingOrder) {
    return <Screen title="Order Fulfilment" specRef="UI Design §5.7" />;
  }

  return (
    <Screen title="Order Fulfilment" subtitle={order?.reference} specRef="UI Design §5.7">
      <View className="gap-3">
        {order ? (
          <>
            {order.items.map((item, index) => (
              <View key={index} className="flex-row justify-between">
                <Text className="text-body text-text-primary">
                  {item.quantity} × {item.name}
                </Text>
                <Text className="text-body text-text-secondary">{formatRupees(item.price * item.quantity)}</Text>
              </View>
            ))}
            <View className="flex-row justify-between border-t border-border pt-2 mt-1">
              <Text className="text-body-bold text-text-primary">Total</Text>
              <Text className="text-price text-text-primary">{formatRupees(order.total_amount)}</Text>
            </View>
          </>
        ) : null}

        {!delivered ? (
          <>
            <Text className="text-body text-text-secondary mt-2">Ask the student for their pickup code.</Text>
            <TextInput
              className="border border-border rounded-lg px-3 py-2 text-text-primary"
              placeholder="6-digit pickup code"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
            <PrimaryButton
              label="Verify & Deliver"
              onPress={handleVerify}
              loading={verifying}
              disabled={verifying}
            />
          </>
        ) : (
          <Text className="text-body-bold text-green-700">Delivered ✓</Text>
        )}
      </View>
    </Screen>
  );
}
