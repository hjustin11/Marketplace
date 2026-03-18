import { formatCurrency } from "../../lib/kpi";
import type { LocationPoint } from "../../types/metrics";

interface LocationRevenueChartProps {
  points: LocationPoint[];
}

export function LocationRevenueChart({ points }: LocationRevenueChartProps) {
  const topPoints = points.slice(0, 6);
  const maxRevenue = Math.max(...topPoints.map((point) => point.revenueCents), 1);

  return (
    <section className="chart-card">
      <h3>Regionale Umsatzstaerke</h3>
      <p className="chart-subtitle">Top Regionen nach Umsatzanteil fuer Werbe- und Lagerentscheidungen</p>
      <div className="bar-list">
        {topPoints.map((point) => (
          <div key={`region-${point.key}`} className="bar-row">
            <span>{point.city}</span>
            <div className="bar-track">
              <div
                className="bar-fill warning"
                style={{
                  width: `${(point.revenueCents / maxRevenue) * 100}%`,
                }}
              />
            </div>
            <strong>{formatCurrency(point.revenueCents)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
