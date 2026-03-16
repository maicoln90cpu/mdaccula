import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUNNY_STORAGE_ZONE = "mdacula";
const BUNNY_REGION = "br";
const BUNNY_CDN_HOST = "https://mdacula.b-cdn.net";
const BUNNY_STORAGE_HOST = `https://${BUNNY_REGION}.storage.bunnycdn.com`;

const BUCKETS = ["event-images", "link-thumbnails", "team-images"];

const URL_COLUMNS = [
  { table: "events", column: "image_url" },
  { table: "blog_posts", column: "image_url" },
  { table: "custom_links", column: "thumbnail_url" },
  { table: "team_members", column: "image_url" },
  { table: "event_templates", column: "image_url" },
  { table: "recurring_event_configs", column: "image_url" },
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Test if the Bunny Storage API key is valid by listing files */
async function testBunnyCredential(apiKey: string): Promise<{ ok: boolean; hint: string; status?: number }> {
  try {
    const url = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { AccessKey: apiKey, Accept: "application/json" },
    });
    if (resp.ok) return { ok: true, hint: "Storage Zone password válida" };
    if (resp.status === 401) {
      return {
        ok: false,
        status: 401,
        hint: "BUNNY_STORAGE_API_KEY inválida. Certifique-se de usar a PASSWORD da Storage Zone 'mdacula', não a API key geral da conta Bunny.",
      };
    }
    return { ok: false, status: resp.status, hint: `Bunny retornou status ${resp.status}` };
  } catch (e) {
    return { ok: false, hint: `Erro de rede: ${(e as Error).message}` };
  }
}

