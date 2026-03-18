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
}

export function MarketplaceSection({
  marketplace,
  metrics,
  dataSource,
  isLoading,
}: MarketplaceSectionProps) {
  const decisions = useMemo(() => {
    const insights: { id: string; title: string; detail: string; severity: "high" | "medium" | "low" }[] = [];
    const topLocation = metrics.locationBreakdown[0];
    const totalDailyOrders = metrics.dailySales.reduce((sum, point) => sum + point.orders, 0);
    const avgDailyOrders = metrics.dailySales.length === 0 ? 0 : totalDailyOrders / metrics.dailySales.length;
    const peakHour = [...metrics.hourlyPurchases].sort((a, b) => b.purchases - a.purchases)[0];

    if (metrics.returnRate > 0.08) {
      insights.push({
        id: "returns-high",
        title: "Retourenquote ist hoch",
        detail:
          "Pruefe Produktdetailseiten, Groessentabellen und Top-SKU-Qualitaet. Ziel: Retouren um mindestens 2 Prozentpunkte senken.",
        severity: "high",
      });
    }

    if (metrics.revenueDeltaPct < -0.1) {
      insights.push({
        id: "revenue-down",
        title: "Umsatz sinkt gegenueber Vorperiode",
        detail:
          "Kurzfristig Kampagnen auf Top-Regionen fokussieren und Preis-/Coupon-Tests fuer Bestseller einplanen.",
        severity: "high",
      });
    }

    if (topLocation && metrics.revenueCents > 0) {
      const share = topLocation.revenueCents / metrics.revenueCents;
      if (share > 0.35) {
        insights.push({
          id: "location-concentration",
          title: "Umsatz stark in einer Region konzentriert",
          detail:
            "Diversifiziere Ads-Budget auf weitere Regionen, um Abhaengigkeiten und Risiko zu reduzieren.",
          severity: "medium",
        });
      }
    }

    if (peakHour && peakHour.purchases > 0) {
      insights.push({
        id: "peak-hour",
        title: "Beste Verkaufszeit nutzen",
        detail: `Lege Promotions kurz vor ${String(peakHour.hour).padStart(
          2,
          "0",
        )}:00 Uhr aus, um die Conversion in der Peak-Zeit zu steigern.`,
        severity: "low",
      });
    }

    if (avgDailyOrders > 0 && avgDailyOrders < 5) {
      insights.push({
        id: "volume-low",
        title: "Bestellvolumen ausbaufaehig",
        detail:
          "Traffic aus Marktplatz-Ads und organische Rankings pushen; A/B-Test fuer Titel/Bilder priorisieren.",
        severity: "medium",
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: "healthy",
        title: "Performance stabil",
        detail:
          "Aktuell keine kritischen Auffaelligkeiten. Fokus auf Skalierung profitabler Regionen und Peak-Zeiten.",
        severity: "low",
      });
    }

    return insights;
  }, [metrics]);

  const keptRevenueCents = Math.round(metrics.revenueCents * (1 - metrics.returnRate));
  const avgOrdersPerDay =
    metrics.dailySales.length === 0
      ? 0
      : metrics.dailySales.reduce((sum, day) => sum + day.orders, 0) / metrics.dailySales.length;
  const peakHour = [...metrics.hourlyPurchases].sort((a, b) => b.purchases - a.purchases)[0];
  const topLocation = metrics.locationBreakdown[0];
  const topLocationShare =
    topLocation && metrics.revenueCents > 0 ? topLocation.revenueCents / metrics.revenueCents : 0;

  return (
    <section>
      <header className="marketplace-header">
        {marketplace.id === "amazon" ? (
          <span className="live-corner-dot" aria-label="Live Sync aktiv" />
        ) : null}
        <div>
          <h2>{marketplace.label}</h2>
          <p>{marketplace.description}</p>
        </div>
        <div className="header-actions">
          {marketplace.id === "amazon" ? (
            null
          ) : (
            <span className={`pill ${dataSource === "supabase" ? "live" : "mock"}`}>
              Quelle: {dataSource === "supabase" ? "Supabase Live" : "Mock"}
            </span>
          )}
        </div>
      </header>

      {isLoading ? <p>Lade Marktplatzdaten...</p> : null}

      <div className="kpi-grid">
        <KpiCard label="Umsatz" value={formatCurrency(metrics.revenueCents)} />
        <KpiCard label="Bestellungen" value={String(metrics.orders)} />
        <KpiCard
          label="Nettoumsatz nach Retouren"
          value={formatCurrency(keptRevenueCents)}
          helper="Schneller Profitnahe-Wert"
        />
        <KpiCard
          label="Retourenquote"
          value={formatPercent(metrics.returnRate)}
          helper={`${metrics.returnedOrders} Retouren`}
        />
        <KpiCard
          label="Durchschnittsbestellwert"
          value={formatCurrency(metrics.averageOrderValueCents)}
        />
        <KpiCard
          label="Bestellungen/Tag"
          value={avgOrdersPerDay.toFixed(1)}
          helper="Mittelwert im Zeitraum"
        />
        <KpiCard
          label="Vorperiode"
          value={formatCurrency(metrics.previousRevenueCents)}
          helper={`Delta: ${formatPercent(metrics.revenueDeltaPct)}`}
        />
        <KpiCard
          label="Peak-Kaufzeit"
          value={peakHour ? `${String(peakHour.hour).padStart(2, "0")}:00` : "-"}
          helper={peakHour ? `${peakHour.purchases} Bestellungen` : "Keine Daten"}
        />
        <KpiCard
          label="Top-Region-Anteil"
          value={formatPercent(topLocationShare)}
          helper={topLocation ? `${topLocation.city}` : "Keine Daten"}
        />
      </div>

      <div className="chart-grid">
        <SalesTrendChart points={metrics.dailySales} />
        <OrderTrendChart points={metrics.dailySales} />
        <ReturnsChart
          orders={metrics.orders}
          returnedOrders={metrics.returnedOrders}
          returnRate={metrics.returnRate}
        />
        <PurchaseTimeHeatmap points={metrics.hourlyPurchases} />
        <LocationRevenueChart points={metrics.locationBreakdown} />
        <ActionInsights insights={decisions} />
      </div>

      <LocationBreakdown points={metrics.locationBreakdown} />
    </section>
  );
}
