import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EgressMetric {
  api_path: string;
  source: "sw" | "edge";
  cache_hits: number;
  cache_misses: number;
  egress_bytes: number;
  period_start: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Validate: must be an array with max 100 items
    if (!Array.isArray(body) || body.length === 0 || body.length > 100) {
      return new Response(
        JSON.stringify({ error: "Expected array of 1-100 metrics" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate each metric
    const validMetrics: EgressMetric[] = [];
    for (const item of body) {
      if (
        typeof item.api_path !== "string" ||
        item.api_path.length === 0 ||
        item.api_path.length > 255
      ) continue;
      if (item.source !== "sw" && item.source !== "edge") continue;
      if (typeof item.cache_hits !== "number" || item.cache_hits < 0) continue;
      if (typeof item.cache_misses !== "number" || item.cache_misses < 0) continue;
      if (typeof item.egress_bytes !== "number" || item.egress_bytes < 0) continue;
      if (typeof item.period_start !== "string") continue;

      // Validate period_start is a valid ISO date
      const d = new Date(item.period_start);
      if (isNaN(d.getTime())) continue;

      validMetrics.push({
        api_path: item.api_path.substring(0, 255),
        source: item.source,
        cache_hits: Math.floor(item.cache_hits),
        cache_misses: Math.floor(item.cache_misses),
        egress_bytes: Math.floor(item.egress_bytes),
        period_start: d.toISOString(),
      });
    }

    if (validMetrics.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid metrics in payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert each metric using raw SQL via rpc for atomic increment
    // Since we can't do ON CONFLICT with supabase-js, we use a simple approach:
    // Try to find existing row and update, or insert new
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const metric of validMetrics) {
      // Check if row exists
      const { data: existing } = await supabase
        .from("egress_metrics")
        .select("id, cache_hits, cache_misses, egress_bytes")
        .eq("period_start", metric.period_start)
        .eq("api_path", metric.api_path)
        .eq("source", metric.source)
        .maybeSingle();

      if (existing) {
        // Update: sum values
        const { error } = await supabase
          .from("egress_metrics")
          .update({
            cache_hits: existing.cache_hits + metric.cache_hits,
            cache_misses: existing.cache_misses + metric.cache_misses,
            egress_bytes: existing.egress_bytes + metric.egress_bytes,
          })
          .eq("id", existing.id);

        if (error) {
          console.error("Update error:", error.message);
          errors++;
        } else {
          updated++;
        }
      } else {
        // Insert new row
        const { error } = await supabase.from("egress_metrics").insert({
          period_start: metric.period_start,
          api_path: metric.api_path,
          source: metric.source,
          cache_hits: metric.cache_hits,
          cache_misses: metric.cache_misses,
          egress_bytes: metric.egress_bytes,
        });

        if (error) {
          // Race condition: another request inserted in the meantime, try update
          if (error.code === "23505") {
            const { data: retryRow } = await supabase
              .from("egress_metrics")
              .select("id, cache_hits, cache_misses, egress_bytes")
              .eq("period_start", metric.period_start)
              .eq("api_path", metric.api_path)
              .eq("source", metric.source)
              .maybeSingle();

            if (retryRow) {
              await supabase
                .from("egress_metrics")
                .update({
                  cache_hits: retryRow.cache_hits + metric.cache_hits,
                  cache_misses: retryRow.cache_misses + metric.cache_misses,
                  egress_bytes: retryRow.egress_bytes + metric.egress_bytes,
                })
                .eq("id", retryRow.id);
              updated++;
            } else {
              errors++;
            }
          } else {
            console.error("Insert error:", error.message);
            errors++;
          }
        } else {
          inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: validMetrics.length,
        inserted,
        updated,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("track-egress error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
