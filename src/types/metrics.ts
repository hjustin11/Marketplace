import type { MarketplaceId } from "./marketplace";

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  helper?: string;
}

export interface DailySalesPoint {
  date: string;
  revenueCents: number;
  orders: number;
}

export interface HourlyPurchasePoint {
  hour: number;
  purchases: number;
}

export interface LocationPoint {
  key: string;
  city: string;
  region: string;
  postalCode: string;
  orders: number;
  revenueCents: number;
}

export interface MarketplaceMetrics {
  marketplaceId: MarketplaceId;
  revenueCents: number;
  returnedOrders: number;
  orders: number;
  returnRate: number;
  averageOrderValueCents: number;
  previousRevenueCents: number;
  revenueDeltaPct: number;
  dailySales: DailySalesPoint[];
  hourlyPurchases: HourlyPurchasePoint[];
  locationBreakdown: LocationPoint[];
}
