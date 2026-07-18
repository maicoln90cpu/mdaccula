import { createClient } from "npm:@supabase/supabase-js@2";

// ============= INLINE SHARED UTILITIES =============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

// ============= MAIN HANDLER =============
const RETENTION_DAYS = 30;
const FUNCTION_TIMEOUT_MS = 10000;

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Function timeout")), FUNCTION_TIMEOUT_MS);
  });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffDateStr = cutoffDate.toISOString();

    const deleteOperation = supabase
      .from("sync_logs")
      .delete()
      .lt("created_at", cutoffDateStr)
      .select("id");

    const { data: deletedLogs, error } = await Promise.race([
      deleteOperation,
      timeoutPromise,
    ]);

    if (error) {
      console.error("Error deleting old sync logs:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const deletedCount = deletedLogs?.length || 0;
    console.log(`Cleanup completed: ${deletedCount} sync logs older than ${RETENTION_DAYS} days deleted`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: deletedCount,
        retention_days: RETENTION_DAYS,
        cutoff_date: cutoffDateStr 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Cleanup sync logs error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
