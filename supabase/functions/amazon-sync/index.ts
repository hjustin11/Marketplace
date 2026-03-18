// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface IncomingOrder {
  orderId: string;
  purchasedAt: string;
  grossAmountCents: number;
  currency: string;
  returned: boolean;
  buyerCity: string;
  buyerRegion: string;
  buyerPostalCode: string;
  itemsCount: number;
}

interface SyncPayload {
  mode?: "sync" | "manual";
  from?: string;
  to?: string;
  maxOrders?: number;
  orderIds?: string[];
  orders?: IncomingOrder[];
}

interface AmazonSpApiOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  OrderTotal?: {
    CurrencyCode?: string;
    Amount?: string;
  };
  ShippingAddress?: {
    City?: string;
    StateOrRegion?: string;
    PostalCode?: string;
  };
  NumberOfItemsShipped?: number;
  NumberOfItemsUnshipped?: number;
}

const AMAZON_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function toCents(value?: string): number {
  if (!value) {
    return 0;
  }
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.round(numeric * 100);
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalQueryString(query: URLSearchParams): string {
  const sorted = [...query.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function getLwaAccessToken(): Promise<string> {
  const clientId = Deno.env.get("AMAZON_LWA_CLIENT_ID");
  const clientSecret = Deno.env.get("AMAZON_LWA_CLIENT_SECRET");
  const refreshToken = Deno.env.get("AMAZON_LWA_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Fehlende Amazon LWA Umgebungsvariablen.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(AMAZON_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: body.toString(),
  });

  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error(`Amazon LWA Token Fehler: ${json.error_description ?? "unbekannt"}`);
  }
  return json.access_token as string;
}

async function signedSpApiGet(
  path: string,
  query: URLSearchParams,
  lwaAccessToken: string,
): Promise<Response> {
  const endpoint = Deno.env.get("AMAZON_SP_API_ENDPOINT") ?? "https://sellingpartnerapi-eu.amazon.com";
  const accessKeyId = Deno.env.get("AMAZON_AWS_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("AMAZON_AWS_SECRET_ACCESS_KEY");
  const region = Deno.env.get("AMAZON_AWS_REGION") ?? "eu-west-1";
  const service = "execute-api";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Fehlende AWS Credentials fuer Amazon SP-API.");
  }

  const baseUrl = new URL(endpoint);
  const host = baseUrl.host;
  const protocol = baseUrl.protocol;
  const now = new Date();
  const iso = now.toISOString();
  const amzDate = iso.replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalQuery = canonicalQueryString(query);
  const canonicalHeaders = `host:${host}\nx-amz-access-token:${lwaAccessToken}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-access-token;x-amz-date";
  const payloadHash = await sha256Hex("");
  const canonicalRequest = [
    "GET",
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestUrl = `${protocol}//${host}${path}?${canonicalQuery}`;
  return fetch(requestUrl, {
    method: "GET",
    headers: {
      host,
      "x-amz-date": amzDate,
      "x-amz-access-token": lwaAccessToken,
      Authorization: authorizationHeader,
      Accept: "application/json",
    },
  });
}

function clampCreatedBefore(toDate: string): string {
  const requestedEnd = new Date(`${toDate}T23:59:59Z`);
  const safeNow = new Date(Date.now() - 5 * 60 * 1000);
  const boundedEnd = requestedEnd.getTime() > safeNow.getTime() ? safeNow : requestedEnd;
  return boundedEnd.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function resolveMarketplaceIds(): string {
  const fromList = Deno.env.get("AMAZON_MARKETPLACE_IDS");
  const fromSingle = Deno.env.get("AMAZON_MARKETPLACE_ID");
  const combined = fromList ?? fromSingle;
  if (!combined) {
    throw new Error("Fehlende AMAZON_MARKETPLACE_ID oder AMAZON_MARKETPLACE_IDS Umgebungsvariable.");
  }

  const ids = combined
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (ids.length === 0) {
    throw new Error("Marketplace IDs sind leer.");
  }

  return ids.join(",");
}

async function fetchOrdersFromAmazon(
  from: string,
  to: string,
  maxOrders: number,
  orderIds?: string[],
): Promise<{ orders: IncomingOrder[]; marketplaceIds: string }> {
  const marketplaceIds = resolveMarketplaceIds();
  const lwaAccessToken = await getLwaAccessToken();
  const incomingOrders: IncomingOrder[] = [];
  let nextToken: string | null = null;
  const createdAfter = `${from}T00:00:00Z`;
  const createdBefore = clampCreatedBefore(to);

  while (incomingOrders.length < maxOrders) {
    const query = new URLSearchParams();
    if (nextToken) {
      query.set("NextToken", nextToken);
    } else {
      query.set("MarketplaceIds", marketplaceIds);
      if (orderIds && orderIds.length > 0) {
        query.set("AmazonOrderIds", orderIds.slice(0, 50).join(","));
      } else {
        // LastUpdated is usually more reliable for incremental/live synchronization.
        query.set("LastUpdatedAfter", createdAfter);
        query.set("LastUpdatedBefore", createdBefore);
      }
      query.set("MaxResultsPerPage", "100");
    }

    const response = await signedSpApiGet("/orders/v0/orders", query, lwaAccessToken);
    const json = await response.json();

    if (!response.ok) {
      throw new Error(
        `Amazon Orders API Fehler (${response.status}): ${JSON.stringify(json)}`,
      );
    }

    const payload = json?.payload;
    const orders = (payload?.Orders ?? []) as AmazonSpApiOrder[];
    for (const order of orders) {
      incomingOrders.push({
        orderId: order.AmazonOrderId,
        purchasedAt: order.PurchaseDate,
        grossAmountCents: toCents(order.OrderTotal?.Amount),
        currency: order.OrderTotal?.CurrencyCode ?? "EUR",
        returned: false,
        buyerCity: order.ShippingAddress?.City ?? "Unbekannt",
        buyerRegion: order.ShippingAddress?.StateOrRegion ?? "Unbekannt",
        buyerPostalCode: order.ShippingAddress?.PostalCode ?? "00000",
        itemsCount:
          (order.NumberOfItemsShipped ?? 0) + (order.NumberOfItemsUnshipped ?? 0) || 1,
      });

      if (incomingOrders.length >= maxOrders) {
        break;
      }
    }

    nextToken = payload?.NextToken ?? null;
    if (!nextToken) {
      break;
    }
  }

  return {
    orders: incomingOrders,
    marketplaceIds,
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase config" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const payload = (await request.json()) as SyncPayload;
  const mode = payload.mode ?? "manual";
  let orders = payload.orders ?? [];
  let marketplaceIdsUsed = Deno.env.get("AMAZON_MARKETPLACE_ID") ?? "";

  if (mode === "sync") {
    if (!payload.from || !payload.to) {
      return jsonResponse({ error: "from und to sind erforderlich." }, 400);
    }
    const maxOrders = Math.min(Math.max(payload.maxOrders ?? 250, 1), 1000);
    try {
      const syncData = await fetchOrdersFromAmazon(
        payload.from,
        payload.to,
        maxOrders,
        payload.orderIds,
      );
      orders = syncData.orders;
      marketplaceIdsUsed = syncData.marketplaceIds;
    } catch (error) {
      await supabase.from("marketplace_sync_runs").insert({
        marketplace_id: "amazon",
        status: "error",
        synced_records: 0,
        details: {
          message: error instanceof Error ? error.message : "Amazon sync failed",
        },
      });
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : "Amazon sync failed",
        },
        500,
      );
    }
  } else if (!Array.isArray(orders)) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  const rows = orders.map((order) => ({
    marketplace_id: "amazon",
    external_order_id: order.orderId,
    purchased_at: order.purchasedAt,
    gross_amount_cents: order.grossAmountCents,
    currency: order.currency ?? "EUR",
    returned: order.returned,
    buyer_city: order.buyerCity,
    buyer_region: order.buyerRegion,
    buyer_postal_code: order.buyerPostalCode,
    items_count: order.itemsCount,
  }));

  const { error } = await supabase
    .from("marketplace_orders")
    .upsert(rows, { onConflict: "marketplace_id,external_order_id" });

  await supabase.from("marketplace_sync_runs").insert({
    marketplace_id: "amazon",
    status: error ? "error" : "success",
    synced_records: rows.length,
    details: error
      ? { message: error.message }
      : {
          source: mode === "sync" ? "amazon-sp-api" : "manual-payload",
          marketplaceIds: marketplaceIdsUsed,
          requestedFrom: payload.from ?? null,
          requestedTo: payload.to ?? null,
        },
  });

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse(
    {
      syncedRecords: rows.length,
      source: mode === "sync" ? "amazon-sp-api" : "manual-payload",
    },
    200,
  );
});
