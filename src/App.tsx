import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { MarketplaceSection } from "./components/marketplace/MarketplaceSection";
import { ForecastSection } from "./components/forecast/ForecastSection";
import { AmazonOrdersSection } from "./components/orders/AmazonOrdersSection";
import { MARKETPLACES, type DateRange, type MarketplaceId, type MarketplaceOrder } from "./types/marketplace";
import {
  getMarketplaceSectionData,
  getRegionsFromOrders,
  syncAmazonOrders,
} from "./services/marketplaceService";
import type { MarketplaceMetrics } from "./types/metrics";
import { getMockOrders } from "./services/mockData";

interface MarketplaceState {
  orders: MarketplaceOrder[];
  metrics: MarketplaceMetrics;
  dataSource: "supabase" | "mock";
}

type AppView = "marketplace" | "forecast" | "amazonOrders";

interface LiveFeedState {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  nextScheduledAt: number | null;
  throttledUntil: number | null;
  errorMessage: string | null;
}

const LIVE_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const LIVE_SYNC_LOOKBACK_HOURS = 24;
const LIVE_SYNC_MAX_ORDERS = 100;
const LIVE_SYNC_BACKOFF_MS = 90 * 1000;
const FORECAST_LOOKBACK_DAYS = 180;

function getDefaultDateRange(): DateRange {
  const to = new Date();
  return {
    from: to.toISOString().slice(0, 10),
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
  const [activeView, setActiveView] = useState<AppView>("marketplace");
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<MarketplaceId>("amazon");
  const [range, setRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [liveFeedState, setLiveFeedState] = useState<LiveFeedState>({
    isSyncing: false,
    lastSyncedAt: null,
    nextScheduledAt: null,
    throttledUntil: null,
    errorMessage: null,
  });
  const syncInProgressRef = useRef(false);
  const nextLiveSyncAllowedAtRef = useRef(0);
  const [sections, setSections] = useState<Record<MarketplaceId, MarketplaceState>>({
    amazon: { orders: [], metrics: fallbackMetrics, dataSource: "mock" },
    ebay: { orders: [], metrics: { ...fallbackMetrics, marketplaceId: "ebay" }, dataSource: "mock" },
    etsy: { orders: [], metrics: { ...fallbackMetrics, marketplaceId: "etsy" }, dataSource: "mock" },
  });
  const [forecastSection, setForecastSection] = useState<MarketplaceState | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

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
          orders: sectionData.orders,
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

  function getForecastRange(): DateRange {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - (FORECAST_LOOKBACK_DAYS - 1));
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
        orders: refreshed.orders,
        metrics: refreshed.metrics,
        dataSource: refreshed.dataSource,
      },
    }));
  }

  async function runAmazonSync(): Promise<void> {
    if (Date.now() < nextLiveSyncAllowedAtRef.current) {
      setLiveFeedState((current) => ({
        ...current,
        throttledUntil: nextLiveSyncAllowedAtRef.current,
      }));
      return;
    }
    if (syncInProgressRef.current) {
      return;
    }
    syncInProgressRef.current = true;
    setLiveFeedState((current) => ({
      ...current,
      isSyncing: true,
      errorMessage: null,
    }));
    try {
      const syncRange = getLiveSyncRange();
      await syncAmazonOrders(syncRange, {
        maxOrders: LIVE_SYNC_MAX_ORDERS,
      });
      await refreshAmazonSection();
      setLiveFeedState((current) => ({
        ...current,
        isSyncing: false,
        lastSyncedAt: Date.now(),
        throttledUntil: null,
        errorMessage: null,
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes("QuotaExceeded")) {
        nextLiveSyncAllowedAtRef.current = Date.now() + LIVE_SYNC_BACKOFF_MS;
        setLiveFeedState((current) => ({
          ...current,
          isSyncing: false,
          throttledUntil: nextLiveSyncAllowedAtRef.current,
          errorMessage: "Amazon API-Limit erreicht",
        }));
        return;
      }
      setLiveFeedState((current) => ({
        ...current,
        isSyncing: false,
        errorMessage: error instanceof Error ? error.message : "Live-Sync fehlgeschlagen",
      }));
    } finally {
      syncInProgressRef.current = false;
      setLiveFeedState((current) => ({
        ...current,
        isSyncing: false,
      }));
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
    setLiveFeedState((current) => ({
      ...current,
      nextScheduledAt: Date.now() + LIVE_SYNC_INTERVAL_MS,
    }));
    const intervalId = window.setInterval(() => {
      setLiveFeedState((current) => ({
        ...current,
        nextScheduledAt: Date.now() + LIVE_SYNC_INTERVAL_MS,
      }));
      void triggerLiveSync();
    }, LIVE_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [range, selectedRegion]);

  useEffect(() => {
    if (activeView !== "forecast") {
      return;
    }

    const selectedMarketplace =
      MARKETPLACES.find((marketplace) => marketplace.id === selectedMarketplaceId) ?? MARKETPLACES[0];
    let active = true;

    async function loadForecast(): Promise<void> {
      setIsForecastLoading(true);
      setForecastError(null);
      try {
        const sectionData = await getMarketplaceSectionData({
          marketplace: selectedMarketplace,
          range: getForecastRange(),
          region: selectedRegion,
        });
        if (!active) {
          return;
        }
        setForecastSection({
          orders: sectionData.orders,
          metrics: sectionData.metrics,
          dataSource: sectionData.dataSource,
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setForecastError(error instanceof Error ? error.message : "Prognose konnte nicht geladen werden");
      } finally {
        if (active) {
          setIsForecastLoading(false);
        }
      }
    }

    void loadForecast();
    return () => {
      active = false;
    };
  }, [activeView, selectedMarketplaceId, selectedRegion]);

  const selectedMarketplace = MARKETPLACES.find((m) => m.id === selectedMarketplaceId) ?? MARKETPLACES[0];
  const selectedSection = sections[selectedMarketplaceId];

  return (
    <DashboardLayout
      marketplaces={MARKETPLACES}
      selectedMarketplaceId={selectedMarketplaceId}
      onMarketplaceChange={(id) => {
        setSelectedMarketplaceId(id as MarketplaceId);
        setActiveView("marketplace");
      }}
      isForecastSelected={activeView === "forecast"}
      onForecastSelect={() => setActiveView("forecast")}
      isAmazonOrdersSelected={activeView === "amazonOrders"}
      onAmazonOrdersSelect={() => {
        setSelectedMarketplaceId("amazon");
        setActiveView("amazonOrders");
      }}
      range={range}
      onRangeChange={setRange}
      selectedRegion={selectedRegion}
      regions={regions}
      onRegionChange={setSelectedRegion}
    >
      {activeView === "forecast" ? (
        <ForecastSection
          marketplace={selectedMarketplace}
          metrics={forecastSection?.metrics ?? null}
          isLoading={isForecastLoading}
          errorMessage={forecastError}
        />
      ) : activeView === "amazonOrders" ? (
        <AmazonOrdersSection
          orders={sections.amazon?.orders ?? []}
          isLoading={isLoading && selectedMarketplaceId === "amazon"}
        />
      ) : (
        <MarketplaceSection
          marketplace={selectedMarketplace}
          metrics={selectedSection?.metrics ?? fallbackMetrics}
          dataSource={selectedSection?.dataSource ?? "mock"}
          isLoading={isLoading}
          liveFeed={
            selectedMarketplace.id === "amazon"
              ? {
                  ...liveFeedState,
                  intervalMs: LIVE_SYNC_INTERVAL_MS,
                }
              : null
          }
        />
      )}
    </DashboardLayout>
  );
}
