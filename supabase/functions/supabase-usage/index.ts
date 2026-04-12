import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROJECT_REF = "xfvpuzlspvvsmmunznxw";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pat = Deno.env.get("MANAGEMENT_API_PAT");
    if (!pat) {
      return new Response(
        JSON.stringify({ error: "MANAGEMENT_API_PAT not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse query params — valid intervals: 15min, 30min, 1hr, 3hr, 1day, 3day, 7day
    const url = new URL(req.url);
    const validIntervals = ["15min", "30min", "1hr", "3hr", "1day", "3day", "7day"];
    const rawInterval = url.searchParams.get("interval") || "1day";
    const interval = validIntervals.includes(rawInterval) ? rawInterval : "1day";

    // Fetch usage from Supabase Management API
    const apiUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.api-counts?interval=${interval}`;

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Supabase API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch usage data",
          status: response.status,
          detail: errorText,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("supabase-usage error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
