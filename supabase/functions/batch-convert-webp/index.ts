import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Use lightweight WASM-based encoding instead of ImageScript to avoid memory limits

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Bunny Config ──
const BUNNY_STORAGE_ZONE = "mdaccula";
const BUNNY_CDN_HOST = "https://mdaccula.b-cdn.net";
const ALL_BUCKETS = ["event-images", "link-thumbnails", "team-images"];

function getBunnyStorageHost(): string {
  const hostname = Deno.env.get("BUNNY_STORAGE_HOSTNAME");
  return hostname ? `https://${hostname}` : "https://storage.bunnycdn.com";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PRESETS: Record<string, { quality: number; maxDim: number; label: string }> = {
  sutil:  { quality: 85, maxDim: 1920, label: "Sutil (alta qualidade)" },
  media:  { quality: 70, maxDim: 1280, label: "Média (equilíbrio)" },
  severa: { quality: 50, maxDim: 1024, label: "Severa (máxima compressão)" },
};

interface FileInfo {
  name: string;
  size: number;
}

async function listBucketImages(supabase: any, bucket: string): Promise<FileInfo[]> {
  const { data: files, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
  if (error || !files) return [];
  return files
    .filter((f: any) => f.id && !f.name.startsWith("."))
    .filter((f: any) => /\.(png|jpg|jpeg|webp)$/i.test(f.name))
    .map((f: any) => ({ name: f.name, size: (f.metadata as any)?.size || 0 }));
}

// ── URL update helpers ──
const URL_COLUMNS = [
  { table: "events", column: "image_url" },
  { table: "blog_posts", column: "image_url" },
  { table: "custom_links", column: "thumbnail_url" },
  { table: "team_members", column: "image_url" },
  { table: "event_templates", column: "image_url" },
  { table: "recurring_event_configs", column: "image_url" },
];

async function updateDbUrls(supabase: any, bucket: string, oldName: string, newCdnUrl: string) {
  // Find rows that reference the old file name and update them
  for (const { table, column } of URL_COLUMNS) {
    const { data: rows } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .or(`${column}.like.%${bucket}/${oldName}%,${column}.like.%${bucket}/${oldName.replace(/\.(png|jpg|jpeg)$/i, '')}%`)
      .limit(50);

    if (!rows?.length) continue;
    for (const row of rows) {
      const url = (row as any)[column] as string;
      if (!url) continue;
      // Only update if URL contains the old filename (Supabase or Bunny CDN path)
      if (url.includes(`${bucket}/${oldName}`)) {
        await supabase.from(table).update({ [column]: newCdnUrl }).eq("id", row.id);
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "convert";
    const bucketParam = body.bucket || "all";
    const preset = body.preset || "media";
    const maxFiles = body.maxFiles || 10;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const bucketsToProcess = bucketParam === "all" ? ALL_BUCKETS : [bucketParam];

    // ── ACTION: check ──
    if (action === "check") {
      const aggregated = {
        totalFiles: 0,
        totalImages: 0,
        bunnyImages: 0,
        breakdown: { small: { count: 0, label: "< 500 KB" }, medium: { count: 0, label: "500 KB – 2 MB" }, large: { count: 0, label: "> 2 MB" } },
        totalMB: "0",
        avgMB: "0",
        bucketDetails: {} as Record<string, any>,
      };

      const bunnyKey = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
      let totalBytes = 0;

      for (const bucket of bucketsToProcess) {
        const { data: allFiles } = await supabase.storage.from(bucket).list("", { limit: 1000 });
        const validFiles = (allFiles || []).filter((f: any) => f.id && !f.name.startsWith("."));
        const imageFiles = validFiles.filter((f: any) => /\.(png|jpg|jpeg|webp)$/i.test(f.name))
          .map((f: any) => ({ name: f.name, size: (f.metadata as any)?.size || 0 }));

        aggregated.totalFiles += validFiles.length;
        aggregated.totalImages += imageFiles.length;

        const bucketBytes = imageFiles.reduce((sum: number, f: any) => sum + f.size, 0);
        totalBytes += bucketBytes;

        const small = imageFiles.filter((f: any) => f.size < 500 * 1024);
        const medium = imageFiles.filter((f: any) => f.size >= 500 * 1024 && f.size <= 2 * 1024 * 1024);
        const large = imageFiles.filter((f: any) => f.size > 2 * 1024 * 1024);
        aggregated.breakdown.small.count += small.length;
        aggregated.breakdown.medium.count += medium.length;
        aggregated.breakdown.large.count += large.length;

        let bunnyCount = -1;
        if (bunnyKey) {
          try {
            const resp = await fetch(`${getBunnyStorageHost()}/${BUNNY_STORAGE_ZONE}/${bucket}/`, {
              headers: { AccessKey: bunnyKey, Accept: "application/json" },
            });
            if (resp.ok) {
              const bunnyFiles = await resp.json();
              bunnyCount = bunnyFiles.length;
            }
          } catch { /* ignore */ }
        }
        if (bunnyCount >= 0) aggregated.bunnyImages += bunnyCount;

        aggregated.bucketDetails[bucket] = {
          images: imageFiles.length,
          sizeMB: (bucketBytes / 1024 / 1024).toFixed(2),
          bunnyCount: bunnyCount >= 0 ? bunnyCount : "N/A",
          breakdown: { small: small.length, medium: medium.length, large: large.length },
        };
      }

      aggregated.totalMB = (totalBytes / 1024 / 1024).toFixed(2);
      aggregated.avgMB = aggregated.totalImages > 0 ? (totalBytes / aggregated.totalImages / 1024 / 1024).toFixed(2) : "0";

      return json({
        action: "check",
        buckets: bucketsToProcess,
        ...aggregated,
        presets: Object.entries(PRESETS).map(([k, v]) => ({ key: k, ...v })),
      });
    }

    // ── ACTION: convert ──
    const config = PRESETS[preset] || PRESETS.media;
    console.log(`Converting buckets=${bucketsToProcess.join(",")}, preset=${preset} (q=${config.quality}, max=${config.maxDim}), max=${maxFiles}`);

    const bunnyKey = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
    if (!bunnyKey) return json({ error: "BUNNY_STORAGE_API_KEY não configurada" }, 500);

    const results = {
      processed: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
      totalOriginalBytes: 0,
      totalNewBytes: 0,
    };

    let filesProcessed = 0;

    for (const bucket of bucketsToProcess) {
      if (filesProcessed >= maxFiles) break;

      const imageFiles = await listBucketImages(supabase, bucket);
      const candidates = imageFiles.filter(f =>
        /\.(png|jpg|jpeg)$/i.test(f.name) && f.size > 100 * 1024
      );

      const remaining = maxFiles - filesProcessed;
      const filesToProcess = candidates.slice(0, remaining);

      for (const file of filesToProcess) {
        try {
          const { data: fileData, error: dlError } = await supabase.storage.from(bucket).download(file.name);
          if (dlError) { results.errors.push(`${bucket}/${file.name}: download failed`); continue; }

          const arrayBuffer = await fileData.arrayBuffer();
          const originalSize = arrayBuffer.byteLength;
          results.totalOriginalBytes += originalSize;

          // Decode with ImageScript
          let image: Image;
          try {
            image = await Image.decode(new Uint8Array(arrayBuffer));
          } catch (decodeErr) {
            results.errors.push(`${bucket}/${file.name}: decode failed - ${(decodeErr as Error).message}`);
            continue;
          }

          // Resize if needed
          let newWidth = image.width;
          let newHeight = image.height;
          if (newWidth > config.maxDim || newHeight > config.maxDim) {
            const scale = config.maxDim / Math.max(newWidth, newHeight);
            newWidth = Math.round(newWidth * scale);
            newHeight = Math.round(newHeight * scale);
            image.resize(newWidth, newHeight);
          }

          // Encode to WebP
          const webpData = await image.encodeWEBP(config.quality);
          const newSize = webpData.length;
          results.totalNewBytes += newSize;

          // Only upload if meaningful savings (>10%)
          if (newSize < originalSize * 0.9) {
            const newName = file.name.replace(/\.(png|jpg|jpeg)$/i, `-opt.webp`);
            const uploadUrl = `${getBunnyStorageHost()}/${BUNNY_STORAGE_ZONE}/${bucket}/${newName}`;

            const uploadResp = await fetch(uploadUrl, {
              method: "PUT",
              headers: {
                AccessKey: bunnyKey,
                "Content-Type": "image/webp",
              },
              body: webpData,
            });

            if (!uploadResp.ok) {
              const errText = await uploadResp.text();
              results.errors.push(`${bucket}/${file.name}: bunny upload failed ${uploadResp.status} ${errText}`);
              continue;
            }

            // Update DB URLs to point to new Bunny CDN file
            const newCdnUrl = `${BUNNY_CDN_HOST}/${bucket}/${newName}`;
            await updateDbUrls(supabase, bucket, file.name, newCdnUrl);

            results.processed.push(`${bucket}/${file.name} → ${newName} (${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB)`);
            filesProcessed++;
          } else {
            results.skipped.push(`${bucket}/${file.name} (sem ganho)`);
          }
        } catch (err) {
          results.errors.push(`${bucket}/${file.name}: ${(err as Error).message}`);
        }
      }
    }

    const totalSaved = results.totalOriginalBytes - results.totalNewBytes;

    return json({
      success: true,
      preset: { key: preset, ...config },
      buckets: bucketsToProcess,
      summary: {
        processed: results.processed.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        totalSavedMB: (totalSaved / 1024 / 1024).toFixed(2),
      },
      details: {
        processed: results.processed,
        skipped: results.skipped,
        errors: results.errors,
      },
    });
  } catch (error) {
    console.error("batch-convert-webp error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
