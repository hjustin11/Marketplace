import { Alert, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

interface ActionInsight {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

interface ActionInsightsProps {
  insights: ActionInsight[];
}

export function ActionInsights({ insights }: ActionInsightsProps) {
  const severityLabel: Record<ActionInsight["severity"], "error" | "warning" | "success"> = {
    high: "error",
    medium: "warning",
    low: "success",
  };

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Handlungsempfehlungen</Typography>
          <Chip label={`${insights.length} Prioritaeten`} color="primary" size="small" />
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Konkrete BI-Hinweise fuer schnelle Entscheidungen.
        </Typography>
        <Stack gap={1} sx={{ mt: "auto" }}>
        {insights.map((insight) => (
          <Alert key={insight.id} severity={severityLabel[insight.severity]} variant="outlined">
            <Typography variant="subtitle2" fontWeight={700}>
              {insight.title}
            </Typography>
            <Typography variant="body2">{insight.detail}</Typography>
          </Alert>
        ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
