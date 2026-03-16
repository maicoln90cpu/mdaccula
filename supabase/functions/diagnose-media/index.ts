import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUNNY_CDN_HOST = "https://mdaccula.b-cdn.net";

// Tables with image URLs to scan
const IMAGE_TABLES = [
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

/** Detect format from first bytes */
function detectFormat(bytes: Uint8Array): { ext: string; mime: string } {
  if (bytes.length < 12) return { ext: "unknown", mime: "unknown" };
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { ext: "png", mime: "image/png" };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { ext: "webp", mime: "image/webp" };
  }
  // GIF: 47 49 46
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { ext: "gif", mime: "image/gif" };
  }
  return { ext: "unknown", mime: "unknown" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const maxCheck = Math.min(body.maxCheck || 20, 50);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Collect all Bunny CDN URLs from DB
    const allUrls: { table: string; id: string; url: string }[] = [];

    for (const { table, column } of IMAGE_TABLES) {
      const { data: rows } = await supabase
        .from(table)
        .select(`id, ${column}`)
        .like(column, `%b-cdn.net%`)
        .limit(200);

      if (rows) {
        for (const row of rows) {
          const url = (row as any)[column] as string;
          if (url) allUrls.push({ table, id: row.id, url });
        }
      }
    }

    // Also check site_settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("id, key, value")
      .like("value", `%b-cdn.net%`);

    if (settings) {
      for (const s of settings) {
        if (s.value) allUrls.push({ table: "site_settings", id: s.id, url: s.value });
      }
    }

    console.log(`Found ${allUrls.length} Bunny CDN URLs in DB, checking up to ${maxCheck}`);

    // Check a sample of URLs by fetching first bytes
    const results: {
      url: string;
      table: string;
      id: string;
      status: number | string;
      extensionInUrl: string;
      actualFormat: string;
      mismatch: boolean;
    }[] = [];

    const urlsToCheck = allUrls.slice(0, maxCheck);

    for (const entry of urlsToCheck) {
      try {
        const resp = await fetch(entry.url, { method: "GET", headers: { Range: "bytes=0-31" } });
        const status = resp.status;
        
        // Extract extension from URL
        const urlPath = new URL(entry.url).pathname;
        const extMatch = urlPath.match(/\.(\w+)$/);
        const extensionInUrl = extMatch ? extMatch[1].toLowerCase() : "none";

        if (status === 200 || status === 206) {
          const arrayBuf = await resp.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          const detected = detectFormat(bytes);
          
          const mismatch = extensionInUrl !== "none" && detected.ext !== "unknown" && extensionInUrl !== detected.ext;
          
          results.push({
            url: entry.url,
            table: entry.table,
            id: entry.id,
            status,
            extensionInUrl,
            actualFormat: detected.ext,
            mismatch,
          });
        } else {
          results.push({
            url: entry.url,
            table: entry.table,
            id: entry.id,
            status,
            extensionInUrl,
            actualFormat: "fetch_failed",
            mismatch: false,
          });
        }
      } catch (err) {
        results.push({
          url: entry.url,
          table: entry.table,
          id: entry.id,
          status: (err as Error).message,
          extensionInUrl: "unknown",
          actualFormat: "error",
          mismatch: false,
        });
      }
    }

    const mismatches = results.filter(r => r.mismatch);
    const fetchErrors = results.filter(r => typeof r.status !== "number" || (r.status !== 200 && r.status !== 206));

    return json({
      totalUrlsInDb: allUrls.length,
      checked: results.length,
      mismatches: mismatches.length,
      fetchErrors: fetchErrors.length,
      summary: mismatches.length === 0 && fetchErrors.length === 0
        ? "✅ Todas as imagens verificadas estão consistentes"
        : `⚠️ ${mismatches.length} arquivos com extensão/formato incompatível, ${fetchErrors.length} erros de fetch`,
      mismatchDetails: mismatches,
      errorDetails: fetchErrors,
    });
  } catch (error) {
    console.error("diagnose-media error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
