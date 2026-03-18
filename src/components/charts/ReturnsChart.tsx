interface ReturnsChartProps {
  orders: number;
  returnedOrders: number;
  returnRate: number;
}

export function ReturnsChart({ orders, returnedOrders, returnRate }: ReturnsChartProps) {
  const keptOrders = Math.max(orders - returnedOrders, 0);
  return (
    <section className="chart-card">
      <h3>Retouren</h3>
      <p className="chart-subtitle">Retourenquote und Verhältnis zu behaltenen Bestellungen</p>
      <div className="stacked-bar">
        <div
          className="stacked-success"
          style={{ width: `${100 - returnRate * 100}%` }}
          title={`Behalten: ${keptOrders}`}
        />
        <div
          className="stacked-danger"
          style={{ width: `${returnRate * 100}%` }}
          title={`Retouren: ${returnedOrders}`}
        />
      </div>
      <div className="stats-row">
        <span>Behalten: {keptOrders}</span>
        <span>Retouren: {returnedOrders}</span>
      </div>
    </section>
  );
}
