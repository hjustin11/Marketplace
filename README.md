# Multi-Marktplatz Dashboard (TypeScript)

Dashboard fuer mehrere Marktplätze mit separatem Bereich je Marktplatz.

- Amazon: Live-Daten ueber Supabase + Amazon SP-API Sync
- eBay, Etsy: Platzhalter mit Mock-Daten
- Kennzahlen: Umsatz, Retourenquote, Kaufzeit, Wohnort, AOV, Trendvergleich

## Tech Stack

- React + Vite + TypeScript
- Supabase (Postgres + Edge Functions)

## Setup (Frontend)

1. Node.js 20+ installieren
2. Abhaengigkeiten installieren:
   - `npm install`
3. Environment anlegen:
   - `.env.example` nach `.env` kopieren
   - `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` eintragen
4. Dev-Server starten:
   - `npm run dev`

## Deployment auf GitHub Pages

1. Repository auf GitHub erstellen und Code pushen (`main` Branch).
2. In GitHub unter `Settings -> Secrets and variables -> Actions` diese Secrets anlegen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In GitHub unter `Settings -> Pages` als Source `GitHub Actions` auswaehlen.
4. Nach jedem Push auf `main` deployed die App automatisch ueber:
   - `.github/workflows/deploy-github-pages.yml`

Hinweise:
- `vite.config.ts` nutzt `base: "./"`, damit Assets auf GitHub Pages korrekt geladen werden.
- Wenn du die Seite lokal wie Production pruefen willst: `npm run build && npm run preview`.

## Supabase vorbereiten

1. Migrationen anwenden:
   - `supabase/migrations/001_marketplace_orders.sql`
   - `supabase/migrations/002_metrics_views.sql`
2. Edge Function deployen:
   - `supabase/functions/amazon-sync/index.ts`
3. Secrets fuer Amazon SP-API setzen (Supabase Function Secrets, nicht Frontend):
   - `AMAZON_LWA_CLIENT_ID`
   - `AMAZON_LWA_CLIENT_SECRET`
   - `AMAZON_LWA_REFRESH_TOKEN`
   - `AMAZON_AWS_ACCESS_KEY_ID`
   - `AMAZON_AWS_SECRET_ACCESS_KEY`
   - `AMAZON_AWS_REGION` (z. B. `eu-west-1`)
   - `AMAZON_SP_API_ENDPOINT` (z. B. `https://sellingpartnerapi-eu.amazon.com`)
   - `AMAZON_MARKETPLACE_ID` (z. B. Deutschland: `A1PA6795UKMFR9`)

## Amazon Sync nutzen

Der Amazon-Bereich aktualisiert sich automatisch per Live-Sync.

- Die Edge Function ruft die Amazon Orders API im Intervall ab
- Bestellungen werden per Upsert in `marketplace_orders` geschrieben
- Danach laedt das Dashboard die Amazon-Metriken neu

## Manuelle Payload weiterhin moeglich

Die Edge Function unterstuetzt weiterhin manuellen Import per JSON (`mode: "manual"`):

```json
{
  "mode": "manual",
  "orders": [
    {
      "orderId": "AMZ-1001",
      "purchasedAt": "2026-03-17T10:20:00.000Z",
      "grossAmountCents": 8999,
      "currency": "EUR",
      "returned": false,
      "buyerCity": "Berlin",
      "buyerRegion": "Berlin",
      "buyerPostalCode": "10115",
      "itemsCount": 1
    }
  ]
}
```

## Ordnerstruktur

- `src/components`: Layout-, KPI- und Chart-Komponenten
- `src/services`: Supabase/Mock Datenzugriff und Amazon Sync Trigger
- `src/types`: gemeinsame TypeScript Modelle
- `src/lib`: KPI Hilfsfunktionen
- `supabase`: Migrationen und Edge Function
