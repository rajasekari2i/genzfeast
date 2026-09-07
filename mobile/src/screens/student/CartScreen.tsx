import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import RazorpayCheckout from 'react-native-razorpay';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { EmptyState } from '../../components/EmptyState';
import { createTypedClient } from '../../api/client';
import { useCart } from '../../cart/CartContext';
import { formatRupees } from '../../theme/money';
import { getRazorpayKeyId } from '../../config/tenant';
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

      if (gatewayRef && keyId) {
        try {
          await RazorpayCheckout.open({
            key: keyId,
            amount: data.total_amount ?? totalInPaise,
            currency: 'INR',
            order_id: gatewayRef,
            name: 'GenzFeast',
            description: 'Canteen order',
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
    <Screen title="Cart" specRef="UI Design §4.6">
      <View className="gap-3">
        {lines.map(({ product, quantity }) => (
          <View
            key={product.id}
            className={`border-b border-border pb-3 ${unavailableIds.includes(product.id) ? 'opacity-60' : ''}`}
          >
            <View className="flex-row justify-between">
              <Text className="text-body-bold text-text-primary flex-1" numberOfLines={1}>
                {product.name}
              </Text>
              <Text className="text-price text-text-primary">{formatRupees(product.price * quantity)}</Text>
            </View>
            <Text className="text-caption text-text-secondary" numberOfLines={1}>
              {product.description}
            </Text>
            {unavailableIds.includes(product.id) ? (
              <Text className="text-caption text-red-600">No longer available</Text>
            ) : (
              <View className="flex-row items-center gap-3 mt-1">
                <Text className="text-body text-primary" onPress={() => setQuantity(product.id, quantity - 1)}>
                  −
                </Text>
                <Text className="text-body text-text-primary">{quantity}</Text>
                <Text className="text-body text-primary" onPress={() => setQuantity(product.id, quantity + 1)}>
                  +
                </Text>
              </View>
            )}
          </View>
        ))}

        <View className="flex-row justify-between pt-1">
          <Text className="text-h2 text-text-primary">Total Amount</Text>
          <Text className="text-h2 text-text-primary">{formatRupees(totalInPaise)}</Text>
        </View>

        <Text className="text-caption text-text-secondary">Fulfilment: Canteen Pickup</Text>
        <Text className="text-caption text-text-secondary">Payment: UPI via Razorpay (only option in V1)</Text>

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}

        <PrimaryButton label="Place Order" onPress={handlePlaceOrder} loading={placing} disabled={placing} />
      </View>
    </Screen>
  );
}
