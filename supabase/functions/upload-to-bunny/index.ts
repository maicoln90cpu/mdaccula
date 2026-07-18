import { createClient } from "npm:@supabase/supabase-js@2";

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

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: isAdmin } = await supabaseAnon.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "event-images";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Only image files are allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large (max 10MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("BUNNY_STORAGE_API_KEY")?.trim()?.replace(/^["']|["']$/g, '')?.replace(/[^\x20-\x7E]/g, '');
    if (!apiKey) {
      console.error("BUNNY_STORAGE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Storage not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();

    // ── SHA256 Deduplication ──
    const hash = await sha256Hex(fileBuffer);
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await supabaseService
      .from("image_hashes")
      .select("url")
      .eq("hash", hash)
      .maybeSingle();

    if (existing?.url) {
      console.log(`Duplicate detected (hash=${hash.slice(0, 12)}…), returning existing: ${existing.url}`);
      return new Response(
        JSON.stringify({ url: existing.url, path: "", size: file.size, deduplicated: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Upload to Bunny ──
    const ext = file.name?.split(".").pop() || "webp";
    const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const storagePath = `${bucket}/${fileName}`;

    const bunnyUrl = `${getBunnyStorageHost()}/${BUNNY_STORAGE_ZONE}/${storagePath}`;

    const uploadResponse = await fetch(bunnyUrl, {
      method: "PUT",
      headers: {
        AccessKey: apiKey,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Bunny upload failed:", uploadResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Upload failed", details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const publicUrl = `${BUNNY_CDN_HOST}/${storagePath}`;

    // ── Backup to Supabase Storage (fire-and-forget) ──
    const backupPromise = (async () => {
      try {
        const { error: backupError } = await supabaseService.storage
          .from(bucket)
          .upload(fileName, fileBuffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (backupError) {
          console.warn(`Supabase Storage backup failed for ${fileName}:`, backupError.message);
        } else {
          console.log(`Supabase Storage backup OK: ${bucket}/${fileName}`);
        }
      } catch (err) {
        console.warn("Supabase Storage backup error:", err);
      }
    })();

    // Save hash for future deduplication
    const hashPromise = supabaseService.from("image_hashes").insert({
      hash,
      url: publicUrl,
      bucket,
      file_size: file.size,
    }).then(({ error }) => {
      if (error) console.warn("Failed to save image hash:", error.message);
    });

    // Wait for both in parallel but don't block the response on failure
    await Promise.allSettled([backupPromise, hashPromise]);

    return new Response(
      JSON.stringify({ url: publicUrl, path: storagePath, size: file.size, deduplicated: false }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("upload-to-bunny error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
