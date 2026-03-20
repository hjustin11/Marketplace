import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { MarketplaceSection } from "./components/marketplace/MarketplaceSection";
import { ForecastSection } from "./components/forecast/ForecastSection";
import { AmazonOrdersSection } from "./components/orders/AmazonOrdersSection";
import {
  DEFAULT_MARKETPLACES,
  type DateRange,
  type MarketplaceDefinition,
  type MarketplaceId,
  type MarketplaceOrder,
} from "./types/marketplace";
import {
  fetchAmazonSellerHealth,
  getMarketplaceSectionData,
  getRegionsFromOrders,
  syncAmazonOrders,
} from "./services/marketplaceService";
import type { AmazonSellerHealth } from "./services/marketplaceService";
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

const KPI_OPTIONS: { id: string; label: string }[] = [
  { id: "revenue", label: "Umsatz" },
  { id: "orders", label: "Bestellungen" },
  { id: "pendingPayments", label: "Offene Zahlungen" },
  { id: "netRevenue", label: "Nettoumsatz" },
  { id: "returnsRate", label: "Retourenquote" },
  { id: "aov", label: "AOV" },
  { id: "ordersPerDay", label: "Bestellungen/Tag" },
  { id: "previousPeriod", label: "Vorperiode" },
  { id: "topRegion", label: "Top-Region-Anteil" },
] ;

const CHART_OPTIONS: { id: string; label: string }[] = [
  { id: "salesTrend", label: "Umsatzverlauf" },
  { id: "orderTrend", label: "Bestellvolumen" },
  { id: "returns", label: "Retourenquote" },
  { id: "purchaseHeatmap", label: "Kaufzeitpunkte" },
  { id: "locationRevenue", label: "Regionale Umsatzverteilung" },
  { id: "insights", label: "Handlungsempfehlungen" },
  { id: "locationBreakdown", label: "Wohnort-Verteilung" },
];

const LIVE_SYNC_INTERVAL_MS = 2 * 60 * 1000;
const LIVE_SYNC_LOOKBACK_HOURS = 24;
const LIVE_SYNC_MAX_ORDERS = 100;
const LIVE_SYNC_BACKOFF_MS = 90 * 1000;
const FORECAST_LOOKBACK_DAYS = 180;
const MARKETPLACE_STORAGE_KEY = "dashboard.marketplaces";