/** List files on Bunny Storage for a given path */
async function listBunnyFiles(apiKey: string, path: string): Promise<any[]> {
  const url = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${path}/`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { AccessKey: apiKey, Accept: "application/json" },
  });
  if (!resp.ok) return [];
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await supabaseAnon.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const bunnyApiKey = Deno.env.get("BUNNY_STORAGE_API_KEY");
    if (!bunnyApiKey) return json({ error: "BUNNY_STORAGE_API_KEY não configurada" }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "migrate_files";
    const batchSize = body.batch_size || 20;
    const targetBucket = body.bucket;

    // ── ACTION: diagnose ──
    if (action === "diagnose") {
      const credTest = await testBunnyCredential(bunnyApiKey);
      const diag: Record<string, any> = {
        bunny_config: {
          storage_zone: BUNNY_STORAGE_ZONE,
          region: BUNNY_REGION,
          cdn_host: BUNNY_CDN_HOST,
          storage_host: BUNNY_STORAGE_HOST,
          credential_ok: credTest.ok,
          credential_hint: credTest.hint,
          key_length: bunnyApiKey.length,
          key_prefix: bunnyApiKey.substring(0, 4) + "...",
        },
        supabase_buckets: {} as Record<string, number>,
        bunny_buckets: {} as Record<string, number>,
        unmigrated_urls: {} as Record<string, number>,
      };

      for (const bucket of BUCKETS) {
        const { data: files } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        diag.supabase_buckets[bucket] = files?.filter(f => f.id && !f.name.startsWith(".")).length || 0;

        if (credTest.ok) {
          const bunnyFiles = await listBunnyFiles(bunnyApiKey, bucket);
          diag.bunny_buckets[bucket] = bunnyFiles.length;
        }
      }

      for (const { table, column } of URL_COLUMNS) {
        const { count } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .like(column, `%supabase.co%`);
        diag.unmigrated_urls[`${table}.${column}`] = count || 0;
      }

      return json(diag);
    }

    // ── ACTION: status (legacy compat) ──
    if (action === "status") {
      const status: Record<string, any> = { buckets: {}, urls: {} };
      for (const bucket of BUCKETS) {
        const { data: files } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        status.buckets[bucket] = files?.length || 0;
      }
      for (const { table, column } of URL_COLUMNS) {
        const { count } = await supabase
          .from(table).select("id", { count: "exact", head: true })
          .like(column, `%supabase.co%`);
        status.urls[`${table}.${column}`] = count || 0;
      }
      return json({ status });
    }

    // ── ACTION: migrate_files ──
    if (action === "migrate_files") {
      // Pre-check credential
      const credTest = await testBunnyCredential(bunnyApiKey);
      if (!credTest.ok) {
        return json({
          error: "Bunny credential failed",
          credential_hint: credTest.hint,
          credential_status: credTest.status,
        }, 400);
      }

      const bucketsToProcess = targetBucket ? [targetBucket] : BUCKETS;
      const results: Record<string, any> = {};
      let totalMigrated = 0;

      for (const bucket of bucketsToProcess) {
        results[bucket] = { migrated: 0, skipped: 0, errors: [] as string[] };

        const { data: files, error: listError } = await supabase.storage
          .from(bucket).list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });

        if (listError) { results[bucket].errors.push(`List: ${listError.message}`); continue; }
        if (!files?.length) continue;

        const imageFiles = files.filter(f => f.id && !f.name.startsWith("."));
        const batch = imageFiles.slice(body.offset || 0, (body.offset || 0) + batchSize);

        // Get existing Bunny files for this bucket to avoid re-uploading
        const existingBunny = await listBunnyFiles(bunnyApiKey, bucket);
        const existingNames = new Set(existingBunny.map((f: any) => f.ObjectName));

        for (const file of batch) {
          const filePath = file.name;

          if (existingNames.has(filePath)) {
            results[bucket].skipped++;
            continue;
          }

          try {
            const { data: fileData, error: dlError } = await supabase.storage.from(bucket).download(filePath);
            if (dlError || !fileData) {
              results[bucket].errors.push(`DL ${filePath}: ${dlError?.message || "no data"}`);
              continue;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const bunnyUrl = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${bucket}/${filePath}`;

            const uploadResp = await fetch(bunnyUrl, {
              method: "PUT",
              headers: {
                AccessKey: bunnyApiKey,
                "Content-Type": fileData.type || "application/octet-stream",
              },
              body: arrayBuffer,
            });

            if (!uploadResp.ok) {
              const errText = await uploadResp.text();
              results[bucket].errors.push(`UP ${filePath}: ${uploadResp.status} ${errText}`);
              continue;
            }

            results[bucket].migrated++;
            totalMigrated++;
          } catch (err) {
            results[bucket].errors.push(`${filePath}: ${(err as Error).message}`);
          }
        }

        results[bucket].total = imageFiles.length;
        results[bucket].hasMore = (body.offset || 0) + batchSize < imageFiles.length;
      }

      return json({ action: "migrate_files", totalMigrated, results, nextOffset: (body.offset || 0) + batchSize });
    }

    // ── ACTION: update_urls ──
    if (action === "update_urls") {
      const urlResults: Record<string, number> = {};

      for (const { table, column } of URL_COLUMNS) {
        const { data: rows, error: selectError } = await supabase
          .from(table).select(`id, ${column}`)
          .like(column, `%supabase.co/storage/v1/object/public/%`)
          .limit(500);

        if (selectError || !rows) { urlResults[`${table}.${column}`] = -1; continue; }

        let updated = 0;
        for (const row of rows) {
          const oldUrl = (row as any)[column] as string;
          if (!oldUrl) continue;
          const match = oldUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
          if (!match) continue;

          const newUrl = `${BUNNY_CDN_HOST}/${match[1]}`;
          const { error: updateError } = await supabase.from(table).update({ [column]: newUrl }).eq("id", row.id);
          if (!updateError) updated++;
        }
        urlResults[`${table}.${column}`] = updated;
      }

      return json({ action: "update_urls", updated: urlResults });
    }

    return json({ error: "Ação inválida. Use: diagnose, status, migrate_files, update_urls" }, 400);
  } catch (error) {
    console.error("migrate-to-bunny error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
