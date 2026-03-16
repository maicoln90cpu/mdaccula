import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Bunny Config ──
const BUNNY_STORAGE_ZONE = "mdaccula";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "convert";
    const bucket = body.bucket || "event-images";
    const preset = body.preset || "media";
    const maxFiles = body.maxFiles || 10;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: files, error: listError } = await supabase.storage
      .from(bucket).list("", { limit: 1000 });

    if (listError) return json({ error: `List failed: ${listError.message}` }, 500);

    const allFiles: FileInfo[] = (files || [])
      .filter(f => f.id && !f.name.startsWith("."))
      .map(f => ({ name: f.name, size: (f.metadata as any)?.size || 0 }));

    const imageFiles = allFiles.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f.name));

    // ── ACTION: check ──
    if (action === "check") {
      const small = imageFiles.filter(f => f.size < 500 * 1024);
      const medium = imageFiles.filter(f => f.size >= 500 * 1024 && f.size <= 2 * 1024 * 1024);
      const large = imageFiles.filter(f => f.size > 2 * 1024 * 1024);

      const totalBytes = imageFiles.reduce((sum, f) => sum + f.size, 0);
      const avgMB = imageFiles.length > 0 ? (totalBytes / imageFiles.length / 1024 / 1024) : 0;

      let bunnyCount = -1;
      const bunnyKey = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
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

      return json({
        action: "check",
        bucket,
        totalFiles: allFiles.length,
        totalImages: imageFiles.length,
        bunnyImages: bunnyCount,
        breakdown: {
          small: { count: small.length, label: "< 500 KB" },
          medium: { count: medium.length, label: "500 KB – 2 MB" },
          large: { count: large.length, label: "> 2 MB" },
        },
        totalMB: (totalBytes / 1024 / 1024).toFixed(2),
        avgMB: avgMB.toFixed(2),
        presets: Object.entries(PRESETS).map(([k, v]) => ({ key: k, ...v })),
      });
    }

    // ── ACTION: convert ──
    const config = PRESETS[preset] || PRESETS.media;
    console.log(`Converting bucket=${bucket}, preset=${preset} (q=${config.quality}, max=${config.maxDim}), max=${maxFiles}`);

    const candidates = imageFiles.filter(f =>
      /\.(png|jpg|jpeg)$/i.test(f.name) && f.size > 100 * 1024
    );
    const filesToProcess = candidates.slice(0, maxFiles);

    const results = {
      processed: [] as string[],
      skipped: [] as string[],
      errors: [] as string[],
      totalOriginalBytes: 0,
      totalNewBytes: 0,
    };

    for (const file of filesToProcess) {
      try {
        const { data: fileData, error: dlError } = await supabase.storage.from(bucket).download(file.name);
        if (dlError) { results.errors.push(`${file.name}: download failed`); continue; }

        const arrayBuffer = await fileData.arrayBuffer();
        const originalSize = arrayBuffer.byteLength;
        results.totalOriginalBytes += originalSize;

        const blob = new Blob([arrayBuffer], { type: fileData.type });

        let imageBitmap: ImageBitmap;
        try {
          imageBitmap = await createImageBitmap(blob);
        } catch (bmpErr) {
          const retryBlob = new Blob([arrayBuffer], { type: "image/png" });
          try {
            imageBitmap = await createImageBitmap(retryBlob);
          } catch {
            results.errors.push(`${file.name}: formato não suportado pelo runtime`);
            continue;
          }
        }

        let newWidth = imageBitmap.width;
        let newHeight = imageBitmap.height;
        if (newWidth > config.maxDim || newHeight > config.maxDim) {
          const scale = config.maxDim / Math.max(newWidth, newHeight);
          newWidth = Math.round(newWidth * scale);
          newHeight = Math.round(newHeight * scale);
        }

        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext("2d");
        if (!ctx) { results.errors.push(`${file.name}: canvas failed`); continue; }
        ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

        let optimizedBlob: Blob;
        let outputExt = "webp";
        try {
          optimizedBlob = await canvas.convertToBlob({ type: "image/webp", quality: config.quality / 100 });
        } catch {
          try {
            optimizedBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: config.quality / 100 });
            outputExt = "jpg";
          } catch {
            results.errors.push(`${file.name}: conversão falhou (webp e jpeg)`);
            continue;
          }
        }

        const newSize = optimizedBlob.size;
        results.totalNewBytes += newSize;

        if (newSize < originalSize * 0.9) {
          const newName = file.name.replace(/\.(png|jpg|jpeg)$/i, `-opt.${outputExt}`);
          const { error: uploadError } = await supabase.storage
            .from(bucket).upload(newName, optimizedBlob, { contentType: `image/${outputExt}`, upsert: true });

          if (uploadError) { results.errors.push(`${file.name}: upload failed`); continue; }
          results.processed.push(file.name);
        } else {
          results.skipped.push(file.name);
        }
      } catch (err) {
        results.errors.push(`${file.name}: ${(err as Error).message}`);
      }
    }

    const totalSaved = results.totalOriginalBytes - results.totalNewBytes;

    return json({
      success: true,
      preset: { key: preset, ...config },
      summary: {
        totalCandidates: candidates.length,
        processed: results.processed.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        totalSavedMB: (totalSaved / 1024 / 1024).toFixed(2),
        remaining: candidates.length - filesToProcess.length,
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
