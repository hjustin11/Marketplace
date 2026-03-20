import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { DailySalesPoint } from "../../types/metrics";
import { EChart } from "./EChart";

interface OrderTrendChartProps {
  points: DailySalesPoint[];
}

export function OrderTrendChart({ points }: OrderTrendChartProps) {
  const recentPoints = points.slice(-14);
  const periodOrders = recentPoints.reduce((sum, point) => sum + point.orders, 0);
  const labels = recentPoints.map((point) => point.date.slice(5));
  const values = recentPoints.map((point) => point.orders);
  const movingAverage = values.map((_, index, source) => {
    const from = Math.max(0, index - 2);
    const window = source.slice(from, index + 1);
    return Number((window.reduce((sum, value) => sum + value, 0) / window.length).toFixed(2));
  });

  return (
    <Card sx={{ height: "100%", minHeight: 360 }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Bestellvolumen</Typography>
          <Typography variant="body2" color="secondary.main" fontWeight={700}>
            {periodOrders} Orders (14T)
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Transparente Balken zeigen Lastspitzen sofort.
        </Typography>
        <EChart
          option={{
            color: ["#12B981", "#5B7CFA"],
            tooltip: { trigger: "axis", valueFormatter: (value) => `${Math.round(Number(value))}` },
            legend: { top: 0, right: 0, itemWidth: 12 },
            grid: { left: 38, right: 12, top: 30, bottom: 30 },
            xAxis: { type: "category", data: labels, axisTick: { show: false }, axisLabel: { interval: "auto" } },
            yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(18,185,129,0.14)" } } },
            series: [
              {
                type: "line",
                name: "Trend",
                data: movingAverage,
                smooth: true,
                symbol: "none",
                lineStyle: { width: 2, opacity: 0.7, color: "#5B7CFA" },
              },
              {
                type: "bar",
                name: "Orders",
                data: values,
                barMaxWidth: 26,
                itemStyle: { borderRadius: [8, 8, 0, 0] },
              },
            ],
          }}
          height={255}
        />
      </CardContent>
    </Card>
  );
}
