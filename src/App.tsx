import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { MarketplaceSection } from "./components/marketplace/MarketplaceSection";
import { MARKETPLACES, type DateRange, type MarketplaceId } from "./types/marketplace";
import {
  getMarketplaceSectionData,
  getRegionsFromOrders,
  syncAmazonOrders,
} from "./services/marketplaceService";
import type { MarketplaceMetrics } from "./types/metrics";
import { getMockOrders } from "./services/mockData";

interface MarketplaceState {
  metrics: MarketplaceMetrics;
  dataSource: "supabase" | "mock";
}

const LIVE_SYNC_INTERVAL_MS = 15 * 1000;
const LIVE_SYNC_LOOKBACK_HOURS = 24;
const LIVE_SYNC_MAX_ORDERS = 100;
const LIVE_SYNC_BACKOFF_MS = 90 * 1000;

function getDefaultDateRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const fallbackMetrics: MarketplaceMetrics = {
  marketplaceId: "amazon",
  revenueCents: 0,
  returnedOrders: 0,
  orders: 0,
  returnRate: 0,
  averageOrderValueCents: 0,
  previousRevenueCents: 0,
  revenueDeltaPct: 0,
  dailySales: [],
  hourlyPurchases: Array.from({ length: 24 }, (_, hour) => ({ hour, purchases: 0 })),
  locationBreakdown: [],
};

export default function App() {
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<MarketplaceId>("amazon");
  const [range, setRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const syncInProgressRef = useRef(false);
  const nextLiveSyncAllowedAtRef = useRef(0);
  const [sections, setSections] = useState<Record<MarketplaceId, MarketplaceState>>({
    amazon: { metrics: fallbackMetrics, dataSource: "mock" },
    ebay: { metrics: { ...fallbackMetrics, marketplaceId: "ebay" }, dataSource: "mock" },
    etsy: { metrics: { ...fallbackMetrics, marketplaceId: "etsy" }, dataSource: "mock" },
  });

  const regions = useMemo(() => {
    const allOrders = MARKETPLACES.flatMap((marketplace) => getMockOrders(marketplace.id));
    return getRegionsFromOrders(allOrders);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      const updates: Partial<Record<MarketplaceId, MarketplaceState>> = {};

      for (const marketplace of MARKETPLACES) {
        const sectionData = await getMarketplaceSectionData({
          marketplace,
          range,
          region: selectedRegion,
        });

        updates[marketplace.id] = {
          metrics: sectionData.metrics,
          dataSource: sectionData.dataSource,
        };
      }

      if (active) {
        setSections((current) => ({
          ...current,
          ...updates,
        }));
      }
      if (active) {
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [range, selectedRegion]);

  function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function getLiveSyncRange(): DateRange {
    const to = new Date();
    const from = new Date(to.getTime() - LIVE_SYNC_LOOKBACK_HOURS * 60 * 60 * 1000);
    return {
      from: toDateInputValue(from),
      to: toDateInputValue(to),
    };
  }

  async function refreshAmazonSection(): Promise<void> {
    const amazonMarketplace = MARKETPLACES.find((marketplace) => marketplace.id === "amazon");
    if (!amazonMarketplace) {
      return;
    }

    const refreshed = await getMarketplaceSectionData({
      marketplace: amazonMarketplace,
      range,
      region: selectedRegion,
    });

    setSections((current) => ({
      ...current,
      amazon: {
        metrics: refreshed.metrics,
        dataSource: refreshed.dataSource,
      },
    }));
  }

  async function runAmazonSync(): Promise<void> {
    if (Date.now() < nextLiveSyncAllowedAtRef.current) {
      return;
    }
    if (syncInProgressRef.current) {
      return;
    }
    syncInProgressRef.current = true;
    try {
      const syncRange = getLiveSyncRange();
      await syncAmazonOrders(syncRange, {
        maxOrders: LIVE_SYNC_MAX_ORDERS,
      });
      await refreshAmazonSection();
    } catch (error) {
      if (error instanceof Error && error.message.includes("QuotaExceeded")) {
        nextLiveSyncAllowedAtRef.current = Date.now() + LIVE_SYNC_BACKOFF_MS;
        return;
      }
    } finally {
      syncInProgressRef.current = false;
    }
  }

  useEffect(() => {
    let active = true;
    const triggerLiveSync = async () => {
      if (!active) {
        return;
      }
      await runAmazonSync();
    };

    // Immediate sync on mount and whenever range/region changes.
    void triggerLiveSync();
    const intervalId = window.setInterval(() => {
      void triggerLiveSync();
    }, LIVE_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [range, selectedRegion]);

  const selectedMarketplace = MARKETPLACES.find((m) => m.id === selectedMarketplaceId) ?? MARKETPLACES[0];
  const selectedSection = sections[selectedMarketplaceId];

  return (
    <DashboardLayout
      marketplaces={MARKETPLACES}
      selectedMarketplaceId={selectedMarketplaceId}
      onMarketplaceChange={(id) => setSelectedMarketplaceId(id as MarketplaceId)}
      range={range}
      onRangeChange={setRange}
      selectedRegion={selectedRegion}
      regions={regions}
      onRegionChange={setSelectedRegion}
    >
      <MarketplaceSection
        marketplace={selectedMarketplace}
        metrics={selectedSection?.metrics ?? fallbackMetrics}
        dataSource={selectedSection?.dataSource ?? "mock"}
        isLoading={isLoading}
      />
    </DashboardLayout>
  );
}
