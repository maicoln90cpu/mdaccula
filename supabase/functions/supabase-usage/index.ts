// Supabase Usage — combina Management API (api-counts) + queries diretas (DB/Storage)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROJECT_REF = "xfvpuzlspvvsmmunznxw";

// in-memory cache (60s)
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await userClient
      .from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pat = Deno.env.get("MANAGEMENT_API_PAT");
    if (!pat) {
      return new Response(JSON.stringify({ error: "MANAGEMENT_API_PAT not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bodyParams: Record<string, unknown> = {};
    if (req.method === "POST") { try { bodyParams = await req.json(); } catch { /* noop */ } }
    const url = new URL(req.url);
    const validIntervals = ["15min", "30min", "1hr", "3hr", "1day", "3day", "7day"];
    const rawInterval = String(bodyParams.interval || url.searchParams.get("interval") || "1day");
    const interval = validIntervals.includes(rawInterval) ? rawInterval : "1day";

    const cacheKey = interval;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return new Response(JSON.stringify({ ...(hit.data as object), cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // service-role client for direct DB / storage queries
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- 1. Management API: api counts series ----
    const apiUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.api-counts?interval=${interval}`;
    const apiCountsP = fetch(apiUrl, {
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
    }).then(async (r) => r.ok ? await r.json() : { result: [], error: await r.text(), status: r.status });

    // ---- 2. Health (services) ----
    const healthP = fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/health?services=db,auth,realtime,rest,storage`,
      { headers: { Authorization: `Bearer ${pat}` } },
    ).then((r) => r.ok ? r.json() : []);

    // ---- 3. Database size (via RPC pg_database_size) ----
    const dbSizeP = admin.rpc("get_db_size").then(
      (r) => ({ bytes: Number(r.data || 0), error: r.error?.message }),
    ).catch((e) => ({ bytes: 0, error: (e as Error).message }));

    // ---- 3b. Edge function invocations (Management API + fallback Logs Explorer) ----
    const edgeInvocationsP = fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.func-invocations?interval=${interval}`,
      { headers: { Authorization: `Bearer ${pat}` } },
    ).then(async (r) => r.ok ? await r.json() : null).catch(() => null);

    // Fallback: contar via Logs Explorer (function_edge_logs) últimos 7 dias
    const edgeLogsCountP = fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: `select count(*) as total from function_edge_logs where timestamp >= timestamp_sub(current_timestamp(), interval 7 day)`,
        }),
      },
    ).then(async (r) => r.ok ? await r.json() : null).catch(() => null);

    // ---- 4. Auth users count ----
    const authUsersP = admin.auth.admin.listUsers({ page: 1, perPage: 1 }).then(
      (r) => ({ total: r.data?.total ?? 0, error: r.error?.message }),
    ).catch((e) => ({ total: 0, error: e.message }));

    // ---- 5. Storage usage per bucket (direct query on storage.objects) ----
    const storageP = (async () => {
      try {
        const buckets = ["event-images", "team-images", "link-thumbnails"];
        const results: Array<{ bucket: string; bytes: number; files: number }> = [];
        for (const b of buckets) {
          const { data, error } = await admin.storage.from(b).list("", { limit: 1000 });
          if (error || !data) {
            results.push({ bucket: b, bytes: 0, files: 0 });
            continue;
          }
          const files = data.filter((f) => f.id);
          const bytes = files.reduce((s, f: { metadata?: { size?: number } }) => s + (f.metadata?.size || 0), 0);
          results.push({ bucket: b, bytes, files: files.length });
        }
        return results;
      } catch (e) {
        return [{ bucket: "error", bytes: 0, files: 0, error: (e as Error).message }];
      }
    })();

    // ---- 6. Counts of key tables ----
    const tableCountsP = (async () => {
      const tables = ["events", "blog_posts", "custom_links", "newsletter_subscribers", "application_logs", "egress_metrics"];
      const result: Record<string, number> = {};
      await Promise.all(tables.map(async (t) => {
        const { count } = await admin.from(t).select("*", { count: "exact", head: true });
        result[t] = count ?? 0;
      }));
      return result;
    })();

    const [apiCounts, health, dbSize, edgeInvocations, edgeLogsCount, authUsers, storage, tableCounts] = await Promise.all([
      apiCountsP, healthP, dbSizeP, edgeInvocationsP, edgeLogsCountP, authUsersP, storageP, tableCountsP,
    ]);

    let totalEdgeInvocations = 0;
    let edgeSource: "management-api" | "logs-explorer" | "none" = "none";
    const edgeRows = (edgeInvocations?.result || edgeInvocations?.data || []) as Array<Record<string, unknown>>;
    if (Array.isArray(edgeRows) && edgeRows.length) {
      for (const row of edgeRows) {
        totalEdgeInvocations += Number(
          row.count ?? row.total ?? row.total_invocations ?? row.invocations ?? row.value ?? 0,
        );
      }
      if (totalEdgeInvocations > 0) edgeSource = "management-api";
    }
    if (totalEdgeInvocations === 0) {
      const logsRows = (edgeLogsCount?.result || edgeLogsCount?.data || []) as Array<Record<string, unknown>>;
      if (Array.isArray(logsRows) && logsRows.length) {
        totalEdgeInvocations = Number(logsRows[0]?.total ?? logsRows[0]?.count ?? 0);
        if (totalEdgeInvocations > 0) edgeSource = "logs-explorer";
      }
    }
    const dbSizeBytes = Number((dbSize as { bytes?: number })?.bytes || 0);

    // Aggregate api-counts series → totals per service
    const series: Array<{ timestamp: string; auth: number; rest: number; storage: number; realtime: number }> = [];
    let totals = { auth: 0, rest: 0, storage: 0, realtime: 0 };
    if (apiCounts?.result && Array.isArray(apiCounts.result)) {
      for (const row of apiCounts.result) {
        const auth = Number(row.total_auth_requests || 0);
        const rest = Number(row.total_rest_requests || 0);
        const stor = Number(row.total_storage_requests || 0);
        const rt = Number(row.total_realtime_requests || 0);
        totals.auth += auth; totals.rest += rest; totals.storage += stor; totals.realtime += rt;
        series.push({ timestamp: row.timestamp, auth, rest, storage: stor, realtime: rt });
      }
    }

    const totalStorageBytes = Array.isArray(storage)
      ? storage.reduce((s, b) => s + b.bytes, 0)
      : 0;
    const totalStorageFiles = Array.isArray(storage)
      ? storage.reduce((s, b) => s + b.files, 0)
      : 0;

    const payload = {
      window: { interval },
      apiCounts: { totals, series, totalRequests: totals.auth + totals.rest + totals.storage + totals.realtime },
      health,
      auth: { totalUsers: authUsers.total, error: authUsers.error },
      storage: {
        buckets: storage,
        totalBytes: totalStorageBytes,
        totalFiles: totalStorageFiles,
      },
      tables: tableCounts,
      db: { sizeBytes: dbSizeBytes },
      edgeFunctions: { totalInvocations: totalEdgeInvocations, source: edgeSource, windowDays: edgeSource === "logs-explorer" ? 7 : null },
      fetchedAt: new Date().toISOString(),
      // legacy compat: também devolve o array bruto que o front antigo esperava
      result: apiCounts?.result ?? [],
    };

    cache.set(cacheKey, { at: Date.now(), data: payload });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("supabase-usage error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
