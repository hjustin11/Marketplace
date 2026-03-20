import {
  AppBar,
  Avatar,
  Button,
  Box,
  Chip,
  Container,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  MenuItem,
  IconButton as MIconButton,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tab,
  Tabs,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  type SelectChangeEvent,
} from "@mui/material";
import { LayoutDashboard, LineChart, Menu, Settings2, Store, UserCircle2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { DateRange, MarketplaceDefinition } from "../../types/marketplace";

type DatePreset = "today" | "last7" | "last30" | "last90" | "thisYear" | "custom";
type DashboardDensity = "compact" | "comfortable";

interface DashboardLayoutProps {
  marketplaces: MarketplaceDefinition[];
  selectedMarketplaceId: string;
  selectedMarketplace: MarketplaceDefinition;
  selectedMarketplaceDataSource?: "supabase" | "mock";
  onMarketplaceChange: (id: string) => void;
  onMarketplaceAdd: (input: { label: string; mode: "live" | "mock"; description: string }) => void;
  onMarketplaceRemove: (id: string) => void;
  kpiOptions: { id: string; label: string }[];
  visibleKpiIds: string[];
  onToggleKpi: (id: string) => void;
  chartOptions: { id: string; label: string }[];
  visibleChartIds: string[];
  onToggleChart: (id: string) => void;
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

function getMarketplaceGuide(marketplaceId: string): { title: string; steps: string[] } {
  if (marketplaceId === "amazon") {
    return {
      title: "Amazon Live API Anbindung",
      steps: [
        "SP-API App in Amazon Seller Central erstellen und LWA/Refresh Token erfassen.",
        "Credentials als Secrets hinterlegen (`AMAZON_CLIENT_ID`, `AMAZON_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN`).",
        "Sync-Endpunkt (`amazon-sync`) aktivieren und zuerst manuellen Test mit engem Zeitraum ausfuehren.",
        "Order-Felder auf `external_order_id`, `purchased_at`, `gross_amount_cents`, `payment_status` mappen.",
        "Cron/Livesync aktivieren und API-Limit/Quota im Dashboard beobachten.",
      ],
    };
  }
  if (marketplaceId === "ebay") {
    return {
      title: "eBay Live API Anbindung",
      steps: [
        "eBay Developer App erstellen und OAuth fuer Sell APIs konfigurieren.",
        "Scopes fuer Fulfillment/Finance aktivieren und Refresh Token serverseitig speichern.",
        "Orders aus `fulfillment` API ziehen und Zahlstatus (`paymentStatus`) auf `paid|pending` abbilden.",
        "Antworten in `marketplace_orders` mit `marketplace_id='ebay'` speichern.",
        "Webhook oder Polling alle 5-15 Minuten einrichten und Delta-Updates fahren.",
      ],
    };
  }
  if (marketplaceId === "etsy") {
    return {
      title: "Etsy Live API Anbindung",
      steps: [
        "Etsy App erstellen und OAuth Token mit Shop-Rechten erzeugen.",
        "Order-Endpoint fuer Receipts nutzen und relevante Felder ins Standardschema mappen.",
        "`payment_status` strikt pflegen, damit offene Zahlungen korrekt aus KPIs ausgeschlossen werden.",
        "Sync Worker fuer inkrementelle Abfragen nach `updated_at` bauen.",
        "Fehler- und Retry-Handling mit Backoff aktivieren.",
      ],
    };
  }
  return {
    title: `${marketplaceId} API Anbindung`,
    steps: [
      "API-Credentials im jeweiligen Marktplatzportal erzeugen und sicher als Secrets speichern.",
      "Order-Import bauen: `external_order_id`, `purchased_at`, `gross_amount_cents`, `payment_status` mappen.",
      "Daten in `marketplace_orders` mit eigener `marketplace_id` schreiben.",
      "Sync zuerst manuell testen, dann Polling/Webhook fuer Live-Betrieb aktivieren.",
      "Monitoring fuer Fehler, Quotas und Datenqualitaet einrichten.",
    ],
  };
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
  selectedMarketplace,
  selectedMarketplaceDataSource = "mock",
  onMarketplaceChange,
  onMarketplaceAdd,
  onMarketplaceRemove,
  kpiOptions,
  visibleKpiIds,
  onToggleKpi,
  chartOptions,
  visibleChartIds,
  onToggleChart,
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
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"profile" | "edit">("edit");
  const [dashboardDensity, setDashboardDensity] = useState<DashboardDensity>(
    () => (localStorage.getItem("dashboard.density") as DashboardDensity) || "comfortable",
  );
  const [accentColor, setAccentColor] = useState(
    () => localStorage.getItem("dashboard.accentColor") || "#5B7CFA",
  );
  const [vividCards, setVividCards] = useState(
    () => localStorage.getItem("dashboard.vividCards") === "true",
  );
  const [newMarketplaceLabel, setNewMarketplaceLabel] = useState("");
  const [newMarketplaceDescription, setNewMarketplaceDescription] = useState("");
  const [newMarketplaceMode, setNewMarketplaceMode] = useState<"live" | "mock">("mock");
  const [removeConfirmStep, setRemoveConfirmStep] = useState<Record<string, 0 | 1>>({});
  const [cardRadius, setCardRadius] = useState(() => Number(localStorage.getItem("dashboard.cardRadius") ?? 14));
  const [chartAnimations, setChartAnimations] = useState(
    () => localStorage.getItem("dashboard.chartAnimations") !== "false",
  );
  const shouldShowIntegrationGuide = selectedMarketplaceDataSource !== "supabase";

  useEffect(() => {
    document.documentElement.style.setProperty("--dashboard-accent", accentColor);
    localStorage.setItem("dashboard.accentColor", accentColor);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem("dashboard.density", dashboardDensity);
  }, [dashboardDensity]);

  useEffect(() => {
    localStorage.setItem("dashboard.vividCards", vividCards ? "true" : "false");
  }, [vividCards]);

  useEffect(() => {
    localStorage.setItem("dashboard.cardRadius", String(cardRadius));
  }, [cardRadius]);

  useEffect(() => {
    document.documentElement.dataset.chartAnimations = chartAnimations ? "on" : "off";
    localStorage.setItem("dashboard.chartAnimations", chartAnimations ? "true" : "false");
  }, [chartAnimations]);

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
          <Button
            variant="outlined"
            startIcon={<Settings2 size={15} />}
            onClick={() => {
              setAccountTab("edit");
              setAccountDrawerOpen(true);
            }}
          >
            Bearbeiten
          </Button>
          <IconButton
            onClick={() => {
              setAccountTab("profile");
              setAccountDrawerOpen(true);
            }}
          >
            <Avatar sx={{ width: 30, height: 30 }}>
              <UserCircle2 size={16} />
            </Avatar>
          </IconButton>
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

        <Container
          maxWidth={false}
          sx={{
            py: dashboardDensity === "compact" ? 2 : 3,
            px: { xs: 2, md: dashboardDensity === "compact" ? 2 : 3 },
            "& .MuiCard-root": {
              borderColor: "color-mix(in srgb, var(--dashboard-accent, #5B7CFA) 22%, #dbe4ff 78%)",
              background: vividCards
                ? "linear-gradient(150deg, rgba(255,255,255,0.96), rgba(239,244,255,0.92))"
                : "#fff",
              borderRadius: `${cardRadius}px`,
              transition: "transform 160ms ease, box-shadow 160ms ease",
            },
          }}
        >
          <Paper sx={{ p: dashboardDensity === "compact" ? 1.6 : 2.2, mb: 2.2 }}>
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

          {shouldShowIntegrationGuide ? (
            <Paper sx={{ p: 2, mb: 2.2, border: "1px dashed", borderColor: "divider" }}>
              <Typography variant="subtitle1" fontWeight={700} mb={0.8}>
                {getMarketplaceGuide(selectedMarketplace.id).title}
              </Typography>
              <Stack spacing={0.45}>
                {getMarketplaceGuide(selectedMarketplace.id).steps.map((step, index) => (
                  <Typography key={`${selectedMarketplace.id}-guide-${index}`} variant="body2" color="text.secondary">
                    {index + 1}. {step}
                  </Typography>
                ))}
              </Stack>
            </Paper>
          ) : null}

          {children}
        </Container>
      </Box>

      <Drawer
        anchor="right"
        open={accountDrawerOpen}
        onClose={() => setAccountDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 2 } }}
      >
        <Typography variant="h6" fontWeight={700} mb={1}>
          Account & Bearbeiten
        </Typography>
        <Tabs
          value={accountTab}
          onChange={(_, value: "profile" | "edit") => setAccountTab(value)}
          sx={{ mb: 2 }}
        >
          <Tab value="profile" label="Account" />
          <Tab value="edit" label="Bearbeiten" />
        </Tabs>

        {accountTab === "profile" ? (
          <Stack spacing={1.2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Dein Dashboard-Profil
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hier findest du deinen zentralen Zugang zu Personalisierung, Marktplatz-Verwaltung und Layout-Steuerung.
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.2 }}>
              <Typography variant="body2">Aktiver Marktplatz: <strong>{selectedMarketplace.label}</strong></Typography>
              <Typography variant="body2">Datenquelle: <strong>{selectedMarketplaceDataSource === "supabase" ? "Live" : "Mock"}</strong></Typography>
            </Paper>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Design & Verhalten
              </Typography>
              <Stack spacing={1}>
                <FormControl size="small">
                  <InputLabel id="dashboard-density-label">Dichte</InputLabel>
                  <Select
                    labelId="dashboard-density-label"
                    value={dashboardDensity}
                    label="Dichte"
                    onChange={(event) => setDashboardDensity(event.target.value as DashboardDensity)}
                  >
                    <MenuItem value="compact">Kompakt</MenuItem>
                    <MenuItem value="comfortable">Komfortabel</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="color"
                  label="Akzentfarbe"
                  value={accentColor}
                  onChange={(event) => setAccentColor(event.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormControlLabel
                  control={<Switch checked={vividCards} onChange={(event) => setVividCards(event.target.checked)} />}
                  label="Vivid Cards"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={chartAnimations}
                      onChange={(event) => setChartAnimations(event.target.checked)}
                    />
                  }
                  label="Chart-Animationen"
                />
                <TextField
                  size="small"
                  type="number"
                  label="Kartenradius"
                  value={cardRadius}
                  onChange={(event) =>
                    setCardRadius(
                      Math.max(6, Math.min(32, Number.parseInt(event.target.value || "14", 10))),
                    )
                  }
                />
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Widgets
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={0.6}>
                    KPI Widgets
                  </Typography>
                  <FormGroup>
                    {kpiOptions.map((option) => (
                      <FormControlLabel
                        key={`kpi-${option.id}`}
                        control={
                          <Switch
                            checked={visibleKpiIds.includes(option.id)}
                            onChange={() => onToggleKpi(option.id)}
                          />
                        }
                        label={option.label}
                      />
                    ))}
                  </FormGroup>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={0.6}>
                    Chart Widgets
                  </Typography>
                  <FormGroup>
                    {chartOptions.map((option) => (
                      <FormControlLabel
                        key={`chart-${option.id}`}
                        control={
                          <Switch
                            checked={visibleChartIds.includes(option.id)}
                            onChange={() => onToggleChart(option.id)}
                          />
                        }
                        label={option.label}
                      />
                    ))}
                  </FormGroup>
                </Box>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.2 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>
                Marktplatz verwalten
              </Typography>
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="Name"
                  value={newMarketplaceLabel}
                  onChange={(event) => setNewMarketplaceLabel(event.target.value)}
                />
                <TextField
                  size="small"
                  label="Beschreibung"
                  value={newMarketplaceDescription}
                  onChange={(event) => setNewMarketplaceDescription(event.target.value)}
                />
                <FormControl size="small">
                  <InputLabel id="new-marketplace-mode-label">Modus</InputLabel>
                  <Select
                    labelId="new-marketplace-mode-label"
                    value={newMarketplaceMode}
                    label="Modus"
                    onChange={(event) => setNewMarketplaceMode(event.target.value as "live" | "mock")}
                  >
                    <MenuItem value="mock">Mock</MenuItem>
                    <MenuItem value="live">Live</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  disabled={!newMarketplaceLabel.trim()}
                  onClick={() => {
                    onMarketplaceAdd({
                      label: newMarketplaceLabel,
                      description: newMarketplaceDescription,
                      mode: newMarketplaceMode,
                    });
                    setNewMarketplaceLabel("");
                    setNewMarketplaceDescription("");
                    setNewMarketplaceMode("mock");
                  }}
                >
                  Marktplatz hinzufuegen
                </Button>
              </Stack>
              <List dense sx={{ mt: 1 }}>
                {marketplaces.map((marketplace) => (
                  <ListItemButton key={`remove-${marketplace.id}`} sx={{ borderRadius: 1 }}>
                    <ListItemText primary={marketplace.label} secondary={marketplace.id} />
                    <ListItemSecondaryAction>
                      <MIconButton
                        edge="end"
                        size="small"
                        disabled={marketplaces.length <= 1}
                        onClick={() => {
                          const currentStep = removeConfirmStep[marketplace.id] ?? 0;
                          if (currentStep === 0) {
                            const firstConfirm = window.confirm(
                              `Marktplatz "${marketplace.label}" wirklich entfernen?`,
                            );
                            if (!firstConfirm) {
                              setRemoveConfirmStep((current) => ({ ...current, [marketplace.id]: 0 }));
                              return;
                            }
                            setRemoveConfirmStep((current) => ({ ...current, [marketplace.id]: 1 }));
                            return;
                          }
                          const secondConfirm = window.confirm(
                            `Letzte Sicherheitsabfrage: "${marketplace.label}" dauerhaft loeschen?`,
                          );
                          if (secondConfirm) {
                            onMarketplaceRemove(marketplace.id);
                          }
                          setRemoveConfirmStep((current) => ({ ...current, [marketplace.id]: 0 }));
                        }}
                      >
                        ×
                      </MIconButton>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}
