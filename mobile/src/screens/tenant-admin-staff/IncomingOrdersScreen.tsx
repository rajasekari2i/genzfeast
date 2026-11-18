import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius, size } from '../../theme/tokens';
import { createTypedClient } from '../../api/client';
import { getTenantDisplayName } from '../../config/tenant';
import { formatRupees } from '../../theme/money';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/005-staff-order-fulfilment-otp';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'IncomingOrders'>;

const client = createTypedClient<paths>();

type OrderSummary = {
  id: string;
  reference: string;
  item_count: number;
  total_amount: number;
  placed_at: string;
  status: 'order_placed' | 'order_ready';
};

/**
 * The artboard's code tile is drawn around a 4-character code (`7Q2K`), but
 * `reference` is the order id's first 8 characters (api staff-orders.mapper
 * `toReference`) — and the diner's own screen shows all 8, so truncating
 * here would hand staff a shorter string than the one they are matching
 * against. Split into 4-character rows instead: two lines of 4 at the drawn
 * 18px/22 still measure 57px inside the 64px tile (10px `#GF` + 2 x 22),
 * so the geometry survives intact and the whole reference stays readable.
 *
 * Unsplit, 8 characters at 18px overflowed the tile horizontally AND
 * vertically — the wrapped text rendered outside the rounded square.
 */
function toCodeRows(reference: string): string[] {
  return reference.match(/.{1,4}/g) ?? [reference];
}

