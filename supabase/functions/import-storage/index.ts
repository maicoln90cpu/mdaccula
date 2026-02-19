import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SOURCE_MANIFEST_URL =
  "https://nzbyyuqvhrwatmydxiag.supabase.co/functions/v1/export-storage-manifest";
const SOURCE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56Ynl5dXF2aHJ3YXRteWR4aWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDg3MTAsImV4cCI6MjA3NzgyNDcxMH0.tBbQNUzdS5qBH0ER_AhxnMdpa805HqZEA3bmzPD3svc";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch manifest from old project
    const manifestRes = await fetch(SOURCE_MANIFEST_URL, {
      headers: {
        apikey: SOURCE_ANON_KEY,
        Authorization: `Bearer ${SOURCE_ANON_KEY}`,
      },
    });

    if (!manifestRes.ok) {
      const text = await manifestRes.text();
      throw new Error(`Failed to fetch manifest: ${manifestRes.status} ${text}`);
    }

    const manifest = await manifestRes.json();
    const buckets: Record<string, { path: string; publicUrl: string }[]> =
      manifest.buckets;

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    const BATCH_LIMIT = 30; // process up to 30 files per call to stay within timeout
    let processed = 0;

    for (const [bucket, files] of Object.entries(buckets)) {
      for (const file of files) {
        if (processed >= BATCH_LIMIT) break;

        try {
          // Check if file already exists
          const { data: existing } = await supabase.storage
            .from(bucket)
            .download(file.path);

          if (existing && existing.size > 0) {
            skipped++;
            processed++;
            continue;
          }
        } catch {
          // File doesn't exist, proceed to download
        }

        try {
          // Download from old project
          const fileRes = await fetch(file.publicUrl);
          if (!fileRes.ok) {
            errors++;
            errorDetails.push(`${bucket}/${file.path}: download ${fileRes.status}`);
            processed++;
            continue;
          }

          const blob = await fileRes.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const contentType =
            fileRes.headers.get("content-type") || "application/octet-stream";

          // Upload to this project
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(file.path, arrayBuffer, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            errors++;
            errorDetails.push(`${bucket}/${file.path}: ${uploadError.message}`);
          } else {
            imported++;
          }
        } catch (err: any) {
          errors++;
          errorDetails.push(`${bucket}/${file.path}: ${err.message}`);
        }

        processed++;
      }
      if (processed >= BATCH_LIMIT) break;
    }

    const totalFiles = Object.values(buckets).reduce(
      (sum, files) => sum + files.length,
      0
    );

    return new Response(
      JSON.stringify({
        success: true,
        totalFiles,
        imported,
        skipped,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        complete: imported + skipped + errors >= totalFiles,
        message:
          imported + skipped + errors >= totalFiles
            ? "Importação completa!"
            : `Processados ${processed} arquivos. Execute novamente para continuar.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
