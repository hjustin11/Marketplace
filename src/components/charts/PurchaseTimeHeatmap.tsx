import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { HourlyPurchasePoint } from "../../types/metrics";
import { DASHBOARD_TIMEZONE } from "../../lib/kpi";
import { EChart } from "./EChart";

interface PurchaseTimeHeatmapProps {
  points: HourlyPurchasePoint[];
}

export function PurchaseTimeHeatmap({ points }: PurchaseTimeHeatmapProps) {
  const topHour = [...points].sort((a, b) => b.purchases - a.purchases)[0];
  const labels = points.map((point) => String(point.hour).padStart(2, "0"));
  const values = points.map((point) => point.purchases);
  const avgPurchases =
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const maxValue = Math.max(...values, 1);

  return (
    <Card sx={{ height: "100%", minHeight: 360 }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Kaufzeitpunkte</Typography>
          <Typography variant="body2" color="primary.main" fontWeight={700}>
            {topHour ? `${String(topHour.hour).padStart(2, "0")}:00` : "n/a"}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Bestellungen pro Stunde ({DASHBOARD_TIMEZONE}) mit Peak-Hour-Markierung
        </Typography>
        <EChart
          option={{
            tooltip: { trigger: "axis" },
            grid: { left: 40, right: 16, top: 24, bottom: 44 },
            xAxis: {
              type: "category",
              data: labels,
              axisTick: { show: false },
              axisLabel: {
                interval: 2,
                formatter: (value: string) => `${value}:00`,
                fontSize: 11,
                margin: 12,
              },
            },
            yAxis: {
              type: "value",
              axisLabel: { formatter: (value: number) => `${Math.round(value)}` },
              splitLine: { lineStyle: { color: "rgba(91,124,250,0.13)" } },
            },
            series: [
              {
                type: "bar",
                data: values,
                barMaxWidth: 14,
                itemStyle: {
                  borderRadius: [8, 8, 0, 0],
                  color: {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: "#91B3FF" },
                      { offset: 1, color: "#5B7CFA" },
                    ],
                  },
                },
                emphasis: {
                  itemStyle: { color: "#2F52E0" },
                },
                markLine: {
                  symbol: "none",
                  lineStyle: { type: "dashed", color: "#12B981", opacity: 0.7 },
                  label: { formatter: `Ø ${avgPurchases.toFixed(1)}` },
                  data: [{ yAxis: avgPurchases }],
                },
                markPoint: {
                  symbolSize: 26,
                  label: { fontSize: 10, formatter: "Peak" },
                  data: [
                    {
                      name: "Peak",
                      coord: [topHour ? String(topHour.hour).padStart(2, "0") : "00", maxValue],
                      value: maxValue,
                    },
                  ],
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