/** UI Design §5.6 — order id, item count, total, time placed, tap to open (specs/005). */
export function IncomingOrdersScreen({ navigation }: Props) {
  const canteen = getTenantDisplayName();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** The order whose "Ready" tap is in flight — disables just that row's button. */
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await client.GET('/tenant/staff/orders', {});
    if (error) {
      setErrorMessage('Could not load incoming orders.');
    } else {
      // `status` is optional on the wire; an order from an older API with no
      // status is treated as not-yet-ready, which is the safe default — it
      // shows the Ready control rather than silently offering handover.
      setOrders(
        (data ?? [])
          .filter((o) => Boolean(o.id && o.reference))
          .map((o) => ({ ...o, status: o.status ?? 'order_placed' })) as OrderSummary[],
      );
    }
    setLoading(false);
  }, []);

  /**
   * order_placed -> order_ready, which also pushes "Order Ready for Pickup!"
   * to the diner. Reloads rather than patching state locally: the row's
   * whole control set changes with the status, and the list is small.
   */
  async function handleMarkReady(order: OrderSummary) {
    setMarkingId(order.id);
    setErrorMessage(null);
    const { error } = await client.POST('/tenant/staff/orders/{orderId}/ready', {
      params: { path: { orderId: order.id } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not mark the order ready.');
    } else {
      await load();
    }
    setMarkingId(null);
  }

  useEffect(() => {
    load();
    // SC-001: reappear without a manual refresh beyond normal app use —
    // simplest implementation is reloading on focus (covers "opened this
    // screen again after a new order arrived"), rather than a persistent
    // poll/websocket, which this spec leaves as an implementation detail.
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  return (
    <Screen
      surface="admin"
      title="Incoming Orders"
      specRef="UI Design §5.6"
      scroll={false}
      header={
        <AdminPageHeader
          title={'Incoming\norders'}
          /* Canteen only. The artboard draws "<canteen> · Staff", but a
             role is internal authorisation and is shown nowhere in the app
             now — which also settles who this screen belongs to, since
             Company Admin reaches it too. */
          meta={canteen ?? ''}
          /* A drawer ROOT — there is nothing to go back to, so the control is
             a hamburger, per the artboard. */
          onMenu={() => navigation.dispatch(DrawerActions.openDrawer())}
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh orders"
              onPress={() => void load()}
              style={{
                width: size.touch,
                height: size.touch,
                borderRadius: size.touch / 2,
                backgroundColor: colors.navyTint,
              }}
              className="items-center justify-center active:opacity-70"
            >
              <Icon name="refresh" size={20} color={colors.surface} />
            </Pressable>
          }
          pill={
            orders.length > 0 ? (
              <View
                style={{ backgroundColor: colors.primary, borderRadius: radius.pill }}
                className="px-md py-xs"
              >
                <Text className="text-label-bold text-espresso">
                  {orders.length} to hand over
                </Text>
              </View>
            ) : null
          }
        />
      }
    >
      {errorMessage ? <Text className="text-body text-red-strong pb-sm">{errorMessage}</Text> : null}

      {loading ? (
        <ActivityIndicator />
      ) : orders.length === 0 ? (
        <EmptyState icon="🧾" title="No incoming orders" subtitle="New paid orders will show up here." />
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ gap: 10 }}
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item: order }) => (
            /* Oldest first — first-in-first-served at the counter. The code
               tile leads the row because that is what staff match against the
               diner's screen; the reference used to be plain text. */
            /* Tappable only once ready. Readiness is mandatory, so opening
               the handover screen for an order still being cooked would
               lead straight to a refused code — the row offers the one
               action that is actually available instead. */
            <Pressable
              onPress={
                order.status === 'order_ready'
                  ? () => navigation.navigate('OrderFulfilment', { orderId: order.id })
                  : undefined
              }
              disabled={order.status !== 'order_ready'}
              accessibilityRole="button"
              style={{ borderRadius: radius['5xl'], borderWidth: 1, borderColor: colors.borderCard }}
              className="bg-surface p-md flex-row items-center gap-md active:opacity-80"
            >
              {/* overflow:hidden is a backstop, not the fix — toCodeRows keeps
                  the text inside the square. It guarantees a longer
                  reference can never spill over the tile's corners again. */}
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius['2xl'],
                  backgroundColor: colors.espresso,
                  overflow: 'hidden',
                }}
                className="items-center justify-center"
              >
                <Text className="text-micro text-text-on-dark">#GF</Text>
                {toCodeRows(order.reference).map((row) => (
                  <Text key={row} className="text-subtitle-sm text-surface">
                    {row}
                  </Text>
                ))}
              </View>

              <View className="flex-1 gap-glyph">
                <Text className="text-body-bold text-text-primary" numberOfLines={1}>
                  {order.item_count} item{order.item_count === 1 ? '' : 's'}
                </Text>
                <View className="flex-row items-center gap-glyph">
                  <Icon name="clock" size={14} color={colors.textSecondary} />
                  {/* The artboard reads "Placed 12:42 PM" — the bare clock time
                      left it ambiguous whether this was placed-at or a
                      pickup deadline. */}
                  <Text className="text-label text-text-secondary">
                    Placed{' '}
                    {new Date(order.placed_at).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              {/* The artboard's right column is total + chevron. While an
                  order is still being cooked the chevron is replaced by the
                  Ready control: the card is not tappable then, so a chevron
                  would promise a destination that refuses to act. Card
                  height is unchanged either way — the control is sized to
                  the chevron's own row. */}
              <View className="items-end gap-cell">
                <Text className="text-action text-text-primary">{formatRupees(order.total_amount)}</Text>
                {order.status === 'order_ready' ? (
                  <Icon name="chevronRight" size={18} color={colors.espresso} />
                ) : (
                  <Pressable
                    onPress={() => void handleMarkReady(order)}
                    disabled={markingId === order.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark order ${order.reference} ready for pickup`}
                    /* No explicit height: padding sizes it. The nearest size
                       token is `tile` (40), which would push the right
                       column past the 64px code tile and grow every card —
                       and there is no 32-ish token to reach for. Padded,
                       it lands near 26px, so the card's height still comes
                       from the tile exactly as drawn. */
                    style={{
                      borderRadius: radius.pill,
                      backgroundColor: colors.primary,
                      opacity: markingId === order.id ? 0.6 : 1,
                    }}
                    className="px-sm py-xs items-center justify-center active:opacity-70"
                  >
                    {markingId === order.id ? (
                      <ActivityIndicator size="small" color={colors.espresso} />
                    ) : (
                      <Text className="text-label-bold text-espresso">Ready</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
