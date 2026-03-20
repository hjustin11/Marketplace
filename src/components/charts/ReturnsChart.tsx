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
                  {
                    value: keptOrders,
                    name: "Behalten",
                    itemStyle: {
                      color: {
                        type: "linear",
                        x: 0,
                        y: 0,
                        x2: 1,
                        y2: 1,
                        colorStops: [
                          { offset: 0, color: "#16C98D" },
                          { offset: 1, color: "#0E9F6E" },
                        ],
                      },
                    },
                  },
                  {
                    value: returnedOrders,
                    name: "Retouren",
                    itemStyle: {
                      color: {
                        type: "linear",
                        x: 0,
                        y: 0,
                        x2: 1,
                        y2: 1,
                        colorStops: [
                          { offset: 0, color: "#FF7A7A" },
                          { offset: 1, color: "#F04438" },
                        ],
                      },
                    },
                  },
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
          height={245}
        />
        <Typography variant="caption" color="text.secondary">
          Gesamtbestellungen: {orders}
        </Typography>
      </CardContent>
    </Card>
  );
}
