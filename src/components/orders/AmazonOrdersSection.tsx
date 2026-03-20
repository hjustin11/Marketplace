import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowDownUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { MarketplaceOrder } from "../../types/marketplace";

interface AmazonOrdersSectionProps {
  orders: MarketplaceOrder[];
  isLoading: boolean;
}

function formatOrderDate(dateIso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(dateIso));
}

function formatOrderAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function AmazonOrdersSection({ orders, isLoading }: AmazonOrdersSectionProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "purchasedAt", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const tableData = useMemo(() => [...orders], [orders]);
  const returnedCount = tableData.filter((order) => order.returned).length;
  const topCities = new Set(tableData.map((order) => `${order.buyerCity}, ${order.buyerRegion}`));

  const columns = useMemo<ColumnDef<MarketplaceOrder>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Order-ID",
        cell: ({ row }) => (
          <Typography sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
            {row.original.id}
          </Typography>
        ),
      },
      {
        accessorKey: "purchasedAt",
        header: "Kaufzeit",
        cell: ({ row }) => formatOrderDate(row.original.purchasedAt),
      },
      {
        accessorKey: "grossAmountCents",
        header: "Betrag",
        cell: ({ row }) => formatOrderAmount(row.original.grossAmountCents, row.original.currency),
      },
      {
        accessorKey: "itemsCount",
        header: "Artikel",
      },
      {
        id: "buyerLocation",
        header: "Kunde (Ort)",
        accessorFn: (row) => `${row.buyerCity}, ${row.buyerRegion}`,
      },
      {
        accessorKey: "buyerPostalCode",
        header: "PLZ",
      },
      {
        accessorKey: "returned",
        header: "Status",
        cell: ({ row }) => (
          <Chip
            size="small"
            label={row.original.returned ? "Retoure" : "Behalten"}
            color={row.original.returned ? "error" : "success"}
            variant="outlined"
          />
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _, filterValue) => {
      const needle = String(filterValue).toLowerCase().trim();
      if (!needle) {
        return true;
      }
      const values = [
        row.original.id,
        row.original.buyerCity,
        row.original.buyerRegion,
        row.original.buyerPostalCode,
        row.original.returned ? "retoure" : "behalten",
      ];
      return values.some((value) => String(value).toLowerCase().includes(needle));
    },
  });

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h5">Amazon - Kunden-Bestellungen</Typography>
        <Typography variant="body2" color="text.secondary">
          Detailansicht aller Bestellungen im gewaehlten Zeitraum und Filter
        </Typography>
      </div>

      {isLoading ? <Alert severity="info">Lade Bestellungen...</Alert> : null}

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Bestellungen
              </Typography>
              <Typography variant="h5">{tableData.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Retouren
              </Typography>
              <Typography variant="h5">{returnedCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Kunden-Orte
              </Typography>
              <Typography variant="h5">{topCities.size}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} mb={1.5} spacing={1}>
            <Typography variant="h6">BI Orders Grid</Typography>
            <Chip label={`${table.getRowModel().rows.length} Zeilen`} color="primary" />
          </Stack>
          <TextField
            fullWidth
            size="small"
            type="search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Order-ID, Stadt, Region oder Status suchen"
            sx={{ mb: 1.5 }}
          />
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table stickyHeader size="small">
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <TableCell key={header.id}>
                          {header.isPlaceholder ? null : (
                            <Box
                              component="button"
                              type="button"
                              sx={{
                                all: "unset",
                                cursor: canSort ? "pointer" : "default",
                                width: "100%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 0.5,
                              }}
                              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {canSort ? <ArrowDownUp size={14} /> : null}
                            </Box>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>Keine Bestellungen fuer den aktuellen Filter vorhanden.</TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} hover>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {cell.column.columnDef.cell
                            ? flexRender(cell.column.columnDef.cell, cell.getContext())
                            : String(cell.getValue() ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}
