import type { HourlyPurchasePoint } from "../../types/metrics";
import { DASHBOARD_TIMEZONE } from "../../lib/kpi";

interface PurchaseTimeHeatmapProps {
  points: HourlyPurchasePoint[];
}

function alphaFromValue(value: number, max: number): number {
  if (max === 0) {
    return 0.15;
  }
  return 0.25 + (value / max) * 0.75;
}

export function PurchaseTimeHeatmap({ points }: PurchaseTimeHeatmapProps) {
  const max = Math.max(...points.map((point) => point.purchases), 0);
  const topHours = [...points]
    .sort((a, b) => b.purchases - a.purchases)
    .slice(0, 3)
    .filter((point) => point.purchases > 0);

  return (
    <section className="chart-card">
      <h3>Kaufzeitpunkte</h3>
      <p className="chart-subtitle">
        Bestellungen pro Stunde ({DASHBOARD_TIMEZONE})
      </p>
      <div className="heatmap-legend">
        <span>Niedrig</span>
        <div className="legend-gradient" />
        <span>Hoch</span>
      </div>
      <div className="top-hours">
        {topHours.length === 0 ? (
          <span>Keine Spitzenzeiten verfuegbar</span>
        ) : (
          topHours.map((point) => (
            <span key={`top-${point.hour}`} className="top-hour-chip">
              {String(point.hour).padStart(2, "0")}:00 ({point.purchases})
            </span>
          ))
        )}
      </div>
      <div className="hourly-rows">
        {points.map((point) => (
          <div key={point.hour} className="hour-row">
            <span className="hour-label">{String(point.hour).padStart(2, "0")}:00</span>
            <div className="hour-track">
              <div
                className="hour-fill"
                style={{
                  width: `${max === 0 ? 0 : (point.purchases / max) * 100}%`,
                  backgroundColor: `rgba(88, 166, 255, ${alphaFromValue(point.purchases, max)})`,
                }}
              />
            </div>
            <strong className="hour-value">{point.purchases}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
