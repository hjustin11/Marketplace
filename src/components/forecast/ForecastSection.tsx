import { Alert, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { formatCurrency, formatPercent } from "../../lib/kpi";
import { computeForecast } from "../../lib/forecast";
import type { MarketplaceDefinition } from "../../types/marketplace";
import type { MarketplaceMetrics } from "../../types/metrics";

interface ForecastSectionProps {
  marketplace: MarketplaceDefinition;
  metrics: MarketplaceMetrics | null;
  isLoading: boolean;
  errorMessage: string | null;
}

function confidenceLabel(level: "high" | "medium" | "low"): string {
  if (level === "high") {
    return "Hoch";
  }
  if (level === "medium") {
    return "Mittel";
  }
  return "Niedrig";
}

export function ForecastSection({ marketplace, metrics, isLoading, errorMessage }: ForecastSectionProps) {
  if (isLoading) {
    return <Alert severity="info">Prognose wird geladen...</Alert>;
  }

  if (errorMessage) {
    return <Alert severity="error">Prognose-Fehler: {errorMessage}</Alert>;
  }

  if (!metrics || metrics.dailySales.length < 7) {
    return (
      <Stack spacing={1}>
        <Typography variant="h5">Forecast - {marketplace.label}</Typography>
        <Typography variant="body2" color="text.secondary">
          Monat, Quartal und Jahr auf Basis historischer Werte.
        </Typography>
        <Alert severity="warning">
          Noch zu wenige historische Daten fuer eine belastbare Prognose (mindestens 7 Tage notwendig).
        </Alert>
      </Stack>
    );
  }

  const forecast = computeForecast(metrics);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
        <div>
          <Typography variant="h5">Forecast - {marketplace.label}</Typography>
          <Typography variant="body2" color="text.secondary">
            Umsatz-, Bestell- und Risiko-Projektion aus historischen Daten
          </Typography>
        </div>
        <Chip color={forecast.confidence === "high" ? "success" : forecast.confidence === "medium" ? "warning" : "default"} label={`Prognose-Sicherheit: ${confidenceLabel(forecast.confidence)}`} />
      </Stack>

      <Alert severity="info">
        Datenbasis: {forecast.lookbackDays} Tage · Trend: {formatPercent(forecast.trendPct)} · Volatilitaet:{" "}
        {formatPercent(forecast.volatility)}
      </Alert>

      <Grid container spacing={1.5}>
        {forecast.periods.map((period) => (
          <Grid key={period.id} size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6">{period.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Horizont: {period.horizonDays} Tage
                </Typography>
                <Typography variant="h4" mt={1} mb={1.2}>
                  {formatCurrency(period.projectedRevenueCents)}
                </Typography>
                <Stack spacing={0.4}>
                  <Typography variant="body2">Bestellungen: {period.projectedOrders}</Typography>
                  <Typography variant="body2">Retouren: {period.projectedReturnedOrders}</Typography>
                  <Typography variant="body2">Netto: {formatCurrency(period.projectedNetRevenueCents)}</Typography>
                  <Typography variant="body2">AOV: {formatCurrency(period.projectedAverageOrderValueCents)}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
