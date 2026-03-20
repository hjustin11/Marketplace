import { Alert, Chip, Grid, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { formatCurrency, formatPercent } from "../../lib/kpi";
import { KpiCard } from "../kpi/KpiCard";
import { SalesTrendChart } from "../charts/SalesTrendChart";
import { ReturnsChart } from "../charts/ReturnsChart";
import { PurchaseTimeHeatmap } from "../charts/PurchaseTimeHeatmap";
import { LocationBreakdown } from "../charts/LocationBreakdown";
import { OrderTrendChart } from "../charts/OrderTrendChart";
import { LocationRevenueChart } from "../charts/LocationRevenueChart";
import { ActionInsights } from "../insights/ActionInsights";
import type { MarketplaceDefinition } from "../../types/marketplace";
import type { MarketplaceMetrics } from "../../types/metrics";

interface MarketplaceSectionProps {
  marketplace: MarketplaceDefinition;
  metrics: MarketplaceMetrics;
  dataSource: "supabase" | "mock";
  isLoading: boolean;
  liveFeed: {
    isSyncing: boolean;
    lastSyncedAt: number | null;
    nextScheduledAt: number | null;
    throttledUntil: number | null;
    errorMessage: string | null;
    intervalMs: number;
  } | null;
}

export function MarketplaceSection({
  marketplace,
  metrics,
  dataSource,
  isLoading,
  liveFeed,
}: MarketplaceSectionProps) {
  const decisions = useMemo(() => {
    type Severity = "high" | "medium" | "low";
    type Insight = { id: string; title: string; detail: string; severity: Severity; impactScore: number };
    const insights: Insight[] = [];

    const daily = [...metrics.dailySales].sort((a, b) => a.date.localeCompare(b.date));
    const dayCount = daily.length;
    const windowSize = Math.min(7, Math.max(3, Math.floor(dayCount / 2)));
    const recentWindow = daily.slice(-windowSize);
    const previousWindow = daily.slice(-windowSize * 2, -windowSize);
    const sumRevenue = (points: typeof daily) => points.reduce((sum, point) => sum + point.revenueCents, 0);
    const sumOrders = (points: typeof daily) => points.reduce((sum, point) => sum + point.orders, 0);
    const recentRevenue = sumRevenue(recentWindow);
    const previousRevenueWindow = sumRevenue(previousWindow);
    const recentOrders = sumOrders(recentWindow);
    const previousOrdersWindow = sumOrders(previousWindow);
    const recentAov = recentOrders > 0 ? recentRevenue / recentOrders : 0;
    const previousAov = previousOrdersWindow > 0 ? previousRevenueWindow / previousOrdersWindow : 0;
    const revenueTrend =
      previousRevenueWindow > 0 ? (recentRevenue - previousRevenueWindow) / previousRevenueWindow : null;
    const orderTrend =
      previousOrdersWindow > 0 ? (recentOrders - previousOrdersWindow) / previousOrdersWindow : null;
    const aovTrend = previousAov > 0 ? (recentAov - previousAov) / previousAov : null;
    const zeroSalesDays = daily.filter((point) => point.orders === 0).length;
    const zeroSalesShare = dayCount > 0 ? zeroSalesDays / dayCount : 0;
    const totalHourlyPurchases = metrics.hourlyPurchases.reduce((sum, point) => sum + point.purchases, 0);
    const hourlyTop = [...metrics.hourlyPurchases].sort((a, b) => b.purchases - a.purchases);
    const topHours = hourlyTop.slice(0, 3);
    const topHourVolume = topHours.reduce((sum, point) => sum + point.purchases, 0);
    const topHourShare = totalHourlyPurchases > 0 ? topHourVolume / totalHourlyPurchases : 0;
    const peakHour = hourlyTop[0];
    const secondHour = hourlyTop[1];
    const topLocation = metrics.locationBreakdown[0];
    const topLocationShare =
      topLocation && metrics.revenueCents > 0 ? topLocation.revenueCents / metrics.revenueCents : 0;
    const avgDailyOrders = dayCount > 0 ? metrics.orders / dayCount : 0;
    const dailyRevenueValues = daily.map((point) => point.revenueCents).filter((value) => value > 0);
    const meanDailyRevenue =
      dailyRevenueValues.length > 0
        ? dailyRevenueValues.reduce((sum, value) => sum + value, 0) / dailyRevenueValues.length
        : 0;
    const variance =
      dailyRevenueValues.length > 0
        ? dailyRevenueValues.reduce((sum, value) => sum + (value - meanDailyRevenue) ** 2, 0) /
          dailyRevenueValues.length
        : 0;
    const coeffOfVariation = meanDailyRevenue > 0 ? Math.sqrt(variance) / meanDailyRevenue : 0;
    const toPct = (value: number | null): string => (value === null ? "n/a" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`);

    if (
      revenueTrend !== null &&
      orderTrend !== null &&
      revenueTrend <= -0.12 &&
      orderTrend <= -0.08 &&
      dayCount >= 6
    ) {
      insights.push({
        id: "demand-drop",
        title: "Nachfrage faellt in den letzten Tagen",
          detail: `Umsatztrend ${toPct(revenueTrend)} bei Bestelltrend ${toPct(orderTrend)}. Fokus auf Preis-/Coupon-Tests und Kampagnen-Umbau.`,
        severity: "high",
        impactScore: 100,
      });
    }

    if (metrics.returnRate >= 0.09 && metrics.orders >= 20) {
      insights.push({
        id: "returns-critical",
        title: "Retourenrisiko belastet Profitabilitaet",
          detail: `Retourenquote liegt bei ${formatPercent(metrics.returnRate)}. SKU-Qualitaet, Produkttexte und Sizing-Hinweise priorisieren.`,
        severity: "high",
        impactScore: 95,
      });
    }

    if (aovTrend !== null && aovTrend <= -0.1 && recentOrders >= Math.max(8, previousOrdersWindow * 0.8)) {
      insights.push({
        id: "basket-down",
        title: "Warenkorbwert sinkt trotz stabiler Nachfrage",
        detail: `AOV-Trend ${toPct(aovTrend)}. Bundle-Strategie und Cross-Selling aktivieren.`,
        severity: "medium",
        impactScore: 82,
      });
    }

    if (topLocation && topLocationShare >= 0.4 && metrics.orders >= 20 && metrics.locationBreakdown.length >= 2) {
      insights.push({
        id: "geo-concentration",
        title: "Starke regionale Abhaengigkeit",
        detail: `${topLocation.city} traegt ${formatPercent(topLocationShare)} vom Umsatz. Budget auf weitere Regionen verteilen.`,
        severity: topLocationShare >= 0.5 ? "high" : "medium",
        impactScore: topLocationShare >= 0.5 ? 86 : 72,
      });
    }

    if (coeffOfVariation >= 0.75 && dayCount >= 7) {
      insights.push({
        id: "revenue-volatility",
        title: "Umsatz stark volatil",
        detail: "Tagesumsatz schwankt stark. Kampagnenbudget stabilisieren und Aktionen in fixe Zeitfenster legen.",
        severity: "medium",
        impactScore: 78,
      });
    }

    if (zeroSalesShare >= 0.3 && dayCount >= 7) {
      insights.push({
        id: "idle-days",
        title: "Zu viele Tage ohne Orders",
        detail: `${Math.round(zeroSalesShare * 100)}% der Tage ohne Verkauf. Trigger-Kampagnen fuer schwache Tage einplanen.`,
        severity: "medium",
        impactScore: 70,
      });
    }

    if (
      peakHour &&
      peakHour.purchases > 0 &&
      secondHour &&
      topHourShare >= 0.5 &&
      totalHourlyPurchases >= 20
    ) {
      insights.push({
        id: "time-window",
        title: "Verkauf konzentriert sich auf enges Zeitfenster",
        detail: `Top-3-Stunden liefern ${formatPercent(topHourShare)} aller Orders. Promotions vor Peak-Zeiten starten.`,
        severity: "low",
        impactScore: 62,
      });
    }

    if (revenueTrend !== null && revenueTrend >= 0.12 && metrics.returnRate < 0.06 && metrics.orders >= 15) {
      insights.push({
        id: "scale-opportunity",
        title: "Skalierungschance bei gesunder Qualitaet",
        detail: `Umsatztrend ${toPct(revenueTrend)} bei niedriger Retourenquote (${formatPercent(metrics.returnRate)}). Gewinner-SKUs hochskalieren.`,
        severity: "low",
        impactScore: 66,
      });
    }

    if (avgDailyOrders > 0 && avgDailyOrders < 4 && metrics.revenueDeltaPct <= 0) {
      insights.push({
        id: "traffic-gap",
        title: "Funnel oben zu schwach",
        detail: "Niedriges Tagesvolumen bei stagnierender Entwicklung. Sichtbarkeit via SEO und Creatives erhoehen.",
        severity: "medium",
        impactScore: 74,
      });
    }

    const severityWeight: Record<Severity, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };
    const sorted = insights
      .sort((a, b) => {
        const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
        if (severityDiff !== 0) {
          return severityDiff;
        }
        return b.impactScore - a.impactScore;
      })
      .slice(0, 5)
      .map(({ impactScore: _impactScore, ...insight }) => insight);

    if (sorted.length === 0) {
      return [
        {
          id: "healthy",
          title: "Performance stabil auf gutem Niveau",
          detail:
            "Kein akuter Eingriff noetig. Empfohlen: Gewinner-SKUs weiter skalieren, Preis-/Content-Tests beibehalten und Live-Feed auf Ausreisser monitoren.",
          severity: "low" as const,
        },
      ];
    }

    return sorted;
  }, [metrics]);

  const keptRevenueCents = Math.round(metrics.revenueCents * (1 - metrics.returnRate));
  const avgOrdersPerDay =
    metrics.dailySales.length === 0
      ? 0
      : metrics.dailySales.reduce((sum, day) => sum + day.orders, 0) / metrics.dailySales.length;
  const topLocation = metrics.locationBreakdown[0];
  const topLocationShare =
    topLocation && metrics.revenueCents > 0 ? topLocation.revenueCents / metrics.revenueCents : 0;

  const liveFeedStatus = useMemo((): string | null => {
    if (!liveFeed) {
      return null;
    }
    if (liveFeed.isSyncing) {
      return "Live-Feed: synchronisiert gerade...";
    }
    if (liveFeed.throttledUntil && liveFeed.throttledUntil > Date.now()) {
      return "Live-Feed pausiert wegen API-Limit.";
    }
    if (liveFeed.errorMessage) {
      return `Live-Feed Warnung: ${liveFeed.errorMessage}`;
    }
    return `Live-Feed aktiv · Intervall ${Math.round(liveFeed.intervalMs / 60000)} min`;
  }, [liveFeed]);

  const healthScore = useMemo((): number => {
    const scoreBase = 100;
    const trendPenalty = Math.max(0, -metrics.revenueDeltaPct) * 35;
    const returnPenalty = metrics.returnRate * 180;
    const score = Math.round(Math.max(0, Math.min(100, scoreBase - trendPenalty - returnPenalty)));
    return score;
  }, [metrics.revenueDeltaPct, metrics.returnRate]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" spacing={1}>
        <div>
          <Typography variant="h5">{marketplace.label}</Typography>
          <Typography variant="body2" color="text.secondary">
            {marketplace.description}
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Chip label={`Health Score ${healthScore}`} color={healthScore > 70 ? "success" : healthScore > 45 ? "warning" : "error"} />
          <Chip label={`Quelle: ${dataSource === "supabase" ? "Supabase Live" : "Mock"}`} color={dataSource === "supabase" ? "primary" : "default"} />
        </Stack>
      </Stack>

      {isLoading ? <Alert severity="info">Lade Marktplatzdaten...</Alert> : null}
      {liveFeedStatus ? <Alert severity="success">{liveFeedStatus}</Alert> : null}

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="Umsatz" value={formatCurrency(metrics.revenueCents)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="Bestellungen" value={String(metrics.orders)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="Nettoumsatz" value={formatCurrency(keptRevenueCents)} helper="nach Retouren" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="Retourenquote" value={formatPercent(metrics.returnRate)} helper={`${metrics.returnedOrders} Retouren`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="AOV" value={formatCurrency(metrics.averageOrderValueCents)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="Bestellungen/Tag" value={avgOrdersPerDay.toFixed(1)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="Vorperiode" value={formatCurrency(metrics.previousRevenueCents)} helper={`Delta ${formatPercent(metrics.revenueDeltaPct)}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <KpiCard label="Top-Region-Anteil" value={formatPercent(topLocationShare)} helper={topLocation ? topLocation.city : "Keine Daten"} />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <SalesTrendChart points={metrics.dailySales} />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <OrderTrendChart points={metrics.dailySales} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <ReturnsChart orders={metrics.orders} returnedOrders={metrics.returnedOrders} returnRate={metrics.returnRate} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <PurchaseTimeHeatmap points={metrics.hourlyPurchases} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <LocationRevenueChart points={metrics.locationBreakdown} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ActionInsights insights={decisions} />
        </Grid>
      </Grid>

      <LocationBreakdown points={metrics.locationBreakdown} />
    </Stack>
  );
}
