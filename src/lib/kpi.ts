import type { DateRange, MarketplaceOrder } from "../types/marketplace";
import type {
  DailySalesPoint,
  HourlyPurchasePoint,
  LocationPoint,
  MarketplaceMetrics,
} from "../types/metrics";

const CENT_FACTOR = 100;
export const DASHBOARD_TIMEZONE = "Europe/Berlin";

function toDateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: DASHBOARD_TIMEZONE,
  }).format(new Date(isoDate));
}

function formatBucketKey(order: MarketplaceOrder): string {
  return `${order.buyerPostalCode}|${order.buyerCity}|${order.buyerRegion}`;
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / CENT_FACTOR);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getPreviousDateRange(current: DateRange): DateRange {
  const start = new Date(current.from);
  const end = new Date(current.to);
  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime());
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    from: previousStart.toISOString().slice(0, 10),
    to: previousEnd.toISOString().slice(0, 10),
  };
}

export function applyDateRange(
  orders: MarketplaceOrder[],
  range: DateRange,
): MarketplaceOrder[] {
  const from = new Date(`${range.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${range.to}T23:59:59.999Z`).getTime();

  return orders.filter((order) => {
    const orderTime = new Date(order.purchasedAt).getTime();
    return orderTime >= from && orderTime <= to;
  });
}

export function applyRegionFilter(
  orders: MarketplaceOrder[],
  region: string,
): MarketplaceOrder[] {
  if (region === "all") {
    return orders;
  }
  return orders.filter((order) => order.buyerRegion === region);
}

function buildDailySales(orders: MarketplaceOrder[]): DailySalesPoint[] {
  const map = new Map<string, DailySalesPoint>();

  for (const order of orders) {
    const date = toDateLabel(order.purchasedAt);
    const existing = map.get(date);
    if (!existing) {
      map.set(date, { date, revenueCents: order.grossAmountCents, orders: 1 });
      continue;
    }
    existing.revenueCents += order.grossAmountCents;
    existing.orders += 1;
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function buildHourlyPurchases(orders: MarketplaceOrder[]): HourlyPurchasePoint[] {
  const histogram = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    purchases: 0,
  }));
  const hourFormatter = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: DASHBOARD_TIMEZONE,
  });

  for (const order of orders) {
    const hourText = hourFormatter.format(new Date(order.purchasedAt));
    const hour = Number.parseInt(hourText, 10);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) {
      continue;
    }
    histogram[hour].purchases += 1;
  }
  return histogram;
}

function buildLocationBreakdown(orders: MarketplaceOrder[]): LocationPoint[] {
  const map = new Map<string, LocationPoint>();

  for (const order of orders) {
    const key = formatBucketKey(order);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        city: order.buyerCity,
        region: order.buyerRegion,
        postalCode: order.buyerPostalCode,
        orders: 1,
        revenueCents: order.grossAmountCents,
      });
      continue;
    }
    existing.orders += 1;
    existing.revenueCents += order.grossAmountCents;
  }

  return [...map.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 10);
}

export function computeMetrics(
  orders: MarketplaceOrder[],
  previousOrders: MarketplaceOrder[],
): Omit<MarketplaceMetrics, "marketplaceId"> {
  const revenueCents = orders.reduce((sum, order) => sum + order.grossAmountCents, 0);
  const returnedOrders = orders.filter((order) => order.returned).length;
  const totalOrders = orders.length;
  const previousRevenueCents = previousOrders.reduce(
    (sum, order) => sum + order.grossAmountCents,
    0,
  );
  const returnRate = totalOrders === 0 ? 0 : returnedOrders / totalOrders;
  const averageOrderValueCents = totalOrders === 0 ? 0 : revenueCents / totalOrders;
  const revenueDeltaPct =
    previousRevenueCents === 0
      ? 1
      : (revenueCents - previousRevenueCents) / previousRevenueCents;

  return {
    revenueCents,
    returnedOrders,
    orders: totalOrders,
    returnRate,
    averageOrderValueCents,
    previousRevenueCents,
    revenueDeltaPct,
    dailySales: buildDailySales(orders),
    hourlyPurchases: buildHourlyPurchases(orders),
    locationBreakdown: buildLocationBreakdown(orders),
  };
}
