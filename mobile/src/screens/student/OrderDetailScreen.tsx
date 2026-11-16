import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RazorpayCheckout from 'react-native-razorpay';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, size } from '../../theme/tokens';
import { tile } from '../../theme/accents';
import { OtpDisplay } from '../../components/OtpDisplay';
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
  placed_at: string | null;
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
export function OrderDetailScreen({ route, navigation }: Props) {
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
        <Text className="text-body text-red-strong">Order not found.</Text>
      </Screen>
    );
  }

  const reference = `#${order.id.slice(0, 8).toUpperCase()}`;
  const when = order.placed_at
    ? new Date(order.placed_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const itemsCard = (
    <View
      style={{ borderRadius: radius['5xl'], borderWidth: 1, borderColor: colors.border }}
      className="bg-surface p-md gap-sm"
    >
      {order.items.map((item, index) => (
        <View key={index} className="flex-row items-center gap-sm">
          <View
            style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.disabledFill }}
            className="items-center justify-center"
          >
            <Text className="text-label-bold text-text-primary">{item.quantity}×</Text>
          </View>
          <View className="flex-1">
            <Text className="text-body text-text-primary">{item.name}</Text>
            <Text className="text-caption text-text-secondary">{formatRupees(item.price)} each</Text>
          </View>
          <Text className="text-body-bold text-text-primary">{formatRupees(item.line_total)}</Text>
        </View>
      ))}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View className="flex-row justify-between">
        <Text className="text-label text-text-body">Fulfilment</Text>
        <Text className="text-label-bold text-text-primary">Canteen Pickup</Text>
      </View>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-label-lg text-text-body">Total amount</Text>
        <Text className="text-display-xs text-text-primary">{formatRupees(order.total_amount)}</Text>
      </View>
    </View>
  );

  // Section 08 — a just-placed order. Whole screen on brand, the pickup code
  // as the hero, then a compact summary and "Back to home".
  if (order.status === 'order_placed') {
    return (
      <Screen title="Order placed" surface="brand" scroll={false}>
        <View className="flex-1 gap-md">
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius['4xl'],
              backgroundColor: colors.espresso,
              transform: [{ rotate: '-6deg' }],
            }}
            className="items-center justify-center"
          >
            <Icon name="check" size={32} color={colors.accent} />
          </View>
          <View className="gap-xs">
            <Text className="text-hero-lg text-espresso">Order{'\n'}placed!</Text>
            <Text className="text-body-lg text-espresso">
              Payment received. Head to the counter when you're ready.
            </Text>
          </View>

          {order.otp ? (
            <OtpDisplay code={order.otp} footer="Also in My Orders until it's delivered." />
          ) : null}

          <View
            style={{ borderRadius: radius['5xl'], backgroundColor: colors.surface }}
            className="p-md gap-sm"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-label text-text-body">Order {reference}</Text>
              <StatusBadge status="order_placed" />
            </View>
            {order.items.map((item, index) => (
              <View key={index} className="flex-row justify-between">
                <Text className="text-label text-text-primary">
                  {item.quantity} × {item.name}
                </Text>
                <Text className="text-label text-text-body">{formatRupees(item.line_total)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View className="flex-row justify-between">
              <Text className="text-body-bold text-text-primary">Total</Text>
              <Text className="text-body-bold text-text-primary">{formatRupees(order.total_amount)}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => navigation.getParent()?.navigate('Home' as never)}
            accessibilityRole="button"
            style={{ height: 56, backgroundColor: colors.espresso, borderRadius: radius.pill }}
            className="mt-auto items-center justify-center"
          >
            <Text className="text-price text-surface">Back to home</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // Sections 10 and the pending/delivered states — cream ground, a header row
  // with the reference, time and status badge, then status-specific content.
  return (
    <Screen title="Order Detail" subtitle={reference} scroll={false}>
      <View className="flex-1 gap-md">
        <View className="flex-row items-center gap-sm">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ borderWidth: 1, borderColor: colors.borderSoft }}
            className="w-touch h-touch rounded-pill bg-surface items-center justify-center"
          >
            <Icon name="chevronLeft" size={20} color={colors.espresso} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-title-sm text-text-primary">{reference}</Text>
            {when ? <Text className="text-caption text-text-secondary">{when}</Text> : null}
          </View>
          <StatusBadge status={order.status} />
        </View>

        {order.status === 'payment_failed' ? (
          <View
            style={{ borderRadius: radius['5xl'], backgroundColor: tile('red').backgroundColor }}
            className="flex-row gap-sm p-md"
          >
            <View
              style={{ width: size.touch, height: size.touch, borderRadius: radius.lg, backgroundColor: colors.danger }}
              className="items-center justify-center"
            >
              <Icon name="close" size={20} color={colors.surface} />
            </View>
            <View className="flex-1 gap-glyph">
              <Text className="text-body-bold" style={{ color: tile('red').color }}>
                Payment didn't go through
              </Text>
              <Text className="text-label" style={{ color: tile('red').color }}>
                Your order is saved. Pay again to complete this same order — no duplicate is created.
              </Text>
            </View>
          </View>
        ) : null}

        {itemsCard}

        {order.status === 'payment_pending' ? (
          <View className="items-center gap-xs">
            <ActivityIndicator />
            <Text className="text-label text-text-secondary text-center">
              Confirming your payment… if it didn't go through, resume it below.
            </Text>
          </View>
        ) : null}

        {order.status === 'delivered' && order.delivered_at ? (
          <Text className="text-label text-text-secondary text-center">
            Picked up on {new Date(order.delivered_at).toLocaleString()}
          </Text>
        ) : null}

        {errorMessage ? <Text className="text-body text-red-strong">{errorMessage}</Text> : null}

        {order.status === 'payment_failed' || order.status === 'payment_pending' ? (
          <View className="mt-auto gap-sm">
            <Pressable
              onPress={handlePayAgain}
              disabled={retrying}
              accessibilityRole="button"
              style={{ height: 56, backgroundColor: colors.primary, borderRadius: radius.pill, opacity: retrying ? 0.6 : 1 }}
              className="items-center justify-center"
            >
              <Text className="text-price text-espresso">
                {order.status === 'payment_failed' ? 'Pay again' : 'Resume payment'} · {formatRupees(order.total_amount)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.getParent()?.navigate('Home' as never)}
              accessibilityRole="button"
              style={{ height: 56, borderWidth: 1.5, borderColor: colors.espresso, borderRadius: radius.pill }}
              className="items-center justify-center"
            >
              <Text className="text-price text-text-primary">Back to home</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
