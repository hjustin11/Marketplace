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

  return (
    <Card>
      <CardContent>
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
            color: ["#12B981"],
            tooltip: { trigger: "axis" },
            grid: { left: 34, right: 10, top: 20, bottom: 30 },
            xAxis: { type: "category", data: labels, axisTick: { show: false } },
            yAxis: { type: "value", splitLine: { lineStyle: { color: "rgba(18,185,129,0.14)" } } },
            series: [
              {
                type: "bar",
                data: values,
                barMaxWidth: 26,
                itemStyle: { borderRadius: [8, 8, 0, 0] },
              },
            ],
          }}
          height={260}
        />
      </CardContent>
    </Card>
  );
}
