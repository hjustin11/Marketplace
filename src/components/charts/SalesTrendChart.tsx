import { Card, CardContent, Stack, Typography } from "@mui/material";
import { formatCurrency } from "../../lib/kpi";
import type { DailySalesPoint } from "../../types/metrics";
import { EChart } from "./EChart";

interface SalesTrendChartProps {
  points: DailySalesPoint[];
}

export function SalesTrendChart({ points }: SalesTrendChartProps) {
  const recentPoints = points.slice(-14);
  const periodRevenue = recentPoints.reduce((sum, point) => sum + point.revenueCents, 0);
  const labels = recentPoints.map((point) => point.date.slice(5));
  const values = recentPoints.map((point) => Number((point.revenueCents / 100).toFixed(2)));
  const averageValue =
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  return (
    <Card sx={{ height: "100%", minHeight: 360 }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Umsatzverlauf</Typography>
          <Typography variant="body2" color="primary.main" fontWeight={700}>
            {formatCurrency(periodRevenue)} (14T)
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Farbiger Trend fuer schnelle Umsatz-Interpretation.
        </Typography>
        <EChart
          option={{
            color: ["#5B7CFA"],
            tooltip: {
              trigger: "axis",
              valueFormatter: (value) => `${Number(value).toLocaleString("de-DE")} €`,
            },
            grid: { left: 42, right: 14, top: 18, bottom: 30 },
            xAxis: {
              type: "category",
              data: labels,
              boundaryGap: false,
              axisTick: { show: false },
              axisLabel: { interval: "auto" },
            },
            yAxis: {
              type: "value",
              axisLabel: { formatter: (value: number) => `${Math.round(value)}€` },
              splitLine: { lineStyle: { color: "rgba(91,124,250,0.13)" } },
            },
            series: [
              {
                type: "line",
                data: values,
                smooth: 0.35,
                symbol: "circle",
                symbolSize: 6,
                lineStyle: { width: 3 },
                markPoint: {
                  symbolSize: 36,
                  label: { fontSize: 10, formatter: "{c}€" },
                  data: [{ type: "max", name: "Max" }, { type: "min", name: "Min" }],
                },
                markLine: {
                  symbol: "none",
                  lineStyle: { type: "dashed", opacity: 0.55 },
                  label: { formatter: `Ø ${averageValue.toFixed(0)}€` },
                  data: [{ yAxis: averageValue }],
                },
                areaStyle: {
                  color: {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: "rgba(91,124,250,0.35)" },
                      { offset: 1, color: "rgba(91,124,250,0.02)" },
                    ],
                  },
                },
              },
            ],
          }}
          height={255}
        />
      </CardContent>
    </Card>
  );
}
