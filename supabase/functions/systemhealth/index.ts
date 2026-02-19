import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface SystemHealthResponse {
  timestamp: string;
  overall_status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  metrics: {
    database: {
      tables_count: number;
      total_rows: number;
      recent_errors: number;
    };
    edge_functions: {
      total_functions: number;
      recent_invocations: number;
    };
    storage: {
      buckets_count: number;
      total_files: number;
    };
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("Starting system health check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const checks: HealthCheck[] = [];

    const dbStart = Date.now();
    try {
      const { count, error } = await supabase
        .from("blog_posts")
        .select("*", { count: "exact", head: true });

      if (error) throw error;

      checks.push({
        name: "Database Connection",
        status: "healthy",
        latency: Date.now() - dbStart,
        message: `Connected successfully. Blog posts count: ${count}`,
      });
    } catch (err) {
      checks.push({
        name: "Database Connection",
        status: "unhealthy",
        latency: Date.now() - dbStart,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }

    const criticalTables = ["events", "blog_posts", "custom_links", "profiles"];
    const tableChecks: { table: string; count: number; status: string }[] = [];

    for (const table of criticalTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        tableChecks.push({
          table,
          count: count || 0,
          status: error ? "error" : "ok",
        });
      } catch {
        tableChecks.push({ table, count: 0, status: "error" });
      }
    }

    const tableErrors = tableChecks.filter((t) => t.status === "error");
    checks.push({
      name: "Critical Tables",
      status: tableErrors.length === 0 ? "healthy" : tableErrors.length < 2 ? "degraded" : "unhealthy",
      message: `${tableChecks.length - tableErrors.length}/${tableChecks.length} tables accessible`,
      details: { tables: tableChecks },
    });

    const storageStart = Date.now();
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      if (error) throw error;

      const bucketDetails = await Promise.all(
        (buckets || []).map(async (bucket) => {
          const { data: files } = await supabase.storage.from(bucket.name).list("", { limit: 1000 });
          return { name: bucket.name, files_count: files?.length || 0 };
        })
      );

      checks.push({
        name: "Storage Buckets",
        status: "healthy",
        latency: Date.now() - storageStart,
        message: `${buckets?.length || 0} buckets available`,
        details: { buckets: bucketDetails },
      });
    } catch (err) {
      checks.push({
        name: "Storage Buckets",
        status: "unhealthy",
        latency: Date.now() - storageStart,
        message: err instanceof Error ? err.message : "Storage check failed",
      });
    }

    const authStart = Date.now();
    try {
      const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1 });

      checks.push({
        name: "Authentication Service",
        status: error ? "degraded" : "healthy",
        latency: Date.now() - authStart,
        message: error ? error.message : `Auth service operational. Total users: ${data?.users?.length || 0}+`,
      });
    } catch (err) {
      checks.push({
        name: "Authentication Service",
        status: "unhealthy",
        latency: Date.now() - authStart,
        message: err instanceof Error ? err.message : "Auth check failed",
      });
    }

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: recentEvents } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);

      const { count: recentPosts } = await supabase
        .from("blog_posts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);

      checks.push({
        name: "Recent Activity",
        status: "healthy",
        message: `Last 24h: ${recentEvents || 0} events, ${recentPosts || 0} posts created`,
        details: {
          events_created: recentEvents || 0,
          posts_created: recentPosts || 0,
        },
      });
    } catch {
      checks.push({
        name: "Recent Activity",
        status: "degraded",
        message: "Could not fetch recent activity",
      });
    }

    try {
      const { count: totalSubs } = await supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact", head: true });

      const { count: confirmedSubs } = await supabase
        .from("newsletter_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("confirmed", true);

      checks.push({
        name: "Newsletter System",
        status: "healthy",
        message: `${confirmedSubs || 0} confirmed / ${totalSubs || 0} total subscribers`,
        details: {
          total: totalSubs || 0,
          confirmed: confirmedSubs || 0,
        },
      });
    } catch {
      checks.push({
        name: "Newsletter System",
        status: "degraded",
        message: "Could not fetch newsletter stats",
      });
    }

    const unhealthyCount = checks.filter((c) => c.status === "unhealthy").length;
    const degradedCount = checks.filter((c) => c.status === "degraded").length;

    let overallStatus: "healthy" | "degraded" | "unhealthy";
    if (unhealthyCount > 0) {
      overallStatus = "unhealthy";
    } else if (degradedCount > 0) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    const totalRows = tableChecks.reduce((acc, t) => acc + t.count, 0);

    const response: SystemHealthResponse = {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      checks,
      metrics: {
        database: {
          tables_count: tableChecks.length,
          total_rows: totalRows,
          recent_errors: tableErrors.length,
        },
        edge_functions: {
          total_functions: 12,
          recent_invocations: 0,
        },
        storage: {
          buckets_count: 3,
          total_files: 0,
        },
      },
    };

    console.log(`Health check completed in ${Date.now() - startTime}ms. Status: ${overallStatus}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("System health check failed:", error);

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overall_status: "unhealthy",
        checks: [],
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
