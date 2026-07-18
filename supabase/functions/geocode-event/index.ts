/**
 * geocode-event: recebe { event_id } (admin ou service),
 *   1. Lê venue + cidade + estado do evento
 *   2. Consulta Google Maps Geocoding API via gateway
 *   3. Salva latitude/longitude/geocoded_at no evento
 * Retorna { ok, lat, lng, formatted_address } ou { skipped, reason }.
 *
 * Chamável:
 *   - Pelo frontend (usuário logado admin) — passa Authorization
 *   - Por outra edge fn com service role — passa Authorization Bearer service_role
 *   - Auto-geocode público leve: se o evento ainda não tem coords, permite anon (idempotente,
 *     salva no banco, uma vez só). Limite implícito pelo próprio cache no banco.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return json({ error: "Google Maps connector not linked" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const eventId = typeof body?.event_id === "string" ? body.event_id : null;
    const force = body?.force === true;
    if (!eventId) return json({ error: "event_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, venue, location_city, location_state, latitude, longitude, geocoded_at")
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr) return json({ error: eventErr.message }, 500);
    if (!event) return json({ error: "event not found" }, 404);

    // Já tem coordenadas e não é force → idempotente
    if (!force && event.latitude != null && event.longitude != null) {
      return json({
        ok: true,
        cached: true,
        lat: Number(event.latitude),
        lng: Number(event.longitude),
      });
    }

    // Montar query: "venue, cidade, estado, BR"
    const parts = [event.venue, event.location_city, event.location_state].filter(Boolean);
    if (parts.length === 0) return json({ skipped: true, reason: "no_address" });
    const address = parts.join(", ") + ", Brasil";

    // Geocoding via gateway
    const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=br&language=pt-BR`;
    const geoResp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      },
    });

    if (!geoResp.ok) {
      const errorBody = await geoResp.text();
      console.error(`Geocode gateway [${geoResp.status}]: ${errorBody}`);
      return json({ error: "geocode gateway failed", status: geoResp.status, details: errorBody }, geoResp.status);
    }

    const geoData = await geoResp.json();
    if (geoData.status !== "OK" || !geoData.results?.length) {
      return json({
        ok: false,
        skipped: true,
        reason: "geocode_" + (geoData.status ?? "no_results"),
        google_error: geoData.error_message ?? null,
      });
    }

    const loc = geoData.results[0].geometry?.location;
    const formatted = geoData.results[0].formatted_address ?? null;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      return json({ ok: false, skipped: true, reason: "no_location" });
    }

    const { error: updateErr } = await supabase
      .from("events")
      .update({
        latitude: loc.lat,
        longitude: loc.lng,
        geocoded_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (updateErr) {
      console.error("update event error:", updateErr.message);
      return json({ error: updateErr.message }, 500);
    }

    return json({
      ok: true,
      cached: false,
      lat: loc.lat,
      lng: loc.lng,
      formatted_address: formatted,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("geocode-event error:", msg);
    return json({ error: msg }, 500);
  }
});
