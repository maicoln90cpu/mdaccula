// Bunny CDN Statistics - centraliza dados oficiais do Bunny (pull zone + storage zone)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PULL_ZONE_ID = Deno.env.get("BUNNY_PULL_ZONE_ID");
const STORAGE_ZONE_ID = Deno.env.get("BUNNY_STORAGE_ZONE_ID");
const ACCOUNT_KEY = Deno.env.get("BUNNY_ACCOUNT_API_KEY");

// in-memory cache (5 min TTL)
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 5 * 60 * 1000;

function chartToSeries(chart: Record<string, number> | undefined) {
  if (!chart) return [];
  return Object.entries(chart)
    .map(([t, v]) => ({ t, v: Number(v) || 0 }))
    .sort((a, b) => a.t.localeCompare(b.t));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ---- admin auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ACCOUNT_KEY || !PULL_ZONE_ID || !STORAGE_ZONE_ID) {
      return new Response(
        JSON.stringify({ error: "Missing Bunny secrets (BUNNY_ACCOUNT_API_KEY / PULL_ZONE_ID / STORAGE_ZONE_ID)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- params (suporta body POST e query) ----
    let bodyParams: Record<string, unknown> = {};
    if (req.method === "POST") { try { bodyParams = await req.json(); } catch { /* noop */ } }
    const url = new URL(req.url);
    const mode = String(bodyParams.mode || url.searchParams.get("mode") || "range");
    const isLifetime = mode === "lifetime";
    const days = Math.max(1, Math.min(90, Number(bodyParams.days || url.searchParams.get("days") || 7)));
    const hourly = (bodyParams.hourly === true) || url.searchParams.get("hourly") === "true";
    const now = new Date();
    const from = isLifetime
      ? new Date("2020-01-01T00:00:00Z")
      : new Date(now.getTime() - days * 24 * 3600 * 1000);
    const dateFrom = from.toISOString().slice(0, 19);
    const dateTo = now.toISOString().slice(0, 19);

    const cacheKey = `${mode}-${days}-${hourly}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return new Response(JSON.stringify({ ...(hit.data as object), cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = { AccessKey: ACCOUNT_KEY, Accept: "application/json" };
    const statsUrl = `https://api.bunny.net/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}&pullZone=${PULL_ZONE_ID}&hourly=${hourly}`;
    const storageStatsUrl = `https://api.bunny.net/storagezone/${STORAGE_ZONE_ID}/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const storageInfoUrl = `https://api.bunny.net/storagezone/${STORAGE_ZONE_ID}`;

    const [statsRes, storageStatsRes, storageInfoRes] = await Promise.all([
      fetch(statsUrl, { headers }),
      fetch(storageStatsUrl, { headers }),
      fetch(storageInfoUrl, { headers }),
    ]);

    if (!statsRes.ok) {
      const t = await statsRes.text();
      return new Response(JSON.stringify({ error: "Bunny /statistics failed", status: statsRes.status, detail: t }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stats = await statsRes.json();
    const storageStats = storageStatsRes.ok ? await storageStatsRes.json() : {};
    const storageInfo = storageInfoRes.ok ? await storageInfoRes.json() : {};

    const bandwidthBytes = Number(stats.TotalBandwidthUsed || 0);
    const bandwidthGB = bandwidthBytes / (1024 ** 3);
    const COST_PER_GB = 0.043; // média Standard tier (alinhada com $2.61 / 60.82 GB)
    const estimatedCostUSD = bandwidthGB * COST_PER_GB;

    const payload = {
      window: { dateFrom, dateTo, days, hourly, mode },
      estimatedCostUSD,
      pullZone: {
        bandwidthBytes: Number(stats.TotalBandwidthUsed || 0),
        originBytes: Number(stats.TotalOriginTraffic || 0),
        requests: Number(stats.TotalRequestsServed || 0),
        cacheHitRate: Number(stats.CacheHitRate || 0),
        avgOriginResponseMs: Number(stats.AverageOriginResponseTime || 0),
        errors: {
          err3xx: Number(stats.Total3xxResponses || 0),
          err4xx: Number(stats.Total4xxResponses || 0),
          err5xx: Number(stats.Total5xxResponses || 0),
        },
        charts: {
          bandwidth: chartToSeries(stats.BandwidthUsedChart),
          bandwidthCached: chartToSeries(stats.BandwidthCachedChart),
          requests: chartToSeries(stats.RequestsServedChart),
          cacheHitRate: chartToSeries(stats.CacheHitRateChart),
          originTraffic: chartToSeries(stats.OriginTrafficChart),
          originResponseTime: chartToSeries(stats.OriginResponseTimeChart),
          err3xx: chartToSeries(stats.Error3xxChart),
          err4xx: chartToSeries(stats.Error4xxChart),
          err5xx: chartToSeries(stats.Error5xxChart),
        },
        geo: stats.GeoTrafficDistribution || {},
      },
      storage: {
        bytesUsed: Number(storageInfo.StorageUsed || 0),
        files: Number(storageInfo.FilesStored || 0),
        region: storageInfo.Region || null,
        replicationRegions: storageInfo.ReplicationRegions || [],
        charts: {
          storageUsed: chartToSeries(storageStats.StorageUsedChart),
          fileCount: chartToSeries(storageStats.FileCountChart),
        },
      },
      fetchedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { at: Date.now(), data: payload });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bunny-stats error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
