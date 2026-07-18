import { createClient } from "npm:@supabase/supabase-js@2";

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

function jsonSuccess(data: Record<string, unknown>, status = 200): Response {
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

interface CleanupResult {
  orphanedDeleted: string[];
  duplicatesDeleted: string[];
  errors: string[];
  totalFreedBytes: number;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { dryRun = true, bucket = "event-images" } = await req.json().catch(() => ({ dryRun: true, bucket: "event-images" }));

    console.log(`Starting storage cleanup for bucket: ${bucket} (dryRun: ${dryRun})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. List all files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list("", { limit: 1000 });

    if (listError) {
      return jsonError(`Failed to list files: ${listError.message}`);
    }

    if (!files || files.length === 0) {
      return jsonSuccess({ success: true, message: "No files found in bucket", result: { orphanedDeleted: [], duplicatesDeleted: [], errors: [], totalFreedBytes: 0 } });
    }

    console.log(`Found ${files.length} files in ${bucket}`);

    // 2. Get all referenced image URLs from events and blog_posts
    const [eventsResult, postsResult] = await Promise.all([
      supabase.from("events").select("image_url").not("image_url", "is", null),
      supabase.from("blog_posts").select("image_url").not("image_url", "is", null),
    ]);

    const referencedUrls = new Set<string>();

    const extractFileName = (url: string): string | null => {
      if (!url) return null;
      // Extract filename from Supabase storage URL
      const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)/);
      if (match) return match[1];
      // Try just the filename
      const parts = url.split('/');
      return parts[parts.length - 1] || null;
    };

    for (const event of eventsResult.data || []) {
      const fileName = extractFileName(event.image_url);
      if (fileName) referencedUrls.add(fileName);
    }

    for (const post of postsResult.data || []) {
      const fileName = extractFileName(post.image_url);
      if (fileName) referencedUrls.add(fileName);
    }

    console.log(`Found ${referencedUrls.size} referenced images in DB`);

    // 3. Find duplicates by size (files with identical sizes are likely duplicates)
    const sizeMap = new Map<number, typeof files>();
    for (const file of files) {
      const size = file.metadata?.size || 0;
      if (size > 0) {
        if (!sizeMap.has(size)) {
          sizeMap.set(size, []);
        }
        sizeMap.get(size)!.push(file);
      }
    }

    const result: CleanupResult = {
      orphanedDeleted: [],
      duplicatesDeleted: [],
      errors: [],
      totalFreedBytes: 0,
    };

    // 4. Identify orphaned files (not referenced by any event or blog_post)
    const orphanedFiles = files.filter(file => {
      const isReferenced = referencedUrls.has(file.name);
      return !isReferenced;
    });

    console.log(`Found ${orphanedFiles.length} orphaned files`);

    // 5. Identify duplicate groups (same size, keep only one)
    const duplicateFiles: typeof files = [];
    for (const [size, group] of sizeMap.entries()) {
      if (group.length > 1 && size > 100 * 1024) { // Only flag duplicates > 100KB
        // Keep the first one that is referenced, or just the first one
        const referenced = group.filter(f => referencedUrls.has(f.name));
        const keep = referenced.length > 0 ? referenced[0] : group[0];
        
        for (const file of group) {
          if (file.name !== keep.name) {
            duplicateFiles.push(file);
          }
        }
      }
    }

    console.log(`Found ${duplicateFiles.length} duplicate files`);

    // 6. Delete orphaned files (if not dry run)
    if (!dryRun) {
      // Delete orphaned
      for (const file of orphanedFiles) {
        try {
          const { error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([file.name]);

          if (deleteError) {
            result.errors.push(`${file.name}: ${deleteError.message}`);
          } else {
            result.orphanedDeleted.push(file.name);
            result.totalFreedBytes += file.metadata?.size || 0;
          }
        } catch (err) {
          result.errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Delete duplicates
      for (const file of duplicateFiles) {
        // Skip if already deleted as orphan
        if (result.orphanedDeleted.includes(file.name)) continue;
        
        try {
          const { error: deleteError } = await supabase.storage
            .from(bucket)
            .remove([file.name]);

          if (deleteError) {
            result.errors.push(`${file.name}: ${deleteError.message}`);
          } else {
            result.duplicatesDeleted.push(file.name);
            result.totalFreedBytes += file.metadata?.size || 0;
          }
        } catch (err) {
          result.errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } else {
      // Dry run - just report what would be deleted
      result.orphanedDeleted = orphanedFiles.map(f => f.name);
      result.duplicatesDeleted = duplicateFiles.map(f => f.name);
      result.totalFreedBytes = [
        ...orphanedFiles,
        ...duplicateFiles.filter(f => !orphanedFiles.find(o => o.name === f.name)),
      ].reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
    }

    const freedMB = (result.totalFreedBytes / 1024 / 1024).toFixed(2);
    console.log(`Cleanup ${dryRun ? '(DRY RUN) ' : ''}complete. Freed: ${freedMB} MB`);

    return jsonSuccess({
      success: true,
      dryRun,
      bucket,
      totalFiles: files.length,
      referencedFiles: referencedUrls.size,
      summary: {
        orphanedCount: result.orphanedDeleted.length,
        duplicatesCount: result.duplicatesDeleted.length,
        errorsCount: result.errors.length,
        freedMB,
      },
      details: result,
    });
  } catch (error) {
    console.error("Cleanup storage error:", error);
    return jsonError(error instanceof Error ? error.message : "Unknown error");
  }
});
