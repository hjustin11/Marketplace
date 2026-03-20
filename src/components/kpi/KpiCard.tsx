import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

interface KpiCardProps {
  label: string;
  value: string;
  helper?: string;
  trendPct?: number;
  sparklineValues?: number[];
  onClick?: () => void;
}

function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return "";
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function KpiCard({ label, value, helper, trendPct, sparklineValues, onClick }: KpiCardProps) {
  const hasTrend = typeof trendPct === "number";
  const trendLabel = hasTrend ? `${trendPct > 0 ? "+" : ""}${(trendPct * 100).toFixed(1)}%` : null;
  const sparkline = (sparklineValues ?? []).slice(-12);
  const sparklinePath = buildSparklinePath(sparkline, 130, 28);

  return (
    <Card
      onClick={onClick}
      sx={{
        height: "100%",
        minHeight: 176,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "0 18px 34px rgba(43,58,103,0.16)",
          borderColor: "rgba(91,124,250,0.38)",
        },
      }}
    >
      <CardContent sx={{ py: 2, height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {trendLabel ? (
            <Chip
              size="small"
              label={trendLabel}
              color={(trendPct ?? 0) > 0 ? "success" : (trendPct ?? 0) < 0 ? "error" : "default"}
              variant="outlined"
            />
          ) : null}
        </Stack>
        <Typography variant="h5" mt={0.7}>
          {value}
        </Typography>
        <Box sx={{ minHeight: 20 }}>
          {helper ? <Typography variant="caption" color="text.secondary">{helper}</Typography> : null}
        </Box>
        <Box sx={{ mt: "auto" }}>
        {sparkline.length > 1 ? (
          <Box mt={1.2}>
            <svg width="100%" viewBox="0 0 130 32" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="kpiSpark" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#5B7CFA" />
                  <stop offset="100%" stopColor="#12B981" />
                </linearGradient>
              </defs>
              <path d={sparklinePath} fill="none" stroke="url(#kpiSpark)" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </Box>
        ) : (
          <Box sx={{ height: 33 }} />
        )}
        </Box>
      </CardContent>
    </Card>
  );
}
