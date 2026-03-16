import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Bunny Config ──
const BUNNY_STORAGE_ZONE = "mdaccula";
const BUNNY_CDN_HOST = "https://mdaccula.b-cdn.net";

function getBunnyStorageHost(): string {
  const hostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME");
  return hostname ? `https://${hostname}` : "https://storage.bunnycdn.com";
}

const BUNNY_REGION_HOSTS = [
  { host: "storage.bunnycdn.com", region: "Falkenstein (EU — default)" },
  { host: "br.storage.bunnycdn.com", region: "São Paulo (BR)" },
  { host: "ny.storage.bunnycdn.com", region: "New York (US)" },
  { host: "la.storage.bunnycdn.com", region: "Los Angeles (US)" },
  { host: "uk.storage.bunnycdn.com", region: "London (UK)" },
  { host: "sg.storage.bunnycdn.com", region: "Singapore (SG)" },
  { host: "se.storage.bunnycdn.com", region: "Stockholm (SE)" },
  { host: "jh.storage.bunnycdn.com", region: "Johannesburg (ZA)" },
  { host: "syd.storage.bunnycdn.com", region: "Sydney (AU)" },
];

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

function bunnyStorageUrl(path: string): string {
  return `${getBunnyStorageHost()}/${BUNNY_STORAGE_ZONE}/${path}`;
}

function bunnyCdnUrl(path: string): string {
  return `${BUNNY_CDN_HOST}/${path}`;
}

/** Auto-detect correct Bunny region by trying all endpoints */
async function detectBunnyRegion(apiKey: string): Promise<{
  detected: boolean;
  host?: string;
  region?: string;
  results: Array<{ host: string; region: string; status: number | string }>;
}> {
  const results: Array<{ host: string; region: string; status: number | string }> = [];

  console.log(`[detectBunnyRegion] API key length after trim: ${apiKey.length}`);
  
  for (const entry of BUNNY_REGION_HOSTS) {
    try {
      const url = `https://${entry.host}/${BUNNY_STORAGE_ZONE}/`;
      console.log(`[detectBunnyRegion] Testing: ${url}`);
      const resp = await fetch(url, {
        method: "GET",
        headers: { AccessKey: apiKey },
      });
      
      const bodyPreview = await resp.text().then(t => t.substring(0, 200));
      console.log(`[detectBunnyRegion] ${entry.host} → ${resp.status} body: ${bodyPreview}`);
      results.push({ host: entry.host, region: entry.region, status: resp.status });

      if (resp.status >= 200 && resp.status < 300) {
        return { detected: true, host: entry.host, region: entry.region, results };
      }
    } catch (e) {
      console.log(`[detectBunnyRegion] ${entry.host} → error: ${(e as Error).message}`);
      results.push({ host: entry.host, region: entry.region, status: (e as Error).message });
    }
  }

  return { detected: false, results };
}

