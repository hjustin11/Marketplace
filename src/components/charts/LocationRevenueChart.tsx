import { Card, CardContent, Stack, Typography } from "@mui/material";
import { formatCurrency } from "../../lib/kpi";
import type { LocationPoint } from "../../types/metrics";
import { EChart } from "./EChart";

interface LocationRevenueChartProps {
  points: LocationPoint[];
}

export function LocationRevenueChart({ points }: LocationRevenueChartProps) {
  const topPoints = points.slice(0, 5);
  const topRegion = topPoints[0];
  const total = topPoints.reduce((sum, point) => sum + point.revenueCents, 0);
  const palette = ["#5B7CFA", "#12B981", "#F79009", "#F04438", "#9E77ED"];
  const labels = topPoints.map((point) => point.city);
  const values = topPoints.map((point) => Number((point.revenueCents / 100).toFixed(2)));
  const maxValue = Math.max(...values, 1);

  return (
    <Card
      sx={{
        height: "100%",
        minHeight: 360,
        transition: "transform 180ms ease, box-shadow 180ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 18px 34px rgba(43,58,103,0.16)" },
      }}
    >
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Regionale Umsatzverteilung</Typography>
          <Typography variant="body2" color="primary.main" fontWeight={700}>
            {topRegion ? topRegion.city : "n/a"}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Top-Regionen mit Umsatzanteil und Rangfolge.
        </Typography>
        <EChart
          option={{
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            grid: { left: 12, right: 22, top: 12, bottom: 6, containLabel: true },
            xAxis: {
              type: "value",
              max: maxValue * 1.08,
              axisLabel: { formatter: (value: number) => `${Math.round(value)}€` },
              splitLine: { lineStyle: { color: "rgba(91,124,250,0.12)" } },
            },
            yAxis: { type: "category", data: labels, axisTick: { show: false }, inverse: true },
            series: [
              {
                type: "bar",
                data: values.map((value, index) => ({
                  value,
                  itemStyle: { color: palette[index % palette.length], borderRadius: [0, 8, 8, 0] },
                })),
                barMaxWidth: 20,
                label: { show: true, position: "right" },
              },
            ],
          }}
          height={255}
        />
        <Typography variant="caption" color="text.secondary">
          Top-5 Umsatz: {formatCurrency(total)}
        </Typography>
      </CardContent>
    </Card>
  );
}
