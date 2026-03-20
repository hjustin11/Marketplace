import { Card, CardContent, Stack, Typography } from "@mui/material";
import type { HourlyPurchasePoint } from "../../types/metrics";
import { DASHBOARD_TIMEZONE } from "../../lib/kpi";
import { EChart } from "./EChart";

interface PurchaseTimeHeatmapProps {
  points: HourlyPurchasePoint[];
}

export function PurchaseTimeHeatmap({ points }: PurchaseTimeHeatmapProps) {
  const topHour = [...points].sort((a, b) => b.purchases - a.purchases)[0];

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Kaufzeitpunkte</Typography>
          <Typography variant="body2" color="primary.main" fontWeight={700}>
            {topHour ? `${String(topHour.hour).padStart(2, "0")}:00` : "n/a"}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Bestellungen pro Stunde ({DASHBOARD_TIMEZONE})
        </Typography>
        <EChart
          option={{
            tooltip: { trigger: "axis" },
            grid: { left: 34, right: 10, top: 12, bottom: 30 },
            xAxis: {
              type: "category",
              data: points.map((point) => String(point.hour).padStart(2, "0")),
              axisTick: { show: false },
            },
            yAxis: {
              type: "value",
              splitLine: { lineStyle: { color: "rgba(91,124,250,0.13)" } },
            },
            visualMap: {
              min: 0,
              max: Math.max(...points.map((point) => point.purchases), 1),
              orient: "horizontal",
              left: "center",
              bottom: 0,
              inRange: { color: ["#dbeafe", "#5B7CFA"] },
              showLabel: false,
              itemWidth: 90,
            },
            series: [
              {
                type: "bar",
                data: points.map((point) => point.purchases),
                barMaxWidth: 18,
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
