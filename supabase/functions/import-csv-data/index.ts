import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCSV(csvText: string): Record<string, string>[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = "";
      if (char === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') i++;
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = parseCSVLine(headerLine);
  
  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || "";
    }
    records.push(record);
  }
  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

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

function cleanArray(val: string | undefined | null): string[] {
  const clean = cleanValue(val);
  if (!clean) return [];
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    if (clean.startsWith("[") && clean.endsWith("]")) {
      const inner = clean.slice(1, -1);
      return inner.split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
    return [];
  }
}

function cleanJsonb(val: string | undefined | null): unknown {
  const clean = cleanValue(val);
  if (!clean) return {};
  try {
    return JSON.parse(clean);
  } catch {
    return {};
  }
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

    const contentType = req.headers.get("content-type") || "";
    let table: string;
    let records: Record<string, string>[];
    
    if (contentType.includes("application/json")) {
      const body = await req.json();
      table = body.table;
      
      // Option 0: Import all tables from storage bucket
      if (body.action === "import_all") {
        const results: Record<string, unknown> = {};
        const tables = ["blog_posts", "events", "custom_links", "ai_generated_posts"];
        
        for (const t of tables) {
          try {
            const { data: fileData, error: dlErr } = await supabase.storage
              .from("link-thumbnails")
              .download(`import/${t}.csv`);
            
            if (dlErr || !fileData) {
              results[t] = { error: `Download failed: ${dlErr?.message || 'no data'}` };
              continue;
            }
            
            const csvText = await fileData.text();
            const recs = parseCSV(csvText);
            console.log(`Parsed ${recs.length} records for ${t} from storage`);
            
            if (recs.length === 0) {
              results[t] = { error: "No records parsed" };
              continue;
            }
            
            const importResult = await importTable(supabase, t, recs);
            results[t] = importResult;
          } catch (e) {
            results[t] = { error: e.message };
          }
        }
        
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Option 1: Import from storage bucket
      if (body.from_storage) {
        const storagePath = body.storage_path || `import/${table}.csv`;
        console.log(`Downloading CSV from storage: ${storagePath}`);
        
        const { data: fileData, error: dlErr } = await supabase.storage
          .from(body.bucket || "link-thumbnails")
          .download(storagePath);
        
        if (dlErr || !fileData) {
          return new Response(JSON.stringify({ error: `Storage download failed: ${dlErr?.message || 'no data'}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const csvText = await fileData.text();
        records = parseCSV(csvText);
        console.log(`Parsed ${records.length} records from storage for table ${table}`);
      }
      // Option 2: Fetch CSV from URL
      else if (body.csv_url) {
        console.log(`Fetching CSV from URL: ${body.csv_url}`);
        const csvResp = await fetch(body.csv_url);
        if (!csvResp.ok) {
          return new Response(JSON.stringify({ error: `Failed to fetch CSV: ${csvResp.status}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const csvText = await csvResp.text();
        console.log(`Fetched ${csvText.length} chars, first 200: ${csvText.substring(0, 200)}`);
        records = parseCSV(csvText);
        console.log(`Parsed ${records.length} records from URL for table ${table}`);
      }
      // Option 3: Direct JSON records array
      else if (body.records && Array.isArray(body.records)) {
        records = body.records;
        console.log(`Received ${records.length} JSON records for table ${table}`);
      }
      // Option 4: CSV text or base64
      else {
        const csvText = body.csv_base64
          ? new TextDecoder().decode(Uint8Array.from(atob(body.csv_base64), c => c.charCodeAt(0)))
          : body.csv;
        if (!csvText) {
          return new Response(JSON.stringify({ error: "Missing from_storage, csv_url, records, or csv" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        records = parseCSV(csvText);
        console.log(`Parsed ${records.length} CSV records for table ${table}`);
      }
    } else {
      const url = new URL(req.url);
      table = url.searchParams.get("table") || "";
      const csvText = await req.text();
      if (!table || !csvText) {
        return new Response(JSON.stringify({ error: "Missing table or csv" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      records = parseCSV(csvText);
      console.log(`Parsed ${records.length} CSV records for table ${table}`);
    }
    
    if (!table || !records || records.length === 0) {
      return new Response(JSON.stringify({ error: "Missing table or empty records" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await importTable(supabase, table, records);

    if (result.error) {
      console.error(`Error for ${table}:`, result.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error.message || result.error,
        data: result.data 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      table, 
      data: result.data,
      records: records.length 
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

async function importTable(supabase: any, table: string, records: Record<string, string>[]): Promise<any> {
  if (table === "ai_prompt_templates") {
    const data = records.map(r => ({
      id: r.id,
      name: r.name,
      description: cleanValue(r.description),
      system_prompt: r.system_prompt,
      user_prompt_template: r.user_prompt_template,
      required_fields: cleanJsonb(r.required_fields),
      is_default: cleanBool(r.is_default),
      category: cleanValue(r.category),
      enabled: cleanBool(r.enabled) ?? true,
      created_at: cleanValue(r.created_at),
      updated_at: cleanValue(r.updated_at),
    }));
    return await supabase.from("ai_prompt_templates").upsert(data, { onConflict: "id" });
  }
  
  if (table === "blog_posts") {
    const data = records.map(r => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: cleanValue(r.excerpt),
      content: r.content,
      category: r.category,
      author_id: cleanValue(r.author_id),
      image_url: cleanValue(r.image_url),
      published: cleanBool(r.published) ?? false,
      published_at: cleanValue(r.published_at),
      views: cleanInt(r.views) ?? 0,
      likes: cleanInt(r.likes) ?? 0,
      created_at: cleanValue(r.created_at),
      updated_at: cleanValue(r.updated_at),
    }));
    
    const batchSize = 5;
    let totalInserted = 0;
    let errors: string[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResult = await supabase.from("blog_posts").upsert(batch, { onConflict: "id" });
      if (batchResult.error) {
        errors.push(`Batch ${i / batchSize + 1}: ${batchResult.error.message}`);
        console.error(`Blog posts batch error:`, batchResult.error);
      } else {
        totalInserted += batch.length;
      }
    }
    
    return { 
      error: errors.length > 0 ? { message: errors.join("; ") } : null,
      data: { inserted: totalInserted, errors: errors.length }
    };
  }
  
  if (table === "events") {
    const data = records.map(r => ({
      id: r.id,
      title: r.title,
      venue: r.venue,
      location_state: r.location_state,
      location_city: r.location_city,
      ticket_link: cleanValue(r.ticket_link),
      vip_link: cleanValue(r.vip_link),
      description: cleanValue(r.description),
      lineup: cleanArray(r.lineup),
      image_url: cleanValue(r.image_url),
      created_by: cleanValue(r.created_by),
      created_at: cleanValue(r.created_at),
      updated_at: cleanValue(r.updated_at),
      slug: r.slug,
      date: r.date,
      time: r.time,
      views: cleanInt(r.views) ?? 0,
      blog_post_id: cleanValue(r.blog_post_id),
      end_time: cleanValue(r.end_time),
      genres: cleanArray(r.genres),
      subtitle: cleanValue(r.subtitle),
      address: cleanValue(r.address),
    }));
    
    const batchSize = 20;
    let totalInserted = 0;
    let errors: string[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResult = await supabase.from("events").upsert(batch, { onConflict: "id" });
      if (batchResult.error) {
        errors.push(`Batch ${i / batchSize + 1}: ${batchResult.error.message}`);
        console.error(`Events batch error:`, batchResult.error);
      } else {
        totalInserted += batch.length;
      }
    }
    
    return {
      error: errors.length > 0 ? { message: errors.join("; ") } : null,
      data: { inserted: totalInserted, errors: errors.length }
    };
  }
  
  if (table === "custom_links") {
    const data = records.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      group_id: cleanValue(r.group_id),
      thumbnail_url: cleanValue(r.thumbnail_url),
      icon: cleanValue(r.icon),
      color_gradient: cleanValue(r.color_gradient),
      clicks: cleanInt(r.clicks) ?? 0,
      enabled: cleanBool(r.enabled) ?? true,
      display_order: cleanInt(r.display_order) ?? 0,
      is_internal: cleanBool(r.is_internal) ?? false,
      created_at: cleanValue(r.created_at),
      updated_at: cleanValue(r.updated_at),
      subtitle: cleanValue(r.subtitle),
      is_featured: cleanBool(r.is_featured) ?? false,
      card_height: cleanInt(r.card_height),
      event_id: cleanValue(r.event_id),
      card_width: cleanInt(r.card_width),
      override_date: cleanValue(r.override_date),
      override_time: cleanValue(r.override_time),
      manual_order_override: cleanBool(r.manual_order_override) ?? false,
    }));
    
    const batchSize = 20;
    let totalInserted = 0;
    let errors: string[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResult = await supabase.from("custom_links").upsert(batch, { onConflict: "id" });
      if (batchResult.error) {
        errors.push(`Batch ${i / batchSize + 1}: ${batchResult.error.message}`);
        console.error(`Custom links batch error:`, batchResult.error);
      } else {
        totalInserted += batch.length;
      }
    }
    
    return {
      error: errors.length > 0 ? { message: errors.join("; ") } : null,
      data: { inserted: totalInserted, errors: errors.length }
    };
  }
  
  if (table === "ai_generated_posts") {
    const data = records.map(r => ({
      id: r.id,
      blog_post_id: cleanValue(r.blog_post_id),
      source_urls: cleanArray(r.source_urls),
      prompt_used: cleanValue(r.prompt_used),
      model_used: cleanValue(r.model_used),
      generated_at: cleanValue(r.generated_at),
      template_id: cleanValue(r.template_id),
      input_tokens: cleanInt(r.input_tokens),
      output_tokens: cleanInt(r.output_tokens),
      total_tokens: cleanInt(r.total_tokens),
      image_tokens: cleanInt(r.image_tokens),
    }));
    
    const batchSize = 20;
    let totalInserted = 0;
    let errors: string[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchResult = await supabase.from("ai_generated_posts").upsert(batch, { onConflict: "id" });
      if (batchResult.error) {
        errors.push(`Batch ${i / batchSize + 1}: ${batchResult.error.message}`);
        console.error(`AI posts batch error:`, batchResult.error);
      } else {
        totalInserted += batch.length;
      }
    }
    
    return {
      error: errors.length > 0 ? { message: errors.join("; ") } : null,
      data: { inserted: totalInserted, errors: errors.length }
    };
  }
  
  if (table === "fix_urls") {
    const oldUrl = "nzbyyuqvhrwatmydxiag.supabase.co";
    const newUrl = "xfvpuzlspvvsmmunznxw.supabase.co";
    
    const tables_columns = [
      { table: "blog_posts", columns: ["image_url", "content"] },
      { table: "events", columns: ["image_url"] },
      { table: "custom_links", columns: ["thumbnail_url"] },
      { table: "event_templates", columns: ["image_url"] },
      { table: "recurring_event_configs", columns: ["image_url"] },
    ];
    
    let totalUpdated = 0;
    let errors: string[] = [];
    
    for (const tc of tables_columns) {
      for (const col of tc.columns) {
        const { data: rows, error: fetchErr } = await supabase
          .from(tc.table)
          .select(`id, ${col}`)
          .like(col, `%${oldUrl}%`);
        
        if (fetchErr) {
          errors.push(`${tc.table}.${col} fetch: ${fetchErr.message}`);
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
              errors.push(`${tc.table}.${col} update ${row.id}: ${updateErr.message}`);
            } else {
              totalUpdated++;
            }
          }
        }
      }
    }
    
    return {
      error: errors.length > 0 ? { message: errors.join("; ") } : null,
      data: { updated: totalUpdated, errors: errors.length }
    };
  }
  
  return { error: { message: `Unknown table: ${table}` }, data: null };
}
