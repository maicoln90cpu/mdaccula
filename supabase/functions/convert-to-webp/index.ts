import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonSuccess(data: Record<string, unknown> = { success: true }, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, bucket = "event-images" } = await req.json();

    if (!imageUrl) {
      return jsonError("imageUrl is required", 400);
    }

    // Skip if already optimized
    if (imageUrl.match(/\.(webp|svg)$/i)) {
      return jsonSuccess({
        success: true,
        originalUrl: imageUrl,
        newUrl: imageUrl,
        skipped: true,
        reason: "Already in optimal format",
      });
    }

    console.log(`Processing image: ${imageUrl}`);

    // Download the original image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return jsonError(`Failed to fetch image: ${imageResponse.status}`, 500);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const originalSize = imageBuffer.byteLength;
    console.log(`Image size: ${(originalSize / 1024).toFixed(2)} KB`);

    // Skip files > 2MB
    if (originalSize > 2 * 1024 * 1024) {
      return jsonSuccess({
        success: true,
        originalUrl: imageUrl,
        newUrl: imageUrl,
        skipped: true,
        reason: "File too large (>2MB)",
      });
    }

    // Note: Full WebP conversion is handled client-side via ImageUploadWithCrop.
    // This edge function serves as a no-op placeholder for batch operations.
    // The Supabase edge runtime does not support image encoding libraries
    // (ImageScript encodeWEBP, OffscreenCanvas, createImageBitmap are all unavailable).
    
    return jsonSuccess({
      success: true,
      originalUrl: imageUrl,
      newUrl: imageUrl,
      skipped: true,
      reason: "Server-side WebP conversion unavailable in edge runtime. Use client-side upload for WebP.",
      originalSize,
    });
  } catch (error) {
    console.error("Error in convert-to-webp:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(message, 500);
  }
});
