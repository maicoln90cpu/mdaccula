import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SOURCE_MANIFEST_URL =
  "https://nzbyyuqvhrwatmydxiag.supabase.co/functions/v1/export-storage-manifest";
const SOURCE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56Ynl5dXF2aHJ3YXRteWR4aWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDg3MTAsImV4cCI6MjA3NzgyNDcxMH0.tBbQNUzdS5qBH0ER_AhxnMdpa805HqZEA3bmzPD3svc";

async function listAllFiles(supabase: any, bucket: string): Promise<Set<string>> {
  const paths = new Set<string>();
  
  async function listRecursive(prefix: string) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data) return;
    
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) {
        // It's a file
        paths.add(fullPath);
      } else {
        // It's a folder
        await listRecursive(fullPath);
      }
    }
  }
  
  await listRecursive("");
  return paths;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse optional offset from body
    let offset = 0;
    try {
      const body = await req.json();
      offset = body?.offset || 0;
    } catch { /* no body, start from 0 */ }

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
    const buckets: Record<string, { path: string; publicUrl: string }[]> = manifest.buckets;

    // 2. Build flat list of all files with bucket info
    const allFiles: { bucket: string; path: string; publicUrl: string }[] = [];
    for (const [bucket, files] of Object.entries(buckets)) {
      for (const file of files) {
        allFiles.push({ bucket, path: file.path, publicUrl: file.publicUrl });
      }
    }

    // 3. Get existing files for each bucket to know what to skip
    const existingByBucket: Record<string, Set<string>> = {};
    for (const bucket of Object.keys(buckets)) {
      existingByBucket[bucket] = await listAllFiles(supabase, bucket);
    }

    // 4. Filter to only files that don't exist yet
    const pendingFiles = allFiles.filter(
      (f) => !existingByBucket[f.bucket]?.has(f.path)
    );

    // 5. Process a batch of pending files
    const BATCH_LIMIT = 30;
    const batch = pendingFiles.slice(0, BATCH_LIMIT);

    let imported = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const file of batch) {
      try {
        const fileRes = await fetch(file.publicUrl);
        if (!fileRes.ok) {
          errors++;
          errorDetails.push(`${file.bucket}/${file.path}: download ${fileRes.status}`);
          continue;
        }

        const arrayBuffer = await fileRes.arrayBuffer();
        const contentType = fileRes.headers.get("content-type") || "application/octet-stream";

        const { error: uploadError } = await supabase.storage
          .from(file.bucket)
          .upload(file.path, arrayBuffer, { contentType, upsert: true });

        if (uploadError) {
          errors++;
          errorDetails.push(`${file.bucket}/${file.path}: ${uploadError.message}`);
        } else {
          imported++;
        }
      } catch (err: any) {
        errors++;
        errorDetails.push(`${file.bucket}/${file.path}: ${err.message}`);
      }
    }

    const totalExisting = allFiles.length - pendingFiles.length;

    return new Response(
      JSON.stringify({
        success: true,
        totalFiles: allFiles.length,
        imported,
        skipped: totalExisting,
        errors,
        pending: pendingFiles.length - batch.length,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        complete: pendingFiles.length - imported - errors <= 0,
        message:
          pendingFiles.length <= batch.length
            ? "Importação completa!"
            : `Importados ${imported} arquivos. Restam ${pendingFiles.length - imported} pendentes. Execute novamente.`,
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
