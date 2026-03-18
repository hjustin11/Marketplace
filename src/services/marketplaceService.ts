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

interface SyncAmazonOptions {
  maxOrders?: number;
  orderIds?: string[];
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

  const { data, error } = await client
    .from("marketplace_orders")
    .select(
      "id, marketplace_id, purchased_at, gross_amount_cents, currency, returned, buyer_city, buyer_region, buyer_postal_code, items_count",
    )
    .eq("marketplace_id", marketplaceId)
    .gte("purchased_at", fromIso)
    .lte("purchased_at", toIso)
    .order("purchased_at", { ascending: true });

  if (error || !data) {
    return null;
  }

  return data.map((row) => ({
    id: String(row.id),
    marketplaceId: row.marketplace_id,
    purchasedAt: row.purchased_at,
    grossAmountCents: row.gross_amount_cents,
    currency: row.currency,
    returned: row.returned,
    buyerCity: row.buyer_city,
    buyerRegion: row.buyer_region,
    buyerPostalCode: row.buyer_postal_code,
    itemsCount: row.items_count,
  })) as MarketplaceOrder[];
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
  const metricsBase = computeMetrics(currentPeriod, previousPeriod);

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
