export type MarketplaceId = "amazon" | "ebay" | "etsy";

export type MarketplaceMode = "live" | "mock";

export interface MarketplaceDefinition {
  id: MarketplaceId;
  label: string;
  mode: MarketplaceMode;
  description: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface MarketplaceOrder {
  id: string;
  marketplaceId: MarketplaceId;
  purchasedAt: string;
  grossAmountCents: number;
  currency: string;
  returned: boolean;
  buyerCity: string;
  buyerRegion: string;
  buyerPostalCode: string;
  itemsCount: number;
}

export const MARKETPLACES: MarketplaceDefinition[] = [
  {
    id: "amazon",
    label: "Amazon",
    mode: "live",
    description: "Live-Integration via Supabase",
  },
  {
    id: "ebay",
    label: "eBay",
    mode: "mock",
    description: "Platzhalter mit Mock-Daten",
  },
  {
    id: "etsy",
    label: "Etsy",
    mode: "mock",
    description: "Platzhalter mit Mock-Daten",
  },
];
