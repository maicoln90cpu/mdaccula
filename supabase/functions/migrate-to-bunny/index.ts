import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUNNY_STORAGE_ZONE = "mdacula";
const BUNNY_REGION = "br";
const BUNNY_CDN_HOST = "https://mdacula.b-cdn.net";
const SUPABASE_STORAGE_BASE = "https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public";

const BUCKETS = ["event-images", "link-thumbnails", "team-images"];

// Tables and columns that contain image URLs
const URL_COLUMNS = [
  { table: "events", column: "image_url" },
  { table: "blog_posts", column: "image_url" },
  { table: "custom_links", column: "thumbnail_url" },
  { table: "team_members", column: "image_url" },
  { table: "event_templates", column: "image_url" },
  { table: "recurring_event_configs", column: "image_url" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check - admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { data: isAdmin } = await supabaseAnon.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bunnyApiKey = Deno.env.get("BUNNY_STORAGE_API_KEY");
    if (!bunnyApiKey) {
      return new Response(JSON.stringify({ error: "BUNNY_STORAGE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for storage listing
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "migrate_files"; // "migrate_files" | "update_urls" | "status"
    const batchSize = body.batch_size || 20;
    const targetBucket = body.bucket; // optional: limit to specific bucket

    if (action === "status") {
      // Return counts of files per bucket and unmigrated URLs
      const status: Record<string, any> = { buckets: {}, urls: {} };

      for (const bucket of BUCKETS) {
        const { data: files } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        status.buckets[bucket] = files?.length || 0;
      }

      for (const { table, column } of URL_COLUMNS) {
        const { count } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .like(column, `%supabase.co%`);
        status.urls[`${table}.${column}`] = count || 0;
      }

      return new Response(JSON.stringify({ status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "migrate_files") {
      const bucketsToProcess = targetBucket ? [targetBucket] : BUCKETS;
      const results: Record<string, { migrated: number; skipped: number; errors: string[] }> = {};
      let totalMigrated = 0;

      for (const bucket of bucketsToProcess) {
        results[bucket] = { migrated: 0, skipped: 0, errors: [] };

        // List files in bucket (supports subfolder structure)
        const { data: files, error: listError } = await supabase.storage
          .from(bucket)
          .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });

        if (listError) {
          results[bucket].errors.push(`List error: ${listError.message}`);
          continue;
        }

        if (!files || files.length === 0) continue;

        // Filter to actual files (not folders), take batch
        const imageFiles = files.filter(f => f.id && !f.id.endsWith("/"));
        const batch = imageFiles.slice(body.offset || 0, (body.offset || 0) + batchSize);

        for (const file of batch) {
          const filePath = file.name;
          const bunnyPath = `${bucket}/${filePath}`;
          const bunnyUploadUrl = `https://${BUNNY_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${bunnyPath}`;

          try {
            // Check if file already exists on Bunny (HEAD request)
            const headResp = await fetch(`${BUNNY_CDN_HOST}/${bunnyPath}`, { method: "HEAD" });
            if (headResp.ok) {
              results[bucket].skipped++;
              continue;
            }

            // Download from Supabase
            const { data: fileData, error: dlError } = await supabase.storage
              .from(bucket)
              .download(filePath);

            if (dlError || !fileData) {
              results[bucket].errors.push(`Download ${filePath}: ${dlError?.message || "no data"}`);
              continue;
            }

            const arrayBuffer = await fileData.arrayBuffer();

            // Upload to Bunny
            const uploadResp = await fetch(bunnyUploadUrl, {
              method: "PUT",
              headers: {
                AccessKey: bunnyApiKey,
                "Content-Type": fileData.type || "application/octet-stream",
              },
              body: arrayBuffer,
            });

            if (!uploadResp.ok) {
              const errText = await uploadResp.text();
              results[bucket].errors.push(`Upload ${filePath}: ${uploadResp.status} ${errText}`);
              continue;
            }

            results[bucket].migrated++;
            totalMigrated++;
          } catch (err) {
            results[bucket].errors.push(`${filePath}: ${(err as Error).message}`);
          }
        }

        // Check if there are more files
        (results[bucket] as any).total = imageFiles.length;
        (results[bucket] as any).hasMore = (body.offset || 0) + batchSize < imageFiles.length;
      }

      return new Response(
        JSON.stringify({
          action: "migrate_files",
          totalMigrated,
          results,
          nextOffset: (body.offset || 0) + batchSize,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_urls") {
      // Replace Supabase Storage URLs with Bunny CDN URLs in all tables
      const urlResults: Record<string, number> = {};

      for (const { table, column } of URL_COLUMNS) {
        // Find rows with Supabase storage URLs
        const { data: rows, error: selectError } = await supabase
          .from(table)
          .select(`id, ${column}`)
          .like(column, `%supabase.co/storage/v1/object/public/%`)
          .limit(500);

        if (selectError || !rows) {
          urlResults[`${table}.${column}`] = -1;
          continue;
        }

        let updated = 0;
        for (const row of rows) {
          const oldUrl = (row as any)[column] as string;
          if (!oldUrl) continue;

          // Extract path after /storage/v1/object/public/
          const match = oldUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
          if (!match) continue;

          const newUrl = `${BUNNY_CDN_HOST}/${match[1]}`;

          const { error: updateError } = await supabase
            .from(table)
            .update({ [column]: newUrl })
            .eq("id", row.id);

          if (!updateError) updated++;
        }

        urlResults[`${table}.${column}`] = updated;
      }

      return new Response(
        JSON.stringify({ action: "update_urls", updated: urlResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: status, migrate_files, update_urls" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("migrate-to-bunny error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
