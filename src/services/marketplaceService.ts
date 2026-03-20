import { applyDateRange, applyRegionFilter, computeMetrics, getPreviousDateRange } from "../lib/kpi";
import { getSupabaseClient } from "../lib/supabaseClient";
import { getMockOrders } from "./mockData";
import type { DateRange, MarketplaceDefinition, MarketplaceOrder } from "../types/marketplace";
import type { MarketplaceMetrics } from "../types/metrics";

interface QueryInput {
  marketplace: MarketplaceDefinition;
  range: DateRange;
  region: string;
}

export interface MarketplaceSectionData {
  orders: MarketplaceOrder[];
  metrics: MarketplaceMetrics;
  dataSource: "supabase" | "mock";
}

export interface AmazonSyncResult {
  syncedRecords: number;
  source: "amazon-sp-api" | "manual-payload";
}

export interface AmazonSellerHealth {
  score: number | null;
  orderDefectRatePct: number | null;
  orderDefectRate7dPct: number | null;
  orderDefectRate30dPct: number | null;
  lateShipmentRatePct: number | null;
  lateShipmentRate7dPct: number | null;
  lateShipmentRate30dPct: number | null;
  preFulfillmentCancelRatePct: number | null;
  preFulfillmentCancelRate7dPct: number | null;
  preFulfillmentCancelRate30dPct: number | null;
  policyWarnings: number | null;
  updatedAt: string | null;
  source: "amazon-sp-api" | "mock" | "unknown";
}

interface SyncAmazonOptions {
  maxOrders?: number;
  orderIds?: string[];
}

function parsePaymentStatus(rawValue: unknown, grossAmountCents: number): "paid" | "pending" {
  const value = String(rawValue ?? "paid").toLowerCase();
  if (value.includes("pending") || value.includes("open") || value.includes("unpaid") || value.includes("awaiting")) {
    return "pending";
  }
  // If no explicit payment status exists, zero-value Amazon records are typically not yet paid.
  if ((rawValue === null || rawValue === undefined || rawValue === "") && grossAmountCents <= 0) {
    return "pending";
  }
  return "paid";
}

function mapSupabaseOrderRow(row: Record<string, unknown>): MarketplaceOrder {
  const grossAmountCents = Number(row.gross_amount_cents ?? 0);
  return {
    // Show marketplace-native order number in UI (e.g. 302-2233584-2351501).
    id: String(row.external_order_id ?? row.id),
    marketplaceId: String(row.marketplace_id) as MarketplaceOrder["marketplaceId"],
    purchasedAt: String(row.purchased_at),
    grossAmountCents,
    currency: String(row.currency ?? "EUR"),
    paymentStatus: parsePaymentStatus(row.payment_status, grossAmountCents),
    returned: Boolean(row.returned),
    buyerCity: String(row.buyer_city ?? ""),
    buyerRegion: String(row.buyer_region ?? ""),
    buyerPostalCode: String(row.buyer_postal_code ?? ""),
    itemsCount: Number(row.items_count ?? 0),
  };
}

function toRecord(row: unknown): Record<string, unknown> {
  if (typeof row === "object" && row !== null) {
    return row as Record<string, unknown>;
  }
  return {};
}

async function fetchFromSupabase(
  marketplaceId: string,
  range: DateRange,
): Promise<MarketplaceOrder[] | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const fromIso = `${range.from}T00:00:00.000Z`;
  const toIso = `${range.to}T23:59:59.999Z`;

  const baseSelect =
    "id, external_order_id, marketplace_id, purchased_at, gross_amount_cents, currency, returned, buyer_city, buyer_region, buyer_postal_code, items_count";

  const withPaymentSelect = `${baseSelect}, payment_status`;

  const queryBuilder = (selectClause: string) =>
    client
      .from("marketplace_orders")
      .select(selectClause)
      .eq("marketplace_id", marketplaceId)
      .gte("purchased_at", fromIso)
      .lte("purchased_at", toIso)
      .order("purchased_at", { ascending: true });

  const { data, error } = await queryBuilder(withPaymentSelect);
  if (error && error.message.toLowerCase().includes("payment_status")) {
    const fallback = await queryBuilder(baseSelect);
    if (fallback.error || !fallback.data) {
      return null;
    }
    return fallback.data.map((row) => mapSupabaseOrderRow(toRecord(row))) as MarketplaceOrder[];
  }

  if (error || !data) {
    return null;
  }

  return data.map((row) => mapSupabaseOrderRow(toRecord(row))) as MarketplaceOrder[];
}

