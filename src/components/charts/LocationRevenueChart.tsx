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

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Regionale Umsatzverteilung</Typography>
          <Typography variant="body2" color="primary.main" fontWeight={700}>
            {topRegion ? topRegion.city : "n/a"}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Donut-Analyse der Top-5 Regionen.
        </Typography>
        <EChart
          option={{
            tooltip: { trigger: "item" },
            legend: { bottom: 0, left: "center" },
            series: [
              {
                type: "pie",
                radius: ["45%", "72%"],
                center: ["50%", "40%"],
                label: { formatter: "{b}" },
                data: topPoints.map((point, index) => ({
                  value: Number((point.revenueCents / 100).toFixed(2)),
                  name: point.city,
                  itemStyle: { color: palette[index % palette.length] },
                })),
              },
            ],
          }}
          height={280}
        />
        <Typography variant="caption" color="text.secondary">
          Top-5 Umsatz: {formatCurrency(total)}
        </Typography>
      </CardContent>
    </Card>
  );
}
