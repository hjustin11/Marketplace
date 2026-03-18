import type { DailySalesPoint } from "../../types/metrics";

interface OrderTrendChartProps {
  points: DailySalesPoint[];
}

export function OrderTrendChart({ points }: OrderTrendChartProps) {
  const maxOrders = Math.max(...points.map((point) => point.orders), 1);

  return (
    <section className="chart-card">
      <h3>Bestellverlauf</h3>
      <p className="chart-subtitle">Volumen pro Tag als Fruehwarnsystem fuer Nachfrageschwankungen</p>
      <div className="bar-list">
        {points.slice(-10).map((point) => (
          <div key={`orders-${point.date}`} className="bar-row">
            <span>{point.date}</span>
            <div className="bar-track">
              <div
                className="bar-fill secondary"
                style={{
                  width: `${(point.orders / maxOrders) * 100}%`,
                }}
              />
            </div>
            <strong>{point.orders}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
