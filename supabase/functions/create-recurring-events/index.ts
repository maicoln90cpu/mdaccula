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

interface RecurringConfig {
  id: string;
  name: string;
  title: string;
  weekday: number;
  venue: string;
  address: string | null;
  location_city: string;
  location_state: string;
  time: string;
  end_time: string | null;
  subtitle: string | null;
  description: string | null;
  genres: string[];
  ticket_link: string | null;
  vip_link: string | null;
  image_url: string | null;
  link_group_id: string | null;
}

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}-${random}`;
}

// ============= CONTEÚDO ÚNICO POR INSTÂNCIA =============
// Sem isso, toda semana o campo `description` era copiado 1:1 do template
// (config.description), gerando conteúdo praticamente duplicado entre as
// edições de um mesmo evento recorrente (achado de SEO, ver PENDENCIAS.MD).
// Aqui a gente insere uma abertura variável (data por extenso + frase
// rotativa) antes do texto fixo do config, sem custo de IA extra.
const WEEKDAYS_PT = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const OPENING_VARIANTS = [
  (title: string) => `Mais uma edição do ${title} está chegando.`,
  (title: string) => `Chegou a hora de outra noite do ${title}.`,
  (title: string) => `O ${title} volta para agitar mais um fim de semana.`,
  (title: string) => `Nova edição confirmada: ${title} não para.`,
];

function formatDatePtBr(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAYS_PT[date.getUTCDay()];
  const monthName = MONTHS_PT[date.getUTCMonth()];
  return `${weekday}, ${day} de ${monthName}`;
}

function buildUniqueDescription(config: RecurringConfig, nextDate: string): string {
  // Índice determinístico (não aleatório) baseado na data, pra girar entre
  // as variações sem repetir a mesma abertura toda semana.
  const dayOfYear = Math.floor(
    (new Date(nextDate).getTime() - new Date(`${nextDate.slice(0, 4)}-01-01`).getTime()) /
      86_400_000
  );
  const variant = OPENING_VARIANTS[dayOfYear % OPENING_VARIANTS.length];
  const opening = `${variant(config.title)} Neste(a) ${formatDatePtBr(nextDate)}, o ${config.venue} recebe a galera para mais uma noite de ${(config.genres ?? []).join(", ") || "música eletrônica"}.`;

  return config.description ? `${opening}\n\n${config.description}` : opening;
}

function getNextDateForWeekday(weekday: number, referenceDate: Date): string {
  const result = new Date(referenceDate);
  const currentDay = result.getDay();
  
  let daysToAdd = weekday - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  result.setDate(result.getDate() + daysToAdd);
  
  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, "0");
  const day = String(result.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[create-recurring-events] Starting execution...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body to check if manual execution (force=true skips schedule check)
    let forceExecution = false;
    try {
      const body = await req.json();
      forceExecution = body?.force === true;
    } catch { /* no body = cron trigger */ }

    // Check if this is the correct day/hour to run (unless forced)
    if (!forceExecution) {
      const { data: scheduleSettings } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["recurring_cron_weekday", "recurring_cron_hour"]);
      
      const settingsMap: Record<string, string> = {};
      scheduleSettings?.forEach(s => { settingsMap[s.key] = s.value || ''; });
      
      const scheduledWeekday = parseInt(settingsMap["recurring_cron_weekday"] || "2"); // default Tuesday
      const scheduledHour = parseInt(settingsMap["recurring_cron_hour"] || "3"); // default 03:00
      
      // Use BRT (UTC-3) for the check
      const now = new Date();
      const brtHour = (now.getUTCHours() - 3 + 24) % 24;
      const brtWeekday = new Date(now.getTime() - 3 * 60 * 60 * 1000).getDay();
      
      console.log(`[create-recurring-events] Schedule check: configured=${scheduledWeekday}@${scheduledHour}h, current BRT=${brtWeekday}@${brtHour}h`);
      
      if (brtWeekday !== scheduledWeekday || brtHour !== scheduledHour) {
        console.log("[create-recurring-events] Not the scheduled day/hour, skipping.");
        return new Response(
          JSON.stringify({ success: true, message: "Skipped: not scheduled day/hour", created: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.log("[create-recurring-events] Forced execution (manual trigger)");
    }
    
    // Fetch all enabled recurring configs
    const { data: configs, error: configError } = await supabase
      .from("recurring_event_configs")
      .select("*")
      .eq("enabled", true);
    
    if (configError) {
      console.error("[create-recurring-events] Error fetching configs:", configError);
      throw configError;
    }
    
    if (!configs || configs.length === 0) {
      console.log("[create-recurring-events] No enabled configs found");
      return new Response(
        JSON.stringify({ success: true, message: "No enabled configs found", created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[create-recurring-events] Found ${configs.length} enabled configs`);
    logEgress(supabase, 'recurring_event_configs', configs);
    
    const today = new Date();
    const results: { config: string; date: string; action: string; linkCreated?: boolean }[] = [];
    let createdCount = 0;
    
    for (const config of configs as RecurringConfig[]) {
      const nextDate = getNextDateForWeekday(config.weekday, today);
      console.log(`[create-recurring-events] Processing ${config.name}: weekday ${config.weekday} -> ${nextDate}`);
      
      // Check if event already exists for this title and date
      const { data: existing, error: checkError } = await supabase
        .from("events")
        .select("id")
        .eq("title", config.title)
        .eq("date", nextDate)
        .maybeSingle();
      
      if (checkError) {
        console.error(`[create-recurring-events] Error checking existing event for ${config.name}:`, checkError);
        results.push({ config: config.name, date: nextDate, action: `error: ${checkError.message}` });
        continue;
      }
      
      if (existing) {
        console.log(`[create-recurring-events] Event already exists for ${config.name} on ${nextDate}`);
        results.push({ config: config.name, date: nextDate, action: "skipped (already exists)" });
        continue;
      }
      
      // Create new event
      const slug = generateSlug(config.title);

      const { data: newEvent, error: insertError } = await supabase
        .from("events")
        .insert({
          title: config.title,
          subtitle: config.subtitle,
          date: nextDate,
          time: config.time,
          end_time: config.end_time,
          venue: config.venue,
          address: config.address,
          location_city: config.location_city,
          location_state: config.location_state,
          description: buildUniqueDescription(config, nextDate),
          genres: config.genres,
          ticket_link: config.ticket_link,
          vip_link: config.vip_link,
          image_url: config.image_url,
          slug: slug,
        })
        .select("id")
        .single();
      
      if (insertError) {
        console.error(`[create-recurring-events] Error creating event for ${config.name}:`, insertError);
        results.push({ config: config.name, date: nextDate, action: `error: ${insertError.message}` });
        continue;
      }
      
      console.log(`[create-recurring-events] Created event: ${config.title} on ${nextDate} (ID: ${newEvent.id})`);
      
      let linkCreated = false;
      
      // Create link if link_group_id is configured
      if (config.link_group_id && newEvent) {
        try {
          // Get max display_order in the group
          const { data: maxOrderData } = await supabase
            .from("custom_links")
            .select("display_order")
            .eq("group_id", config.link_group_id)
            .order("display_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const nextOrder = (maxOrderData?.display_order || 0) + 1;
          
          const { error: linkError } = await supabase
            .from("custom_links")
            .insert({
              title: config.title,
              url: config.ticket_link || `#event-${newEvent.id}`,
              group_id: config.link_group_id,
              event_id: newEvent.id,
              enabled: true,
              icon: "Calendar",
              color_gradient: "from-purple-500 to-pink-500",
              thumbnail_url: config.image_url,
              subtitle: config.subtitle,
              display_order: nextOrder,
            });
          
          if (linkError) {
            console.error(`[create-recurring-events] Error creating link for ${config.name}:`, linkError);
          } else {
            console.log(`[create-recurring-events] Created link for event ${config.title}`);
            linkCreated = true;
          }
        } catch (linkErr) {
          console.error(`[create-recurring-events] Exception creating link:`, linkErr);
        }
      }
      
      results.push({ config: config.name, date: nextDate, action: "created", linkCreated });
      createdCount++;
    }
    
    console.log(`[create-recurring-events] Finished. Created ${createdCount} events`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${createdCount} events`,
        created: createdCount,
        results: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[create-recurring-events] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
