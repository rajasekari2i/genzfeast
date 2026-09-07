import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RazorpayCheckout from 'react-native-razorpay';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { createTypedClient } from '../../api/client';
import { formatRupees } from '../../theme/money';
import { getRazorpayKeyId } from '../../config/tenant';
import type { StudentStackParamList } from '../../navigation/StudentNavigator';
import type { paths as OrderDetailPaths } from '../../api/generated/008-my-orders-history-upcoming';
import type { paths as RetryPaymentPaths } from '../../api/generated/006-student-browse-cart-checkout';

type Props = NativeStackScreenProps<StudentStackParamList, 'OrderDetail'>;

// 008 extends 006's OrderDetail with delivered_at (used for GET); 006 itself
// owns retry-payment (008's contract doesn't redefine it) — two typed
// clients, same base URL/auth, each scoped to the spec that actually owns
// the endpoint being called.
const orderDetailClient = createTypedClient<OrderDetailPaths>();
const retryPaymentClient = createTypedClient<RetryPaymentPaths>();

type OrderDetail = {
  id: string;
  status: 'payment_pending' | 'order_placed' | 'payment_failed' | 'delivered';
  total_amount: number;
  items: { name: string; price: number; quantity: number; line_total: number }[];
  otp: string | null;
  /** specs/008 FR-008 — present only once status = delivered. */
  delivered_at: string | null;
};

const POLL_INTERVAL_MS = 3000;

/**
 * UI Design §4.14 — status-specific content, shared across specs 006/008/010
 * per this screen's own original doc comment: `order_placed` → "Order Placed
 * Successfully" + pickup OTP (FR-013); `payment_failed` → "Payment Failed" +
 * Pay Again (FR-014/FR-015); `payment_pending` → polls until the webhook
 * resolves it, since confirmation is async and never driven by the client
 * redirect alone (FR-011); `delivered` → no OTP (FR-013).
 */
export function OrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await orderDetailClient.GET('/student/orders/{orderId}', { params: { path: { orderId } } });
    if (!error && data) {
      setOrder(data as OrderDetail);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (order?.status !== 'payment_pending') return;
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [order?.status, load]);

  /**
   * specs/010-resume-pending-order-payment. Same underlying action as "Pay
   * Again" on `payment_failed` (spec's own Assumption) — the backend's
   * retry-payment endpoint now accepts both states. Used for a stuck/
   * abandoned `payment_pending` checkout (e.g. the student backed out of
   * Razorpay checkout, or a webhook is simply slow) as well as an outright
   * failure.
   */
  async function handlePayAgain() {
    setRetrying(true);
    setErrorMessage(null);
    try {
      const { data, error } = await retryPaymentClient.POST('/student/orders/{orderId}/retry-payment', {
        params: { path: { orderId } },
      });
      if (error || !data) {
        setErrorMessage((error as { message?: string })?.message ?? 'Could not start a new payment attempt.');
        return;
      }

      const gatewayRef = data.payment_session?.gateway_ref;
      const keyId = getRazorpayKeyId();
      if (gatewayRef && keyId) {
        try {
          await RazorpayCheckout.open({
            key: keyId,
            amount: data.total_amount ?? order?.total_amount ?? 0,
            currency: 'INR',
            order_id: gatewayRef,
            name: 'GenzFeast',
            description: 'Canteen order',
          });
        } catch {
          // Same reasoning as CartScreen — only the webhook decides the real outcome.
        }
      }
      await load();
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return <Screen title="Order Detail" specRef="UI Design §4.14" />;
  }

  if (!order) {
    return (
      <Screen title="Order Detail" specRef="UI Design §4.14">
        <Text className="text-body text-red-600">Order not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Order Detail" subtitle={`Order ${order.id.slice(0, 8).toUpperCase()}`} specRef="UI Design §4.14">
      <View className="gap-3">
        {order.items.map((item, index) => (
          <View key={index} className="flex-row justify-between">
            <Text className="text-body text-text-primary">
              {item.quantity} × {item.name}
            </Text>
            <Text className="text-body text-text-secondary">{formatRupees(item.line_total)}</Text>
          </View>
        ))}
        <View className="flex-row justify-between border-t border-border pt-2">
          <Text className="text-body-bold text-text-primary">Total</Text>
          <Text className="text-price text-text-primary">{formatRupees(order.total_amount)}</Text>
        </View>

        {order.status === 'payment_pending' ? (
          <View className="items-center gap-2 mt-4">
            <ActivityIndicator />
            <Text className="text-body text-text-secondary">Confirming your payment…</Text>
            <Text className="text-caption text-text-secondary text-center">
              Stuck here? If your payment didn't go through, you can resume it below without losing your order.
            </Text>
            {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
            <PrimaryButton label="Resume Payment" onPress={handlePayAgain} loading={retrying} disabled={retrying} />
          </View>
        ) : null}

        {order.status === 'order_placed' ? (
          <View className="items-center gap-2 mt-4">
            <Text className="text-h2 text-green-700">Order Placed Successfully!</Text>
            <Text className="text-caption text-text-secondary">Show this code at the counter to pick up your order</Text>
            <Text className="text-h1 text-primary">{order.otp}</Text>
          </View>
        ) : null}

        {order.status === 'payment_failed' ? (
          <View className="gap-2 mt-4">
            <Text className="text-h2 text-red-600">Payment Failed</Text>
            {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
            <PrimaryButton label="Pay Again" onPress={handlePayAgain} loading={retrying} disabled={retrying} />
          </View>
        ) : null}

        {order.status === 'delivered' ? (
          <View className="items-center gap-1 mt-4">
            <Text className="text-h2 text-text-primary">Delivered ✓</Text>
            {order.delivered_at ? (
              <Text className="text-caption text-text-secondary">
                Picked up on {new Date(order.delivered_at).toLocaleString()}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
