import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============= EGRESS TRACKING HELPER =============
function logEgress(supabase: ReturnType<typeof createClient>, apiPath: string, data: unknown) {
  try {
    const bytes = data ? new TextEncoder().encode(JSON.stringify(data)).length : 0;
    const now = new Date();
    now.setMinutes(0, 0, 0);
    supabase.from('egress_metrics').upsert({
      period_start: now.toISOString(),
      api_path: `/rest/v1/${apiPath}`,
      source: 'edge',
      cache_hits: 0,
      cache_misses: 1,
      egress_bytes: bytes,
    }, { onConflict: 'period_start,api_path,source' }).then(() => {}).catch(() => {});
  } catch (_) { /* fire and forget */ }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cleanValue(val: string | undefined | null): string | null {
  if (val === undefined || val === null || val === "" || val === '""') return null;
  return val;
}

function cleanInt(val: string | undefined | null): number | null {
  const clean = cleanValue(val);
  if (!clean) return null;
  const num = parseInt(clean, 10);
  return isNaN(num) ? null : num;
}

function cleanBool(val: string | undefined | null): boolean | null {
  const clean = cleanValue(val);
  if (!clean) return null;
  return clean === "true" || clean === "t" || clean === "1";
}

function cleanArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (val === undefined || val === null || val === "" || val === '""') return [];
  const str = String(val);
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    if (str.startsWith("[") && str.endsWith("]")) {
      const inner = str.slice(1, -1);
      return inner.split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
    return [];
  }
}

// Fetch all existing IDs from a table (handles pagination beyond 1000)
async function getExistingIds(supabase: any, table: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) ids.add(row.id);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

function mapBlogPost(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: cleanValue(r.excerpt as string),
    content: r.content,
    category: r.category,
    author_id: cleanValue(r.author_id as string),
    image_url: cleanValue(r.image_url as string),
    published: cleanBool(r.published as string) ?? false,
    published_at: cleanValue(r.published_at as string),
    views: cleanInt(r.views as string) ?? 0,
    likes: cleanInt(r.likes as string) ?? 0,
    created_at: cleanValue(r.created_at as string),
    updated_at: cleanValue(r.updated_at as string),
  };
}

function mapEvent(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    venue: r.venue,
    location_state: r.location_state,
    location_city: r.location_city,
    ticket_link: cleanValue(r.ticket_link as string),
    vip_link: cleanValue(r.vip_link as string),
    description: cleanValue(r.description as string),
    lineup: cleanArray(r.lineup).flatMap((s) =>
      String(s).split(/[,;]/).map((x) => x.trim().replace(/\.$/, "").trim()).filter(Boolean)
    ),
    image_url: cleanValue(r.image_url as string),
    created_by: cleanValue(r.created_by as string),
    created_at: cleanValue(r.created_at as string),
    updated_at: cleanValue(r.updated_at as string),
    slug: r.slug,
    date: r.date,
    time: r.time,
    views: cleanInt(r.views as string) ?? 0,
    blog_post_id: cleanValue(r.blog_post_id as string),
    end_time: cleanValue(r.end_time as string),
    genres: cleanArray(r.genres),
    subtitle: cleanValue(r.subtitle as string),
    address: cleanValue(r.address as string),
  };
}

function mapCustomLink(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    group_id: cleanValue(r.group_id as string),
    thumbnail_url: cleanValue(r.thumbnail_url as string),
    icon: cleanValue(r.icon as string),
    color_gradient: cleanValue(r.color_gradient as string),
    clicks: cleanInt(r.clicks as string) ?? 0,
    enabled: cleanBool(r.enabled as string) ?? true,
    display_order: cleanInt(r.display_order as string) ?? 0,
    is_internal: cleanBool(r.is_internal as string) ?? false,
    created_at: cleanValue(r.created_at as string),
    updated_at: cleanValue(r.updated_at as string),
    subtitle: cleanValue(r.subtitle as string),
    is_featured: cleanBool(r.is_featured as string) ?? false,
    card_height: cleanInt(r.card_height as string),
    event_id: cleanValue(r.event_id as string),
    card_width: cleanInt(r.card_width as string),
    override_date: cleanValue(r.override_date as string),
    override_time: cleanValue(r.override_time as string),
    manual_order_override: cleanBool(r.manual_order_override as string) ?? false,
  };
}

