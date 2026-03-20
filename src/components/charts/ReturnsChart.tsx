import { Card, CardContent, Stack, Typography } from "@mui/material";
import { EChart } from "./EChart";

interface ReturnsChartProps {
  orders: number;
  returnedOrders: number;
  returnRate: number;
}

export function ReturnsChart({ orders, returnedOrders, returnRate }: ReturnsChartProps) {
  const keptOrders = Math.max(orders - returnedOrders, 0);
  const returnedPct = Math.max(0, Math.min(100, Number((returnRate * 100).toFixed(1))));

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Retourenquote</Typography>
          <Typography variant="body2" color={returnedPct > 8 ? "error.main" : "primary.main"} fontWeight={700}>
            {returnedPct.toFixed(1)}%
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Donut-Chart fuer behaltene vs. retournierte Bestellungen.
        </Typography>
        <EChart
          option={{
            tooltip: { trigger: "item" },
            legend: { bottom: 0, left: "center" },
            series: [
              {
                type: "pie",
                radius: ["48%", "72%"],
                center: ["50%", "42%"],
                itemStyle: { borderColor: "#fff", borderWidth: 2 },
                label: { show: false },
                data: [
                  { value: keptOrders, name: "Behalten", itemStyle: { color: "#12B981" } },
                  { value: returnedOrders, name: "Retouren", itemStyle: { color: "#F04438" } },
                ],
              },
            ],
            graphic: [
              {
                type: "text",
                left: "center",
                top: "35%",
                style: {
                  text: `${returnedPct.toFixed(1)}%\nRetouren`,
                  fill: "#344054",
                  fontSize: 14,
                  fontWeight: 700,
                },
              },
            ],
          }}
          height={260}
        />
        <Typography variant="caption" color="text.secondary">
          Gesamtbestellungen: {orders}
        </Typography>
      </CardContent>
    </Card>
  );
}
