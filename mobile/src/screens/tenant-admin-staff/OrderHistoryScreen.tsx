import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DrawerActions, useFocusEffect } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { AdminPageHeader } from '../../components/AdminPageHeader';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { colors, radius } from '../../theme/tokens';
import { createTypedClient } from '../../api/client';
import { getTenantDisplayName } from '../../config/tenant';
import { formatRupees } from '../../theme/money';
import { dayKey, dayName, formatDayDate } from '../../theme/dayLabels';
import type { TenantAdminStaffStackParamList } from '../../navigation/TenantAdminStaffNavigator';
import type { paths } from '../../api/generated/005-staff-order-fulfilment-otp';

type Props = NativeStackScreenProps<TenantAdminStaffStackParamList, 'OrderHistory'>;

const client = createTypedClient<paths>();
const PAGE_LIMIT = 10;

type HistoryOrder = {
  id: string;
  reference: string;
  item_count: number;
  total_amount: number;
  placed_at: string;
  delivered_at: string | null;
};

type DaySection = { title: string; subtitle: string; total: number; data: HistoryOrder[] };

/**
 * When the handover happened. Falls back to placed_at rather than dropping
 * the row — delivered_at is nullable for orders completed before that
 * column existed.
 */
function handoverDate(order: HistoryOrder): Date {
  return new Date(order.delivered_at ?? order.placed_at);
}

/**
 * Groups the ACCUMULATED list into day sections, preserving order (the API
 * already sorts newest-first).
 *
 * Regrouping the whole list on every page is what keeps a day that straddles
 * a page boundary from rendering its header twice — page 2 continuing
 * Tuesday simply lands in the Tuesday section that already exists. It is an
 * O(n) pass over a list the user has chosen to scroll, which is cheaper than
 * the page-aware section-merging state the alternative needs.
 */
function groupByDay(orders: HistoryOrder[], now: Date): DaySection[] {
  const sections: DaySection[] = [];
  const byKey = new Map<string, DaySection>();
  for (const order of orders) {
    const date = handoverDate(order);
    const key = dayKey(date);
    let section = byKey.get(key);
    if (!section) {
      section = { title: dayName(date, now), subtitle: formatDayDate(date), total: 0, data: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.data.push(order);
    section.total += order.total_amount;
  }
  return sections;
}

/**
 * Handed-over orders, grouped by the day of handover — the orders that
 * vanish from Incoming the moment a pickup code is accepted.
 *
 * Server-side paginated at 10, appending on scroll, the same shape
 * ProductListScreen uses. No artboard exists for this screen; it borrows
 * the navy AdminPageHeader and the Incoming-orders row so it reads as part
 * of the same back-of-house surface.
 */
export function OrderHistoryScreen({ navigation }: Props) {
  const canteen = getTenantDisplayName();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pageRef = useRef(1);

  /**
   * Pinned once per load rather than read per row: `dayName` compares
   * against "now", and a list rendering across midnight would otherwise
   * label two rows from the same minute differently.
   */
  const [now, setNow] = useState(() => new Date());

  const loadPage = useCallback(async (page: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setErrorMessage(null);

    const { data, error } = await client.GET('/tenant/staff/orders/history', {
      params: { query: { page, limit: PAGE_LIMIT } },
    });
    if (error) {
      setErrorMessage((error as { message?: string })?.message ?? 'Could not load order history.');
    } else if (data) {
      const items = (data.items ?? []).filter((o): o is HistoryOrder => Boolean(o.id && o.reference));
      setOrders((prev) => (append ? [...prev, ...items] : items));
      setHasMore(page * (data.limit ?? PAGE_LIMIT) < (data.total ?? 0));
      setTotal(data.total ?? undefined);
      pageRef.current = page;
    }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      loadPage(1, false);
    }, [loadPage]),
  );

  const sections = useMemo(() => groupByDay(orders, now), [orders, now]);

  function handleEndReached() {
    if (!hasMore || loadingMore || loading) return;
    loadPage(pageRef.current + 1, true);
  }

  return (
    <Screen
      surface="admin"
      title="Order History"
      scroll={false}
      header={
        <AdminPageHeader
          title="Order history"
          subtitle={canteen}
          count={total !== undefined ? `${total} ${total === 1 ? 'order' : 'orders'}` : undefined}
          onBack={() => {
            // Reached either from the drawer (nothing to pop) or pushed from
            // Incoming orders — same two-way rule ProductListScreen documents.
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.dispatch(DrawerActions.openDrawer());
          }}
        />
      }
    >
      {errorMessage ? <Text className="text-body text-red-strong pb-sm">{errorMessage}</Text> : null}

      {loading ? (
        <ActivityIndicator />
      ) : orders.length === 0 ? (
        <EmptyState icon="🧾" title="No orders handed over yet" subtitle="Completed pickups will appear here." />
      ) : (
        <SectionList
          className="flex-1"
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReachedThreshold={0.5}
          onEndReached={handleEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="my-3" /> : null}
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-baseline justify-between pt-md pb-sm">
              <View className="flex-row items-baseline gap-xs">
                <Text className="text-body-bold text-text-primary">{section.title}</Text>
                {/* The date always shows beside "Today"/"Monday" — staff
                    reading a day's takings should not have to work out the
                    date. Suppressed when the title IS the date (anything
                    older than a week), which otherwise rendered it twice:
                    "Nov 11, 2026  Nov 11, 2026". */}
                {section.subtitle !== section.title ? (
                  <Text className="text-caption text-text-secondary">{section.subtitle}</Text>
                ) : null}
              </View>
              <Text className="text-label-bold text-text-body">{formatRupees(section.total)}</Text>
            </View>
          )}
          renderItem={({ item: order }) => (
            <View
              style={{ borderRadius: radius['5xl'], borderWidth: 1, borderColor: colors.borderCard }}
              className="bg-surface p-md flex-row items-center gap-md mb-cell"
            >
              <View
                style={{ width: 56, height: 56, borderRadius: radius['2xl'], backgroundColor: colors.espresso, overflow: 'hidden' }}
                className="items-center justify-center"
              >
                <Text className="text-micro text-text-on-dark">#GF</Text>
                {/* Same 4-character rows as the Incoming card: 8 characters
                    at once overflow a tile this size. */}
                {(order.reference.match(/.{1,4}/g) ?? [order.reference]).map((row) => (
                  <Text key={row} className="text-label-bold text-surface">
                    {row}
                  </Text>
                ))}
              </View>

              <View className="flex-1 gap-glyph">
                <Text className="text-body-bold text-text-primary" numberOfLines={1}>
                  {order.item_count} item{order.item_count === 1 ? '' : 's'}
                </Text>
                <View className="flex-row items-center gap-glyph">
                  <Icon name="check" size={14} color={colors.textSecondary} />
                  <Text className="text-label text-text-secondary">
                    Handed over{' '}
                    {handoverDate(order).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              </View>

              <Text className="text-action text-text-primary">{formatRupees(order.total_amount)}</Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
