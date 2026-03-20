import type { MarketplaceId, MarketplaceOrder } from "../types/marketplace";

const CITIES = [
  ["Berlin", "Berlin", "10115"],
  ["Hamburg", "Hamburg", "20095"],
  ["Muenchen", "Bayern", "80331"],
  ["Koeln", "Nordrhein-Westfalen", "50667"],
  ["Frankfurt", "Hessen", "60311"],
] as const;

function hashFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildOrder(
  marketplaceId: MarketplaceId,
  index: number,
  dayOffset: number,
): MarketplaceOrder {
  const location = CITIES[index % CITIES.length];
  const seed = hashFromString(`${marketplaceId}-${index}-${dayOffset}`);
  const amount = 2400 + (seed % 16000);
  const hour = seed % 24;
  const minute = seed % 59;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - dayOffset);
  date.setUTCHours(hour, minute, 0, 0);

  return {
    id: `${marketplaceId}-${dayOffset}-${index}`,
    marketplaceId,
    purchasedAt: date.toISOString(),
    grossAmountCents: amount,
    currency: "EUR",
    paymentStatus: seed % 9 === 0 ? "pending" : "paid",
    returned: seed % 11 === 0,
    buyerCity: location[0],
    buyerRegion: location[1],
    buyerPostalCode: location[2],
    itemsCount: 1 + (seed % 4),
  };
}

export function buildMockOrders(
  marketplaceId: MarketplaceId,
  days = 45,
  ordersPerDay = 5,
): MarketplaceOrder[] {
  const orders: MarketplaceOrder[] = [];

  for (let day = 0; day < days; day += 1) {
    for (let index = 0; index < ordersPerDay; index += 1) {
      orders.push(buildOrder(marketplaceId, index, day));
    }
  }

  return orders;
}

const MOCK_STORE: Record<string, MarketplaceOrder[]> = {
  amazon: buildMockOrders("amazon", 45, 7),
  ebay: buildMockOrders("ebay", 45, 4),
  etsy: buildMockOrders("etsy", 45, 3),
};

export function getMockOrders(marketplaceId: MarketplaceId): MarketplaceOrder[] {
  if (!MOCK_STORE[marketplaceId]) {
    const dailyVolume = 3 + (Math.abs(hashFromString(marketplaceId)) % 5);
    MOCK_STORE[marketplaceId] = buildMockOrders(marketplaceId, 45, dailyVolume);
  }
  return MOCK_STORE[marketplaceId];
}
