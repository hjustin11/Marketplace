import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { formatCurrency } from "../../lib/kpi";
import type { LocationPoint } from "../../types/metrics";

interface LocationBreakdownProps {
  points: LocationPoint[];
}

export function LocationBreakdown({ points }: LocationBreakdownProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" mb={0.5}>
          Wohnort-Verteilung
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Top-Orte nach Umsatz und Bestellvolumen
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>PLZ</TableCell>
                <TableCell>Stadt</TableCell>
                <TableCell>Region</TableCell>
                <TableCell align="right">Bestellungen</TableCell>
                <TableCell align="right">Umsatz</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {points.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Keine Daten im gewaehlten Filter.</TableCell>
                </TableRow>
              ) : (
                points.map((point) => (
                  <TableRow key={point.key} hover>
                    <TableCell>{point.postalCode}</TableCell>
                    <TableCell>{point.city}</TableCell>
                    <TableCell>{point.region}</TableCell>
                    <TableCell align="right">{point.orders}</TableCell>
                    <TableCell align="right">{formatCurrency(point.revenueCents)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
