// Daily metrics snapshot — chamada pelo pg_cron, busca Supabase + Bunny e grava em metrics_snapshots
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const PROJECT_REF = "xfvpuzlspvvsmmunznxw";
const PULL_ZONE_ID = Deno.env.get("BUNNY_PULL_ZONE_ID");
const STORAGE_ZONE_ID = Deno.env.get("BUNNY_STORAGE_ZONE_ID");
const ACCOUNT_KEY = Deno.env.get("BUNNY_ACCOUNT_API_KEY");
const PAT = Deno.env.get("MANAGEMENT_API_PAT");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ---- auth: cron-secret OR admin user ----
    const cronSecret = req.headers.get("x-cron-secret");
    const expected = Deno.env.get("CRON_SHARED_SECRET");
    let isAuthorized = !!(cronSecret && expected && cronSecret === expected);

    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const token = authHeader.replace("Bearer ", "");
        const { data: u } = await userClient.auth.getUser(token);
        if (u?.user) {
          const { data: r } = await userClient.from("user_roles").select("role")
            .eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
          if (r) isAuthorized = true;
        }
      }
    }
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---------- Supabase: api counts (1day) + storage + auth + db size ----------
    const supabaseSnapshot: Record<string, unknown> = {};
    try {
      // api counts
      if (PAT) {
        const r = await fetch(
          `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.api-counts?interval=1day`,
          { headers: { Authorization: `Bearer ${PAT}` } },
        );
        if (r.ok) {
          const j = await r.json();
          let auth = 0, rest = 0, storage = 0, realtime = 0;
          for (const row of j.result || []) {
            auth += Number(row.total_auth_requests || 0);
            rest += Number(row.total_rest_requests || 0);
            storage += Number(row.total_storage_requests || 0);
            realtime += Number(row.total_realtime_requests || 0);
          }
          supabaseSnapshot.requests = { auth, rest, storage, realtime, total: auth + rest + storage + realtime };
        }
      }

      // storage por bucket
      const buckets = ["event-images", "team-images", "link-thumbnails"];
      const bucketResults = [];
      for (const b of buckets) {
        const { data } = await admin.storage.from(b).list("", { limit: 1000 });
        const files = (data || []).filter((f) => f.id);
        const bytes = files.reduce((s, f: { metadata?: { size?: number } }) => s + (f.metadata?.size || 0), 0);
        bucketResults.push({ bucket: b, bytes, files: files.length });
      }
      supabaseSnapshot.storage = {
        buckets: bucketResults,
        totalBytes: bucketResults.reduce((s, b) => s + b.bytes, 0),
        totalFiles: bucketResults.reduce((s, b) => s + b.files, 0),
      };

      // auth users
      const u = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      supabaseSnapshot.users = u.data?.total ?? 0;
    } catch (e) {
      supabaseSnapshot.error = (e as Error).message;
    }

    // ---------- Bunny: lifetime + storage atual ----------
    const bunnySnapshot: Record<string, unknown> = {};
    try {
      if (ACCOUNT_KEY && PULL_ZONE_ID && STORAGE_ZONE_ID) {
        const headers = { AccessKey: ACCOUNT_KEY, Accept: "application/json" };
        // lifetime stats
        const dateFrom = "2020-01-01T00:00:00";
        const dateTo = new Date().toISOString().slice(0, 19);
        const [statsRes, storageInfoRes] = await Promise.all([
          fetch(`https://api.bunny.net/statistics?dateFrom=${dateFrom}&dateTo=${dateTo}&pullZone=${PULL_ZONE_ID}`, { headers }),
          fetch(`https://api.bunny.net/storagezone/${STORAGE_ZONE_ID}`, { headers }),
        ]);
        if (statsRes.ok) {
          const s = await statsRes.json();
          bunnySnapshot.lifetime = {
            bandwidthBytes: Number(s.TotalBandwidthUsed || 0),
            originBytes: Number(s.TotalOriginTraffic || 0),
            requests: Number(s.TotalRequestsServed || 0),
            cacheHitRate: Number(s.CacheHitRate || 0),
          };
        }
        if (storageInfoRes.ok) {
          const si = await storageInfoRes.json();
          bunnySnapshot.storage = {
            bytesUsed: Number(si.StorageUsed || 0),
            files: Number(si.FilesStored || 0),
          };
        }
      }
    } catch (e) {
      bunnySnapshot.error = (e as Error).message;
    }

    // ---------- upsert ----------
    const day = new Date().toISOString().slice(0, 10);
    const { error: upErr } = await admin.from("metrics_snapshots").upsert({
      day,
      supabase: supabaseSnapshot,
      bunny: bunnySnapshot,
      captured_at: new Date().toISOString(),
    }, { onConflict: "day" });

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message, supabase: supabaseSnapshot, bunny: bunnySnapshot }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, day, supabase: supabaseSnapshot, bunny: bunnySnapshot }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("metrics-snapshot error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
