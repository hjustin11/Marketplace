import { formatCurrency } from "../../lib/kpi";
import type { DailySalesPoint } from "../../types/metrics";

interface SalesTrendChartProps {
  points: DailySalesPoint[];
}

export function SalesTrendChart({ points }: SalesTrendChartProps) {
  const maxRevenue = Math.max(...points.map((point) => point.revenueCents), 1);

  return (
    <section className="chart-card">
      <h3>Umsatzverlauf</h3>
      <div className="bar-list">
        {points.slice(-10).map((point) => (
          <div key={point.date} className="bar-row">
            <span>{point.date}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
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