function mapAIPost(r: Record<string, unknown>) {
  return {
    id: r.id,
    blog_post_id: cleanValue(r.blog_post_id as string),
    source_urls: cleanArray(r.source_urls),
    prompt_used: cleanValue(r.prompt_used as string),
    model_used: cleanValue(r.model_used as string),
    generated_at: cleanValue(r.generated_at as string),
    template_id: cleanValue(r.template_id as string),
    input_tokens: cleanInt(r.input_tokens as string),
    output_tokens: cleanInt(r.output_tokens as string),
    total_tokens: cleanInt(r.total_tokens as string),
    image_tokens: cleanInt(r.image_tokens as string),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { table, records } = body;

    if (!table) {
      return new Response(JSON.stringify({ error: "Missing table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // fix_urls doesn't need records
    if (table === "fix_urls") {
      const result = await fixUrls(supabase);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty records" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let mappedData: any[];
    let tableName: string;

    switch (table) {
      case "blog_posts":
        mappedData = records.map(mapBlogPost);
        tableName = "blog_posts";
        break;
      case "events":
        mappedData = records.map(mapEvent);
        tableName = "events";
        break;
      case "custom_links":
        mappedData = records.map(mapCustomLink);
        tableName = "custom_links";
        break;
      case "ai_generated_posts":
        mappedData = records.map(mapAIPost);
        tableName = "ai_generated_posts";
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown table: ${table}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // --- FK sanitization ---
    let orphanedFKs = 0;

    if (tableName === "events") {
      const blogIds = await getExistingIds(supabase, "blog_posts");
      for (const rec of mappedData) {
        if (rec.blog_post_id && !blogIds.has(rec.blog_post_id)) {
          rec.blog_post_id = null;
          orphanedFKs++;
        }
      }
    } else if (tableName === "custom_links") {
      const eventIds = await getExistingIds(supabase, "events");
      const groupIds = await getExistingIds(supabase, "link_groups");
      for (const rec of mappedData) {
        if (rec.event_id && !eventIds.has(rec.event_id)) {
          rec.event_id = null;
          orphanedFKs++;
        }
        if (rec.group_id && !groupIds.has(rec.group_id)) {
          rec.group_id = null;
          orphanedFKs++;
        }
      }
    } else if (tableName === "ai_generated_posts") {
      const blogIds = await getExistingIds(supabase, "blog_posts");
      for (const rec of mappedData) {
        if (rec.blog_post_id && !blogIds.has(rec.blog_post_id)) {
          rec.blog_post_id = null;
          orphanedFKs++;
        }
      }
    }

    // --- Individual upserts ---
    let inserted = 0;
    const errors: string[] = [];

    for (const rec of mappedData) {
      const { error } = await supabase.from(tableName).upsert(rec, { onConflict: "id" });
      if (error) {
        errors.push(`${rec.id}: ${error.message}`);
        console.error(`Upsert error for ${tableName} id=${rec.id}:`, error.message);
      } else {
        inserted++;
      }
    }

    console.log(`${tableName}: ${inserted} inserted, ${errors.length} errors, ${orphanedFKs} orphaned FKs`);

    return new Response(JSON.stringify({
      success: errors.length === 0,
      table: tableName,
      inserted,
      total: mappedData.length,
      errors: errors.length,
      orphanedFKs,
      errorDetails: errors.length > 0 ? errors.slice(0, 10) : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fixUrls(supabase: any) {
  const oldUrl = "nzbyyuqvhrwatmydxiag.supabase.co";
  const newUrl = "xfvpuzlspvvsmmunznxw.supabase.co";

  const tablesColumns = [
    { table: "blog_posts", columns: ["image_url", "content"] },
    { table: "events", columns: ["image_url"] },
    { table: "custom_links", columns: ["thumbnail_url"] },
    { table: "event_templates", columns: ["image_url"] },
    { table: "recurring_event_configs", columns: ["image_url"] },
  ];

  let totalUpdated = 0;
  const errors: string[] = [];

  for (const tc of tablesColumns) {
    for (const col of tc.columns) {
      const { data: rows, error: fetchErr } = await supabase
        .from(tc.table)
        .select(`id, ${col}`)
        .like(col, `%${oldUrl}%`);

      if (fetchErr) {
        errors.push(`${tc.table}.${col}: ${fetchErr.message}`);
        continue;
      }

      if (rows && rows.length > 0) {
        for (const row of rows) {
          const oldVal = row[col] as string;
          const newVal = oldVal.replace(new RegExp(oldUrl.replace(/\./g, '\\.'), 'g'), newUrl);
          const { error: updateErr } = await supabase
            .from(tc.table)
            .update({ [col]: newVal })
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`${tc.table}.${col} ${row.id}: ${updateErr.message}`);
          } else {
            totalUpdated++;
          }
        }
      }
    }
  }

  return { data: { updated: totalUpdated, errors: errors.length, errorDetails: errors.length > 0 ? errors : undefined } };
}