function getDefaultDateRange(): DateRange {
  const to = new Date();
  return {
    from: to.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const fallbackMetrics: MarketplaceMetrics = {
  marketplaceId: "default",
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

function toMarketplaceId(value: string): MarketplaceId {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function buildSectionState(marketplaces: MarketplaceDefinition[]): Record<MarketplaceId, MarketplaceState> {
  const next: Record<MarketplaceId, MarketplaceState> = {};
  for (const marketplace of marketplaces) {
    next[marketplace.id] = {
      orders: [],
      metrics: { ...fallbackMetrics, marketplaceId: marketplace.id },
      dataSource: "mock",
    };
  }
  return next;
}

export default function App() {
  const [marketplaces, setMarketplaces] = useState<MarketplaceDefinition[]>(() => {
    try {
      const stored = localStorage.getItem(MARKETPLACE_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_MARKETPLACES;
      }
      const parsed = JSON.parse(stored) as MarketplaceDefinition[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return DEFAULT_MARKETPLACES;
      }
      return parsed;
    } catch {
      return DEFAULT_MARKETPLACES;
    }
  });
  const [activeView, setActiveView] = useState<AppView>("marketplace");
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<MarketplaceId>(
    () => DEFAULT_MARKETPLACES[0]?.id ?? "amazon",
  );
  const [amazonOrdersPaymentView, setAmazonOrdersPaymentView] = useState<"all" | "pending">("all");
  const [range, setRange] = useState<DateRange>(getDefaultDateRange());
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [visibleKpiIds, setVisibleKpiIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("dashboard.visibleKpis");
      if (!stored) {
        return KPI_OPTIONS.map((item) => item.id);
      }
      const parsed = JSON.parse(stored) as string[];
      return KPI_OPTIONS.map((item) => item.id).filter((id) => parsed.includes(id));
    } catch {
      return KPI_OPTIONS.map((item) => item.id);
    }
  });
  const [visibleChartIds, setVisibleChartIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("dashboard.visibleCharts");
      if (!stored) {
        return CHART_OPTIONS.map((item) => item.id);
      }
      const parsed = JSON.parse(stored) as string[];
      return CHART_OPTIONS.map((item) => item.id).filter((id) => parsed.includes(id));
    } catch {
      return CHART_OPTIONS.map((item) => item.id);
    }
  });
  const [liveFeedState, setLiveFeedState] = useState<LiveFeedState>({
    isSyncing: false,
    lastSyncedAt: null,
    nextScheduledAt: null,
    throttledUntil: null,
    errorMessage: null,
  });
  const syncInProgressRef = useRef(false);
  const nextLiveSyncAllowedAtRef = useRef(0);
  const [amazonSellerHealth, setAmazonSellerHealth] = useState<AmazonSellerHealth | null>(null);
  const [sections, setSections] = useState<Record<MarketplaceId, MarketplaceState>>(() =>
    buildSectionState(DEFAULT_MARKETPLACES),
  );
  const [forecastSection, setForecastSection] = useState<MarketplaceState | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const regions = useMemo(() => {
    const allOrders = marketplaces.flatMap((marketplace) => getMockOrders(marketplace.id));
    return getRegionsFromOrders(allOrders);
  }, [marketplaces]);
  const hasAmazon = marketplaces.some((marketplace) => marketplace.id === "amazon");

  useEffect(() => {
    localStorage.setItem(MARKETPLACE_STORAGE_KEY, JSON.stringify(marketplaces));
  }, [marketplaces]);

  useEffect(() => {
    localStorage.setItem("dashboard.visibleKpis", JSON.stringify(visibleKpiIds));
  }, [visibleKpiIds]);

  useEffect(() => {
    localStorage.setItem("dashboard.visibleCharts", JSON.stringify(visibleChartIds));
  }, [visibleChartIds]);

  useEffect(() => {
    setSections((current) => {
      const next = buildSectionState(marketplaces);
      for (const marketplace of marketplaces) {
        if (current[marketplace.id]) {
          next[marketplace.id] = current[marketplace.id];
        }
      }
      return next;
    });
    if (!marketplaces.some((marketplace) => marketplace.id === selectedMarketplaceId)) {
      setSelectedMarketplaceId(marketplaces[0]?.id ?? "amazon");
      setActiveView("marketplace");
    }
  }, [marketplaces, selectedMarketplaceId]);

  useEffect(() => {
    if (!hasAmazon) {
      return;
    }
    let active = true;
    async function load() {
      if (marketplaces.length === 0) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const updates: Record<MarketplaceId, MarketplaceState> = {};

      for (const marketplace of marketplaces) {
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
  }, [marketplaces, range, selectedRegion]);

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
    const amazonMarketplace = marketplaces.find((marketplace) => marketplace.id === "amazon");
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
      const health = await fetchAmazonSellerHealth();
      if (health) {
        setAmazonSellerHealth(health);
      }
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
      setAmazonSellerHealth(null);
    } finally {
      syncInProgressRef.current = false;
      setLiveFeedState((current) => ({
        ...current,
        isSyncing: false,
      }));
    }
  }

  function handleAddMarketplace(input: { label: string; mode: "live" | "mock"; description: string }): void {
    const id = toMarketplaceId(input.label);
    if (!id) {
      return;
    }
    setMarketplaces((current) => {
      if (current.some((item) => item.id === id)) {
        return current;
      }
      return [
        ...current,
        {
          id,
          label: input.label.trim(),
          mode: input.mode,
          description: input.description.trim() || "Benutzerdefinierter Marktplatz",
        },
      ];
    });
  }

  function handleRemoveMarketplace(id: string): void {
    setMarketplaces((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function toggleKpiWidget(id: string): void {
    setVisibleKpiIds((current) => {
      if (current.includes(id)) {
        return current.length > 1 ? current.filter((item) => item !== id) : current;
      }
      return [...current, id];
    });
  }

  function toggleChartWidget(id: string): void {
    setVisibleChartIds((current) => {
      if (current.includes(id)) {
        return current.length > 1 ? current.filter((item) => item !== id) : current;
      }
      return [...current, id];
    });
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
  }, [hasAmazon, range, selectedRegion]);

  useEffect(() => {
    if (activeView !== "forecast") {
      return;
    }

    const selectedMarketplace =
      marketplaces.find((marketplace) => marketplace.id === selectedMarketplaceId) ?? marketplaces[0];
    if (!selectedMarketplace) {
      return;
    }
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
  }, [activeView, marketplaces, selectedMarketplaceId, selectedRegion]);

  const selectedMarketplace = marketplaces.find((m) => m.id === selectedMarketplaceId) ?? marketplaces[0];
  const selectedSection = sections[selectedMarketplaceId];

  if (!selectedMarketplace) {
    return null;
  }

  return (
    <DashboardLayout
      marketplaces={marketplaces}
      selectedMarketplaceId={selectedMarketplaceId}
      selectedMarketplace={selectedMarketplace}
      selectedMarketplaceDataSource={selectedSection?.dataSource ?? "mock"}
      onMarketplaceChange={(id) => {
        setSelectedMarketplaceId(id);
        setActiveView("marketplace");
      }}
      onMarketplaceAdd={handleAddMarketplace}
      onMarketplaceRemove={handleRemoveMarketplace}
      kpiOptions={KPI_OPTIONS}
      visibleKpiIds={visibleKpiIds}
      onToggleKpi={toggleKpiWidget}
      chartOptions={CHART_OPTIONS}
      visibleChartIds={visibleChartIds}
      onToggleChart={toggleChartWidget}
      isForecastSelected={activeView === "forecast"}
      onForecastSelect={() => setActiveView("forecast")}
      isAmazonOrdersSelected={activeView === "amazonOrders"}
      onAmazonOrdersSelect={
        hasAmazon
          ? () => {
              setSelectedMarketplaceId("amazon");
              setAmazonOrdersPaymentView("all");
              setActiveView("amazonOrders");
            }
          : undefined
      }
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
          paymentView={amazonOrdersPaymentView}
          onPaymentViewChange={setAmazonOrdersPaymentView}
        />
      ) : (
        <MarketplaceSection
          marketplace={selectedMarketplace}
          metrics={selectedSection?.metrics ?? fallbackMetrics}
          orders={selectedSection?.orders ?? []}
          dataSource={selectedSection?.dataSource ?? "mock"}
          isLoading={isLoading}
          sellerHealth={selectedMarketplace.id === "amazon" ? amazonSellerHealth : null}
          onOpenPendingPayments={() => {
            if (hasAmazon) {
              setSelectedMarketplaceId("amazon");
              setAmazonOrdersPaymentView("pending");
              setActiveView("amazonOrders");
            }
          }}
          visibleKpiIds={visibleKpiIds}
          visibleChartIds={visibleChartIds}
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
