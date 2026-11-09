import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RazorpayCheckout from 'react-native-razorpay';
import { Screen } from '../../components/Screen';
import { Icon } from '../../components/Icon';
import { productTint, tile } from '../../theme/accents';
import { colors, radius } from '../../theme/tokens';
import { EmptyState } from '../../components/EmptyState';
import { createTypedClient } from '../../api/client';
import { useCart } from '../../cart/CartContext';
import { formatRupees } from '../../theme/money';
import { getRazorpayConfigId, getRazorpayKeyId } from '../../config/tenant';
import type { StudentStackParamList } from '../../navigation/StudentNavigator';
import type { paths } from '../../api/generated/006-student-browse-cart-checkout';

type Props = NativeStackScreenProps<StudentStackParamList, 'Cart'>;

const client = createTypedClient<paths>();

type Product = { id: string; name: string; description: string; price: number };

/**
 * UI Design §4.6 — line items, Total Amount, payment method selector
 * (auto-selected, single V1 option), Place Order. On success, launches
 * Razorpay checkout — but the order's actual status always comes from the
 * backend webhook (FR-011), never the checkout SDK's own resolve/reject, so
 * both branches below land on OrderDetailScreen and let it show whatever
 * the server currently reports.
 */
export function CartScreen({ navigation }: Props) {
  const { quantities, setQuantity, clear } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await client.GET('/student/products', {});
      if (!error && data) {
        setProducts(data.filter((p): p is Product => Boolean(p.id && p.name)) as Product[]);
      }
      setLoading(false);
    })();
  }, []);

  const lines = products
    .filter((p) => (quantities[p.id] ?? 0) > 0)
    .map((p) => ({ product: p, quantity: quantities[p.id] }));
  const totalInPaise = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  async function handlePlaceOrder() {
    if (lines.length === 0) return;
    setPlacing(true);
    setErrorMessage(null);
    setUnavailableIds([]);
    try {
      const { data, error, response } = await client.POST('/student/orders', {
        body: { items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })) },
      });

      if (error || !data?.id) {
        const body = (error ?? {}) as { message?: string; unavailable_product_ids?: string[] };
        if (response.status === 409 && body.unavailable_product_ids) {
          setUnavailableIds(body.unavailable_product_ids);
          setErrorMessage(body.message ?? 'Some items in your cart are no longer available.');
        } else {
          setErrorMessage(body.message ?? 'Could not place your order. Please try again.');
        }
        return;
      }

      const orderId = data.id;
      const gatewayRef = data.payment_session?.gateway_ref;
      const keyId = getRazorpayKeyId();
      const configId = getRazorpayConfigId();

      if (gatewayRef && keyId) {
        try {
          await RazorpayCheckout.open({
            key: keyId,
            amount: data.total_amount ?? totalInPaise,
            currency: 'INR',
            order_id: gatewayRef,
            name: 'GenzFeast',
            description: 'Canteen order',
            // BRD/PRD V1 scope: UPI-only. `method` is what the React Native
            // Standard SDK actually documents/enforces; config_id (Dashboard
            // Payment Methods Configuration) is sent too in case a future
            // SDK version honors it, but isn't relied on alone — a live test
            // showed a wallet (Airtel Money) payment going through with
            // config_id set but no `method` restriction.
            method: {
              upi: '1',
              card: '0',
              netbanking: '0',
              wallet: '0',
              paylater: '0',
            },
            ...(configId ? { config_id: configId } : {}),
          });
        } catch {
          // User cancelled or the SDK reported a failure — irrelevant to
          // what actually happened at the gateway (FR-011): the order's
          // real status only ever comes from the backend webhook.
        }
      } else {
        Alert.alert('Payment not configured', 'Razorpay is not set up on this build yet. Showing your order as-is.');
      }

      clear();
      navigation.replace('OrderDetail', { orderId });
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return <Screen title="Cart" specRef="UI Design §4.6" />;
  }

  if (lines.length === 0) {
    return (
      <Screen title="Cart" specRef="UI Design §4.6">
        <EmptyState icon="🛒" title="Your cart is empty" subtitle="Add items from Home to get started." />
      </Screen>
    );
  }

  return (
    <Screen title="Cart" specRef="UI Design §4.6" scroll={false}>
      <View className="flex-1">
        {/* Section 07. Header row, line cards with a tint tile + stepper, a
            fulfilment/total card, and a white pinned footer carrying the UPI
            option and Place order. */}
        <View className="flex-row items-center gap-sm pb-md">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ borderWidth: 1, borderColor: colors.borderSoft }}
            className="w-touch h-touch rounded-pill bg-surface items-center justify-center"
          >
            <Icon name="chevronLeft" size={20} color={colors.espresso} />
          </Pressable>
          <Text className="flex-1 text-title text-text-primary">Your cart</Text>
          <View
            style={{ borderWidth: 1, borderColor: colors.borderSoft }}
            className="bg-surface rounded-pill px-md py-xs"
          >
            <Text className="text-label text-text-primary">
              {lines.length} {lines.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>

        <View className="flex-1">
          <View className="gap-sm">
            {lines.map(({ product, quantity }) => {
              const gone = unavailableIds.includes(product.id);
              return (
                <View
                  key={product.id}
                  style={{ borderRadius: radius['4xl'], borderWidth: 1, borderColor: colors.border, opacity: gone ? 0.6 : 1 }}
                  className="bg-surface p-sm flex-row items-center gap-sm"
                >
                  <View
                    style={{ width: 64, height: 64, borderRadius: radius.xl, backgroundColor: productTint(product.id) }}
                    className="items-center justify-center"
                  >
                    <Icon name="cloche" size={28} color={colors.textBody} />
                  </View>
                  <View className="flex-1 gap-glyph">
                    <Text className="text-body-bold text-text-primary" numberOfLines={1}>{product.name}</Text>
                    {product.description ? (
                      <Text className="text-caption text-text-secondary" numberOfLines={1}>{product.description}</Text>
                    ) : null}
                    <Text className="text-caption text-text-secondary">{formatRupees(product.price)} each</Text>
                  </View>
                  <View className="items-end gap-xs">
                    <Text className="text-body-bold text-text-primary">{formatRupees(product.price * quantity)}</Text>
                    {gone ? (
                      <Text className="text-caption text-red-strong">Unavailable</Text>
                    ) : (
                      <View
                        style={{ height: 36, backgroundColor: colors.disabledFill, borderRadius: radius.pill }}
                        className="flex-row items-center"
                      >
                        <Pressable
                          onPress={() => setQuantity(product.id, quantity - 1)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove one ${product.name}`}
                          style={{ width: 34, height: 36 }}
                          className="items-center justify-center"
                        >
                          <Icon name="chevronLeft" size={14} color={colors.espresso} />
                        </Pressable>
                        <Text className="text-label-bold text-text-primary" style={{ minWidth: 14, textAlign: 'center' }}>
                          {quantity}
                        </Text>
                        <Pressable
                          onPress={() => setQuantity(product.id, quantity + 1)}
                          accessibilityRole="button"
                          accessibilityLabel={`Add one ${product.name}`}
                          style={{ width: 34, height: 36 }}
                          className="items-center justify-center"
                        >
                          <Icon name="plus" size={14} color={colors.espresso} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <View
              style={{ borderRadius: radius['4xl'], borderWidth: 1, borderColor: colors.border }}
              className="bg-surface p-md gap-md mt-sm"
            >
              <View className="flex-row items-center gap-sm">
                <View
                  style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: tile('sun').backgroundColor }}
                  className="items-center justify-center"
                >
                  <Icon name="pin" size={19} color={tile('sun').color} />
                </View>
                <View className="flex-1">
                  <Text className="text-caption text-text-secondary">Fulfilment</Text>
                  <Text className="text-body-bold text-text-primary">Canteen Pickup</Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View className="flex-row items-baseline justify-between">
                <Text className="text-label-lg text-text-body">Total amount</Text>
                <Text className="text-display-xs text-text-primary">{formatRupees(totalInPaise)}</Text>
              </View>
            </View>

            {errorMessage ? <Text className="text-body text-red-strong pt-sm">{errorMessage}</Text> : null}
          </View>
        </View>

        {/* Pinned white footer — the artboard bleeds it edge-to-edge with a
            rounded top. Negative margins cancel Screen's p-md so it meets the
            screen edges. */}
        <View
          style={{
            marginHorizontal: -16,
            marginBottom: -16,
            borderTopLeftRadius: radius['6xl'],
            borderTopRightRadius: radius['6xl'],
            borderTopWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
          className="flex-row items-center gap-sm px-md pt-md pb-lg"
        >
          <View
            style={{ height: 56, borderWidth: 1.5, borderColor: colors.espresso, borderRadius: radius['2xl'] }}
            className="flex-1 flex-row items-center gap-sm px-md"
          >
            <View
              style={{ width: 18, height: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.espresso }}
              className="items-center justify-center"
            >
              <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.espresso }} />
            </View>
            <View>
              <Text className="text-label-bold text-text-primary">UPI</Text>
              <Text className="text-caption text-text-secondary">via Razorpay</Text>
            </View>
          </View>
          <Pressable
            onPress={handlePlaceOrder}
            disabled={placing}
            accessibilityRole="button"
            style={{ height: 56, backgroundColor: colors.espresso, borderRadius: radius.pill, opacity: placing ? 0.6 : 1 }}
            className="px-lg flex-row items-center gap-xs"
          >
            <Text className="text-price text-surface">Place order</Text>
            <Icon name="arrowRight" size={16} color={colors.surface} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}
