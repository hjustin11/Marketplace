import { formatCurrency } from "../../lib/kpi";
import type { LocationPoint } from "../../types/metrics";

interface LocationBreakdownProps {
  points: LocationPoint[];
}

export function LocationBreakdown({ points }: LocationBreakdownProps) {
  return (
    <section className="chart-card">
      <h3>Wohnort-Verteilung</h3>
      <p className="chart-subtitle">Top Orte nach Umsatz</p>
      <div className="location-table-wrap">
        <table className="location-table">
          <thead>
            <tr>
              <th>PLZ</th>
              <th>Stadt</th>
              <th>Region</th>
              <th>Bestellungen</th>
              <th>Umsatz</th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 ? (
              <tr>
                <td colSpan={5}>Keine Daten im gewählten Filter.</td>
              </tr>
            ) : (
              points.map((point) => (
                <tr key={point.key}>
                  <td>{point.postalCode}</td>
                  <td>{point.city}</td>
                  <td>{point.region}</td>
                  <td>{point.orders}</td>
                  <td>{formatCurrency(point.revenueCents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
