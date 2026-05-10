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
    const bust = (bodyParams.bust === true) || url.searchParams.get("bust") === "1";
    const now = new Date();

    const headers = { AccessKey: ACCOUNT_KEY, Accept: "application/json" };

    // Para lifetime, descobrir DateCreated da pull zone para evitar chunks
    // pré-existência (que causam Bunny 400 e zeram o agregado).
    let lifetimeFrom = new Date("2020-01-01T00:00:00Z");
    if (isLifetime) {
      try {
        const pzRes = await fetch(`https://api.bunny.net/pullzone/${PULL_ZONE_ID}`, { headers });
        if (pzRes.ok) {
          const pz = await pzRes.json();
          const dc = pz.DateCreated || pz.dateCreated;
          if (dc) {
            const parsed = new Date(dc);
            if (!isNaN(parsed.getTime())) lifetimeFrom = parsed;
          }
        } else {
          await pzRes.text().catch(() => "");
        }
      } catch (e) {
        console.error("pullzone meta fetch failed:", (e as Error).message);
      }
    }

    const from = isLifetime
      ? lifetimeFrom
      : new Date(now.getTime() - days * 24 * 3600 * 1000);
    const dateFrom = from.toISOString().slice(0, 19);
    const dateTo = now.toISOString().slice(0, 19);
    const realDays = Math.max(1, Math.round((now.getTime() - from.getTime()) / 86400000));

    const cacheKey = `${mode}-${days}-${hourly}`;
    if (!bust) {
      const hit = cache.get(cacheKey);
      if (hit && Date.now() - hit.at < TTL_MS) {
        return new Response(JSON.stringify({ ...(hit.data as object), cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const storageStatsUrl = `https://api.bunny.net/storagezone/${STORAGE_ZONE_ID}/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const storageInfoUrl = `https://api.bunny.net/storagezone/${STORAGE_ZONE_ID}`;

    // Bunny /statistics limita range a 40 dias. Quebra em chunks e agrega.
    const MAX_DAYS = 35; // margem segura abaixo dos 40
    const chunks: Array<{ from: string; to: string }> = [];
    {
      let cursor = new Date(from);
      const end = new Date(now);
      while (cursor < end) {
        const next = new Date(Math.min(cursor.getTime() + MAX_DAYS * 24 * 3600 * 1000, end.getTime()));
        chunks.push({ from: cursor.toISOString().slice(0, 19), to: next.toISOString().slice(0, 19) });
        cursor = new Date(next.getTime() + 1000);
      }
      if (chunks.length === 0) chunks.push({ from: dateFrom, to: dateTo });
    }

    let chunkErrors = 0;
    const chunkResults = await Promise.all(chunks.map(async (c) => {
      const u = `https://api.bunny.net/statistics?dateFrom=${c.from}&dateTo=${c.to}&pullZone=${PULL_ZONE_ID}&hourly=${hourly}`;
      try {
        const r = await fetch(u, { headers });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          console.error(`bunny chunk ${c.from}→${c.to} status=${r.status} body=${t.slice(0, 200)}`);
          chunkErrors++;
          return null;
        }
        return await r.json();
      } catch (e) {
        console.error(`bunny chunk ${c.from}→${c.to} threw:`, (e as Error).message);
        chunkErrors++;
        return null;
      }
    }));

    const okChunks = chunkResults.filter(Boolean) as Record<string, unknown>[];
    console.log(`bunny-stats: mode=${mode} chunks=${chunks.length} ok=${okChunks.length} err=${chunkErrors} from=${dateFrom}`);
    if (okChunks.length === 0) {
      return new Response(JSON.stringify({ error: "Bunny /statistics failed for all chunks", chunkErrors }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sumKey = (k: string) => okChunks.reduce((s, c) => s + Number((c as Record<string, number>)[k] || 0), 0);
    const mergeChart = (k: string) => {
      const out: Record<string, number> = {};
      for (const c of okChunks) {
        const ch = (c as Record<string, Record<string, number> | undefined>)[k];
        if (ch) for (const [t, v] of Object.entries(ch)) out[t] = (out[t] || 0) + Number(v || 0);
      }
      return out;
    };
    const avgKey = (k: string) => okChunks.length ? okChunks.reduce((s, c) => s + Number((c as Record<string, number>)[k] || 0), 0) / okChunks.length : 0;

    const stats = {
      TotalBandwidthUsed: sumKey("TotalBandwidthUsed"),
      TotalOriginTraffic: sumKey("TotalOriginTraffic"),
      TotalRequestsServed: sumKey("TotalRequestsServed"),
      CacheHitRate: avgKey("CacheHitRate"),
      AverageOriginResponseTime: avgKey("AverageOriginResponseTime"),
      Total3xxResponses: sumKey("Total3xxResponses"),
      Total4xxResponses: sumKey("Total4xxResponses"),
      Total5xxResponses: sumKey("Total5xxResponses"),
      BandwidthUsedChart: mergeChart("BandwidthUsedChart"),
      BandwidthCachedChart: mergeChart("BandwidthCachedChart"),
      RequestsServedChart: mergeChart("RequestsServedChart"),
      CacheHitRateChart: mergeChart("CacheHitRateChart"),
      OriginTrafficChart: mergeChart("OriginTrafficChart"),
      OriginResponseTimeChart: mergeChart("OriginResponseTimeChart"),
      Error3xxChart: mergeChart("Error3xxChart"),
      Error4xxChart: mergeChart("Error4xxChart"),
      Error5xxChart: mergeChart("Error5xxChart"),
      GeoTrafficDistribution: (okChunks[okChunks.length - 1] as Record<string, unknown>).GeoTrafficDistribution || {},
    };

    const [storageStatsRes, storageInfoRes] = await Promise.all([
      fetch(storageStatsUrl, { headers }),
      fetch(storageInfoUrl, { headers }),
    ]);
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