/** List files on Bunny Storage for a given path */
async function listBunnyFiles(apiKey: string, path: string): Promise<any[]> {
  const url = bunnyStorageUrl(path + "/");
  const resp = await fetch(url, {
    method: "GET",
    headers: { AccessKey: apiKey },
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

    const rawBunnyKey = Deno.env.get("BUNNY_STORAGE_API_KEY");
    const bunnyApiKey = rawBunnyKey?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
    if (!bunnyApiKey) return json({ error: "BUNNY_STORAGE_API_KEY não configurada" }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "migrate_files";
    const batchSize = body.batch_size || 20;
    const targetBucket = body.bucket;

    // ── ACTION: diagnose ──
    if (action === "diagnose") {
      const storageHost = getBunnyStorageHost();
      const hasHostnameSecret = !!Deno.env.get("BUNNY_STORAGE_HOSTNAME");

      // Key diagnostics (without exposing the value)
      const keyDiagnostics = {
        hasValue: !!rawBunnyKey,
        rawLength: rawBunnyKey?.length ?? 0,
        lengthAfterTrim: rawBunnyKey?.trim()?.length ?? 0,
        lengthAfterSanitize: bunnyApiKey.length,
        startsWithQuote: rawBunnyKey?.trim()?.startsWith('"') || rawBunnyKey?.trim()?.startsWith("'") || false,
        endsWithQuote: rawBunnyKey?.trim()?.endsWith('"') || rawBunnyKey?.trim()?.endsWith("'") || false,
        containsNonPrintable: /[^\x20-\x7E]/.test(rawBunnyKey?.trim() ?? ''),
        firstCharCode: rawBunnyKey?.trim() ? rawBunnyKey.trim().charCodeAt(0) : null,
        lastCharCode: rawBunnyKey?.trim() ? rawBunnyKey.trim().charCodeAt(rawBunnyKey.trim().length - 1) : null,
      };
      console.log("[diagnose] Key diagnostics:", JSON.stringify(keyDiagnostics));

      // Test current configured endpoint
      let currentOk = false;
      let currentHint = "";
      try {
        const resp = await fetch(`${storageHost}/${BUNNY_STORAGE_ZONE}/`, {
          method: "GET",
          headers: { AccessKey: bunnyApiKey },
        });
        currentOk = resp.ok;
        currentHint = resp.ok ? "Autenticação OK" : `Status ${resp.status}`;
      } catch (e) {
        currentHint = `Erro de rede: ${(e as Error).message}`;
      }

      // Auto-detect region
      const regionDetection = await detectBunnyRegion(bunnyApiKey);

      const diag: Record<string, any> = {
        bunny_config: {
          storage_zone: BUNNY_STORAGE_ZONE,
          cdn_host: BUNNY_CDN_HOST,
          storage_host: storageHost,
          hostname_secret_configured: hasHostnameSecret,
          auth_ok: currentOk,
          hint: currentOk
            ? "Credencial e endpoint OK"
            : regionDetection.detected
              ? `Endpoint atual (${storageHost}) falhou, mas a região correta foi detectada: ${regionDetection.region} (${regionDetection.host}). Configure o secret BUNNY_STORAGE_HOSTNAME com o valor: ${regionDetection.host}`
              : "Nenhuma região respondeu com sucesso. Verifique a password da Storage Zone no painel Bunny.",
        },
        region_detection: {
          detected: regionDetection.detected,
          correct_host: regionDetection.host || null,
          correct_region: regionDetection.region || null,
          action_needed: !currentOk && regionDetection.detected
            ? `Adicione o secret BUNNY_STORAGE_HOSTNAME = ${regionDetection.host}`
            : currentOk ? "Nenhuma" : "Verifique credenciais no painel Bunny",
          all_results: regionDetection.results,
        },
        supabase_buckets: {} as Record<string, number>,
        bunny_buckets: {} as Record<string, number>,
        unmigrated_urls: {} as Record<string, number>,
      };

      const effectiveOk = currentOk || regionDetection.detected;

      diag.supabase_bucket_sizes = {} as Record<string, { count: number; sizeMB: string }>;

      for (const bucket of BUCKETS) {
        const { data: files } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        const imageFiles = files?.filter(f => f.id && !f.name.startsWith(".")) || [];
        diag.supabase_buckets[bucket] = imageFiles.length;

        // Calculate total size
        const totalBytes = imageFiles.reduce((sum, f) => sum + ((f.metadata as any)?.size || 0), 0);
        diag.supabase_bucket_sizes[bucket] = {
          count: imageFiles.length,
          sizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
        };

        if (currentOk) {
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

      // Override auth_ok if region was detected (means credentials are valid, just wrong host)
      if (!currentOk && regionDetection.detected) {
        diag.bunny_config.auth_ok = false;
        diag.bunny_config.credentials_valid = true;
      }

      diag.key_diagnostics = keyDiagnostics;
      diag.curl_test = `curl -s -o /dev/null -w "%{http_code}" -H "AccessKey: SUA_STORAGE_ZONE_PASSWORD" https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/`;

      return json(diag);
    }

    // ── ACTION: status ──
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
      // Quick auth check
      try {
        const resp = await fetch(bunnyStorageUrl(""), {
          method: "GET",
          headers: { AccessKey: bunnyApiKey, Accept: "application/json" },
        });
        if (!resp.ok) {
          return json({
            error: "Falha na autenticação Bunny",
            hint: `Endpoint ${getBunnyStorageHost()} retornou ${resp.status}. Execute o Diagnóstico Completo para detectar a região correta.`,
          }, 400);
        }
      } catch (e) {
        return json({ error: `Erro de rede: ${(e as Error).message}` }, 400);
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
            const uploadUrl = bunnyStorageUrl(`${bucket}/${filePath}`);

            const uploadResp = await fetch(uploadUrl, {
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

          const newUrl = bunnyCdnUrl(match[1]);
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
