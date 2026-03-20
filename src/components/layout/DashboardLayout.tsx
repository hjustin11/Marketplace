import {
  AppBar,
  Box,
  Chip,
  Container,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  type SelectChangeEvent,
} from "@mui/material";
import { LayoutDashboard, LineChart, Menu, Store } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DateRange, MarketplaceDefinition } from "../../types/marketplace";

type DatePreset = "today" | "last7" | "last30" | "last90" | "thisYear" | "custom";

interface DashboardLayoutProps {
  marketplaces: MarketplaceDefinition[];
  selectedMarketplaceId: string;
  onMarketplaceChange: (id: string) => void;
  isForecastSelected?: boolean;
  onForecastSelect?: () => void;
  isAmazonOrdersSelected?: boolean;
  onAmazonOrdersSelect?: () => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  selectedRegion: string;
  regions: string[];
  onRegionChange: (region: string) => void;
  children: ReactNode;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: Exclude<DatePreset, "custom">): DateRange {
  const to = new Date();
  const from = new Date(to);

  if (preset === "today") {
    // Keep only current-day data for a true live-focused view.
  } else if (preset === "last7") {
    from.setDate(from.getDate() - 6);
  } else if (preset === "last30") {
    from.setDate(from.getDate() - 29);
  } else if (preset === "last90") {
    from.setDate(from.getDate() - 89);
  } else if (preset === "thisYear") {
    from.setMonth(0, 1);
  }

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  };
}

export function DashboardLayout({
  marketplaces,
  selectedMarketplaceId,
  onMarketplaceChange,
  isForecastSelected = false,
  onForecastSelect,
  isAmazonOrdersSelected = false,
  onAmazonOrdersSelect,
  range,
  onRangeChange,
  selectedRegion,
  regions,
  onRegionChange,
  children,
}: DashboardLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const drawerContent = (
    <Box sx={{ width: 260, p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <Store size={16} />
        <Typography variant="subtitle1" fontWeight={700}>
          Marktplaetze
        </Typography>
      </Stack>
      <List dense>
        {marketplaces.map((marketplace) => {
          const isMarketplaceActive =
            marketplace.id === selectedMarketplaceId && !isForecastSelected && !isAmazonOrdersSelected;
          const isAmazonGroup = marketplace.id === "amazon";
          return (
            <Box key={marketplace.id}>
              <ListItemButton selected={isMarketplaceActive} onClick={() => onMarketplaceChange(marketplace.id)}>
                <ListItemText primary={marketplace.label} secondary={marketplace.mode === "live" ? "Live" : "Mock"} />
              </ListItemButton>
              {isAmazonGroup && onAmazonOrdersSelect ? (
                <ListItemButton selected={isAmazonOrdersSelected} sx={{ pl: 4 }} onClick={() => onAmazonOrdersSelect()}>
                  <ListItemText primary="Kunden-Bestellungen" secondary="Amazon Detail" />
                </ListItemButton>
              ) : null}
            </Box>
          );
        })}
      </List>
      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <LineChart size={16} />
        <Typography variant="subtitle1" fontWeight={700}>
          Analyse
        </Typography>
      </Stack>
      {onForecastSelect ? (
        <List dense>
          <ListItemButton selected={isForecastSelected} onClick={() => onForecastSelect()}>
            <ListItemText primary="Forecast" secondary="AI Forecast" />
          </ListItemButton>
        </List>
      ) : null}
    </Box>
  );

  const handlePresetChange = (event: SelectChangeEvent<DatePreset>) => {
    const preset = event.target.value as DatePreset;
    setDatePreset(preset);
    if (preset !== "custom") {
      onRangeChange(getPresetRange(preset));
    }
  };

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(255,255,255,0.86)", borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile ? (
            <IconButton onClick={() => setDrawerOpen(true)}>
              <Menu size={16} />
            </IconButton>
          ) : (
            <LayoutDashboard size={18} />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Marketplace Intelligence Dashboard</Typography>
            <Typography variant="caption" color="text.secondary">
              Modernes BI-Workspace mit Fokus auf Klarheit und Geschwindigkeit
            </Typography>
          </Box>
          <Chip size="small" color="primary" label="Modern BI UI" />
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
        {isMobile ? (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer variant="permanent" open sx={{ width: 260, flexShrink: 0, "& .MuiDrawer-paper": { width: 260, borderRight: 1, borderColor: "divider", boxSizing: "border-box" } }}>
            <Toolbar />
            {drawerContent}
          </Drawer>
        )}

        <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, md: 3 } }}>
          <Paper sx={{ p: 2.2, mb: 2.2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
              Command Center
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="range-preset-label">Zeitraum</InputLabel>
                <Select<DatePreset>
                  labelId="range-preset-label"
                  value={datePreset}
                  label="Zeitraum"
                  onChange={handlePresetChange}
                >
                  <MenuItem value="today">Heute (Live)</MenuItem>
                  <MenuItem value="last7">Letzte 7 Tage</MenuItem>
                  <MenuItem value="last30">Letzte 30 Tage</MenuItem>
                  <MenuItem value="last90">Letzte 90 Tage</MenuItem>
                  <MenuItem value="thisYear">Dieses Jahr</MenuItem>
                  <MenuItem value="custom">Benutzerdefiniert</MenuItem>
                </Select>
              </FormControl>

              {datePreset === "custom" ? (
                <>
                  <TextField
                    size="small"
                    label="Von"
                    type="date"
                    value={range.from}
                    onChange={(event) => onRangeChange({ from: event.target.value, to: range.to })}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    label="Bis"
                    type="date"
                    value={range.to}
                    onChange={(event) => onRangeChange({ from: range.from, to: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </>
              ) : (
                <Paper variant="outlined" sx={{ px: 1.5, py: 1, display: "inline-flex", alignItems: "center" }}>
                  <Typography variant="body2">
                    Zeitraum: <strong>{range.from}</strong> bis <strong>{range.to}</strong>
                  </Typography>
                </Paper>
              )}

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="region-label">Region</InputLabel>
                <Select
                  labelId="region-label"
                  value={selectedRegion}
                  label="Region"
                  onChange={(event) => onRegionChange(event.target.value)}
                >
                  <MenuItem value="all">Alle Regionen</MenuItem>
                  {regions.map((region) => (
                    <MenuItem key={region} value={region}>
                      {region}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Paper>

          {children}
        </Container>
      </Box>
    </Box>
  );
}
