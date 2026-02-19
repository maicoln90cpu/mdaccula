import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function jsonSuccess(data: Record<string, unknown> = { success: true }, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number = 500): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function handleError(error: unknown, functionName: string): Response {
  console.error(`Error in ${functionName}:`, error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return jsonError(message, 500);
}

interface BatchResults {
  processed: string[];
  skipped: string[];
  errors: string[];
  totalOriginalBytes: number;
  totalNewBytes: number;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { bucket = "event-images", quality = 80, maxFiles = 10 } = await req.json();

    console.log(`Starting batch optimization for bucket: ${bucket} (max ${maxFiles} files)`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List all files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list("", { limit: 1000 });

    if (listError) {
      return jsonError(`Failed to list files: ${listError.message}`, 500);
    }

    // Filter large PNG and JPG files (> 500KB) that could benefit from optimization
    const MIN_SIZE_FOR_OPTIMIZATION = 500 * 1024; // 500KB
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB limit for processing
    
    const imageFiles = files?.filter(file => {
      const isImage = /\.(png|jpg|jpeg)$/i.test(file.name);
      const size = file.metadata?.size || 0;
      return isImage && size >= MIN_SIZE_FOR_OPTIMIZATION && size <= MAX_FILE_SIZE;
    }) || [];

    // Take only first N files to avoid timeout
    const filesToProcess = imageFiles.slice(0, maxFiles);

    const skippedTooSmall = files?.filter(file => {
      const isImage = /\.(png|jpg|jpeg)$/i.test(file.name);
      const size = file.metadata?.size || 0;
      return isImage && size < MIN_SIZE_FOR_OPTIMIZATION;
    }).length || 0;

    const skippedTooLarge = files?.filter(file => {
      const isImage = /\.(png|jpg|jpeg)$/i.test(file.name);
      const size = file.metadata?.size || 0;
      return isImage && size > MAX_FILE_SIZE;
    }).length || 0;

    console.log(`Found ${imageFiles.length} optimizable images, processing ${filesToProcess.length}`);
    console.log(`Skipped: ${skippedTooSmall} too small, ${skippedTooLarge} too large`);

    const results: BatchResults = {
      processed: [],
      skipped: [],
      errors: [],
      totalOriginalBytes: 0,
      totalNewBytes: 0,
    };

    for (const file of filesToProcess) {
      try {
        console.log(`Processing ${file.name}...`);

        // Download original
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(file.name);

        if (downloadError) {
          console.error(`Download failed: ${downloadError.message}`);
          results.errors.push(`${file.name}: download failed`);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const originalSize = arrayBuffer.byteLength;
        results.totalOriginalBytes += originalSize;

        console.log(`${file.name}: ${(originalSize / 1024).toFixed(1)} KB`);

        // Re-encode as optimized JPEG using canvas API
        const blob = new Blob([arrayBuffer], { type: fileData.type });
        const imageBitmap = await createImageBitmap(blob);
        
        // Calculate new dimensions (max 1024px on longest side)
        const maxDim = 1024;
        let newWidth = imageBitmap.width;
        let newHeight = imageBitmap.height;
        
        if (newWidth > maxDim || newHeight > maxDim) {
          const scale = maxDim / Math.max(newWidth, newHeight);
          newWidth = Math.round(newWidth * scale);
          newHeight = Math.round(newHeight * scale);
          console.log(`Resizing to ${newWidth}x${newHeight}`);
        }

        // Create canvas and draw resized image
        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          results.errors.push(`${file.name}: canvas context failed`);
          continue;
        }
        ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

        // Encode as optimized JPEG
        const optimizedBlob = await canvas.convertToBlob({
          type: "image/jpeg",
          quality: quality / 100,
        });

        const newSize = optimizedBlob.size;
        results.totalNewBytes += newSize;

        // Only upload if we actually saved space
        if (newSize < originalSize * 0.9) {
          const newName = file.name.replace(/\.(png|jpg|jpeg)$/i, "-opt.jpg");
          
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(newName, optimizedBlob, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Upload failed: ${uploadError.message}`);
            results.errors.push(`${file.name}: upload failed`);
            continue;
          }

          const savedKB = ((originalSize - newSize) / 1024).toFixed(1);
          console.log(`✅ ${file.name} -> ${newName} (saved ${savedKB} KB)`);
          results.processed.push(file.name);
        } else {
          console.log(`⏭️ ${file.name}: no significant savings, skipping`);
          results.skipped.push(file.name);
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error processing ${file.name}:`, err);
        results.errors.push(`${file.name}: ${errorMsg}`);
      }
    }

    const totalSaved = results.totalOriginalBytes - results.totalNewBytes;
    console.log(`Batch complete. Processed: ${results.processed.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`);
    console.log(`Space saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);

    return jsonSuccess({
      success: true,
      summary: {
        totalFound: imageFiles.length,
        processed: results.processed.length,
        skipped: results.skipped.length + skippedTooSmall,
        tooLarge: skippedTooLarge,
        errors: results.errors.length,
        totalSavedMB: (totalSaved / 1024 / 1024).toFixed(2),
        remaining: imageFiles.length - filesToProcess.length,
      },
      details: {
        processed: results.processed,
        skipped: results.skipped,
        errors: results.errors,
      },
    });
  } catch (error) {
    return handleError(error, 'batch-convert-webp');
  }
});
