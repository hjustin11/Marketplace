import { useEffect, useState, type ReactNode } from "react";
import type { DateRange, MarketplaceDefinition } from "../../types/marketplace";

type DatePreset = "last7" | "last30" | "last90" | "thisYear" | "custom";

interface DashboardLayoutProps {
  marketplaces: MarketplaceDefinition[];
  selectedMarketplaceId: string;
  onMarketplaceChange: (id: string) => void;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  selectedRegion: string;
  regions: string[];
  onRegionChange: (region: string) => void;
  children: ReactNode;
}

const ACCENT_PRESETS = ["#1f6feb", "#8b5cf6", "#e11d48", "#059669", "#ea580c"] as const;

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const fullHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  if (fullHex.length !== 6) {
    return `rgba(31, 111, 235, ${alpha})`;
  }

  const r = Number.parseInt(fullHex.slice(0, 2), 16);
  const g = Number.parseInt(fullHex.slice(2, 4), 16);
  const b = Number.parseInt(fullHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

  if (preset === "last7") {
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
  range,
  onRangeChange,
  selectedRegion,
  regions,
  onRegionChange,
  children,
}: DashboardLayoutProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("last30");
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem("dashboard.accentColor") ?? "#1f6feb";
  });
  const [compactMode, setCompactMode] = useState(() => {
    return localStorage.getItem("dashboard.compactMode") === "true";
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--accent-color", accentColor);
    document.documentElement.style.setProperty("--accent-soft", hexToRgba(accentColor, 0.18));
    localStorage.setItem("dashboard.accentColor", accentColor);
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.dataset.density = compactMode ? "compact" : "comfortable";
    localStorage.setItem("dashboard.compactMode", String(compactMode));
  }, [compactMode]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Marketplace Dashboard</h1>
        <p>Separater Bereich je Marktplatz</p>
        <nav className="marketplace-nav">
          {marketplaces.map((marketplace) => (
            <button
              key={marketplace.id}
              className={marketplace.id === selectedMarketplaceId ? "active" : ""}
              onClick={() => onMarketplaceChange(marketplace.id)}
              type="button"
            >
              <span>{marketplace.label}</span>
              <small>{marketplace.mode === "live" ? "Live" : "Mock"}</small>
            </button>
          ))}
        </nav>
        <section className="personalization-panel">
          <h3>Personalisierung</h3>
          <p>Farben und Dichte fuer deinen Workflow</p>
          <div className="color-presets">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`color-dot ${accentColor === preset ? "active" : ""}`}
                style={{ backgroundColor: preset }}
                onClick={() => setAccentColor(preset)}
                aria-label={`Farbpreset ${preset}`}
              />
            ))}
          </div>
          <label>
            Eigene Farbe
            <input
              type="color"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
            />
          </label>
          <label className="compact-toggle">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(event) => setCompactMode(event.target.checked)}
            />
            Kompakte Ansicht
          </label>
        </section>
      </aside>
      <main className="content">
        <header className="toolbar">
          <label>
            Zeitraum
            <select
              value={datePreset}
              onChange={(event) => {
                const preset = event.target.value as DatePreset;
                setDatePreset(preset);
                if (preset !== "custom") {
                  onRangeChange(getPresetRange(preset));
                }
              }}
            >
              <option value="last7">Letzte 7 Tage</option>
              <option value="last30">Letzte 30 Tage</option>
              <option value="last90">Letzte 90 Tage</option>
              <option value="thisYear">Dieses Jahr</option>
              <option value="custom">Benutzerdefiniert (Von-Bis)</option>
            </select>
          </label>
          {datePreset === "custom" ? (
            <>
              <label>
                Von
                <input
                  type="date"
                  value={range.from}
                  onChange={(event) =>
                    onRangeChange({
                      from: event.target.value,
                      to: range.to,
                    })
                  }
                />
              </label>
              <label>
                Bis
                <input
                  type="date"
                  value={range.to}
                  onChange={(event) =>
                    onRangeChange({
                      from: range.from,
                      to: event.target.value,
                    })
                  }
                />
              </label>
            </>
          ) : (
            <p className="range-summary">
              Zeitraum: <strong>{range.from}</strong> bis <strong>{range.to}</strong>
            </p>
          )}
          <label>
            Region
            <select
              value={selectedRegion}
              onChange={(event) => onRegionChange(event.target.value)}
            >
              <option value="all">Alle Regionen</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>
        </header>
        {children}
      </main>
    </div>
  );
}
