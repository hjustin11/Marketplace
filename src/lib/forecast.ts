import type { MarketplaceMetrics } from "../types/metrics";

export interface ForecastPeriod {
  id: "month" | "quarter" | "year";
  label: string;
  horizonDays: number;
  projectedRevenueCents: number;
  projectedOrders: number;
  projectedReturnedOrders: number;
  projectedNetRevenueCents: number;
  projectedAverageOrderValueCents: number;
}

export interface ForecastResult {
  periods: ForecastPeriod[];
  lookbackDays: number;
  trendPct: number;
  volatility: number;
  confidence: "high" | "medium" | "low";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

export function computeForecast(metrics: MarketplaceMetrics): ForecastResult {
  const daily = [...metrics.dailySales].sort((a, b) => a.date.localeCompare(b.date));
  const lookbackDays = daily.length;
  const totalRevenue = daily.reduce((sum, point) => sum + point.revenueCents, 0);
  const totalOrders = daily.reduce((sum, point) => sum + point.orders, 0);
  const avgRevenuePerDay = safeDivide(totalRevenue, Math.max(lookbackDays, 1));
  const avgOrdersPerDay = safeDivide(totalOrders, Math.max(lookbackDays, 1));

  const windowSize = Math.min(30, Math.max(7, Math.floor(lookbackDays / 2)));
  const recent = daily.slice(-windowSize);
  const previous = daily.slice(-windowSize * 2, -windowSize);
  const recentRevenuePerDay = safeDivide(
    recent.reduce((sum, point) => sum + point.revenueCents, 0),
    Math.max(recent.length, 1),
  );
  const previousRevenuePerDay = safeDivide(
    previous.reduce((sum, point) => sum + point.revenueCents, 0),
    Math.max(previous.length, 1),
  );
  const recentOrdersPerDay = safeDivide(
    recent.reduce((sum, point) => sum + point.orders, 0),
    Math.max(recent.length, 1),
  );
  const previousOrdersPerDay = safeDivide(
    previous.reduce((sum, point) => sum + point.orders, 0),
    Math.max(previous.length, 1),
  );

  const revenueTrend =
    previousRevenuePerDay > 0
      ? (recentRevenuePerDay - previousRevenuePerDay) / previousRevenuePerDay
      : 0;
  const orderTrend =
    previousOrdersPerDay > 0 ? (recentOrdersPerDay - previousOrdersPerDay) / previousOrdersPerDay : 0;
  const blendedTrend = clamp(revenueTrend * 0.65 + orderTrend * 0.35, -0.25, 0.25);
  const dampedTrendFactor = 1 + blendedTrend * 0.6;

  const baselineRevenuePerDay = recentRevenuePerDay > 0 ? recentRevenuePerDay : avgRevenuePerDay;
  const baselineOrdersPerDay = recentOrdersPerDay > 0 ? recentOrdersPerDay : avgOrdersPerDay;
  const projectedRevenuePerDay = baselineRevenuePerDay * dampedTrendFactor;
  const projectedOrdersPerDay = baselineOrdersPerDay * dampedTrendFactor;

  const returnRateAdjustment = blendedTrend < -0.08 ? 1.06 : 0.99;
  const projectedReturnRate = clamp(metrics.returnRate * returnRateAdjustment, 0, 0.6);

  const revenueSamples = daily.map((point) => point.revenueCents).filter((value) => value > 0);
  const meanRevenue =
    revenueSamples.length > 0
      ? revenueSamples.reduce((sum, value) => sum + value, 0) / revenueSamples.length
      : 0;
  const variance =
    revenueSamples.length > 0
      ? revenueSamples.reduce((sum, value) => sum + (value - meanRevenue) ** 2, 0) /
        revenueSamples.length
      : 0;
  const volatility = meanRevenue > 0 ? Math.sqrt(variance) / meanRevenue : 0;

  const confidence: ForecastResult["confidence"] =
    lookbackDays >= 120 && volatility < 0.65
      ? "high"
      : lookbackDays >= 45 && volatility < 0.95
      ? "medium"
      : "low";

  const buildPeriod = (id: ForecastPeriod["id"], label: string, horizonDays: number): ForecastPeriod => {
    const projectedRevenueCents = Math.max(0, Math.round(projectedRevenuePerDay * horizonDays));
    const projectedOrders = Math.max(0, Math.round(projectedOrdersPerDay * horizonDays));
    const projectedReturnedOrders = Math.round(projectedOrders * projectedReturnRate);
    const projectedNetRevenueCents = Math.max(
      0,
      Math.round(projectedRevenueCents * (1 - projectedReturnRate)),
    );
    const projectedAverageOrderValueCents =
      projectedOrders > 0
        ? Math.round(projectedRevenueCents / projectedOrders)
        : Math.round(metrics.averageOrderValueCents);

    return {
      id,
      label,
      horizonDays,
      projectedRevenueCents,
      projectedOrders,
      projectedReturnedOrders,
      projectedNetRevenueCents,
      projectedAverageOrderValueCents,
    };
  };

  return {
    periods: [
      buildPeriod("month", "Monat", 30),
      buildPeriod("quarter", "Quartal", 90),
      buildPeriod("year", "Jahr", 365),
    ],
    lookbackDays,
    trendPct: blendedTrend,
    volatility,
    confidence,
  };
}
