import { Card, CardContent, Typography } from "@mui/material";

interface KpiCardProps {
  label: string;
  value: string;
  helper?: string;
}

export function KpiCard({ label, value, helper }: KpiCardProps) {
  return (
    <Card>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" mt={0.5}>
          {value}
        </Typography>
        {helper ? (
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