export async function getMarketplaceSectionData(
  input: QueryInput,
): Promise<MarketplaceSectionData> {
  const previousRange = getPreviousDateRange(input.range);
  const fallbackOrders = getMockOrders(input.marketplace.id);

  const liveOrders =
    input.marketplace.id === "amazon"
      ? await fetchFromSupabase(input.marketplace.id, input.range)
      : null;

  const sourceOrders = liveOrders ?? fallbackOrders;
  const currentPeriod = applyRegionFilter(applyDateRange(sourceOrders, input.range), input.region);
  const previousPeriod = applyRegionFilter(
    applyDateRange(sourceOrders, previousRange),
    input.region,
  );

  // Orders with pending payment stay visible in lists, but do not count into KPI totals.
  const currentPaidOrders = currentPeriod.filter((order) => order.paymentStatus !== "pending");
  const previousPaidOrders = previousPeriod.filter((order) => order.paymentStatus !== "pending");
  const metricsBase = computeMetrics(currentPaidOrders, previousPaidOrders);

  return {
    orders: currentPeriod,
    metrics: {
      marketplaceId: input.marketplace.id,
      ...metricsBase,
    },
    dataSource: liveOrders ? "supabase" : "mock",
  };
}

export function getRegionsFromOrders(orders: MarketplaceOrder[]): string[] {
  return [...new Set(orders.map((order) => order.buyerRegion))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function syncAmazonOrders(
  range: DateRange,
  options?: SyncAmazonOptions,
): Promise<AmazonSyncResult> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase Client ist nicht konfiguriert.");
  }

  const { data, error } = await client.functions.invoke("amazon-sync", {
    body: {
      mode: "sync",
      from: range.from,
      to: range.to,
      maxOrders: options?.maxOrders ?? 250,
      orderIds: options?.orderIds,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    syncedRecords: Number(data?.syncedRecords ?? 0),
    source: (data?.source as AmazonSyncResult["source"]) ?? "amazon-sp-api",
  };
}

function toPctValue(input: unknown): number | null {
  const value = Number(input);
  if (!Number.isFinite(value)) {
    return null;
  }
  // Accept both fractional values (0.012) and plain percentages (1.2).
  return value <= 1 ? value * 100 : value;
}

function toNullableNumber(input: unknown): number | null {
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

export async function fetchAmazonSellerHealth(): Promise<AmazonSellerHealth | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.functions.invoke("amazon-sync", {
    body: {
      mode: "health",
    },
  });

  if (error || !data) {
    return null;
  }

  return {
    score: toNullableNumber(data?.score ?? data?.healthScore),
    orderDefectRatePct: toPctValue(data?.orderDefectRate ?? data?.odr),
    orderDefectRate7dPct: toPctValue(data?.orderDefectRate7d),
    orderDefectRate30dPct: toPctValue(data?.orderDefectRate30d),
    lateShipmentRatePct: toPctValue(data?.lateShipmentRate ?? data?.lsr),
    lateShipmentRate7dPct: toPctValue(data?.lateShipmentRate7d),
    lateShipmentRate30dPct: toPctValue(data?.lateShipmentRate30d),
    preFulfillmentCancelRatePct: toPctValue(
      data?.preFulfillmentCancelRate ?? data?.cancellationRate,
    ),
    preFulfillmentCancelRate7dPct: toPctValue(data?.preFulfillmentCancelRate7d),
    preFulfillmentCancelRate30dPct: toPctValue(data?.preFulfillmentCancelRate30d),
    policyWarnings: toNullableNumber(data?.policyWarnings),
    updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
    source:
      data?.source === "amazon-sp-api" || data?.source === "mock"
        ? data.source
        : "unknown",
  };
}
