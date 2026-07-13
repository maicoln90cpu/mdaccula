/**
 * EventLocationMap — mostra mapa do Google + botão "Como chegar".
 *
 * - Se o evento tem lat/lng no banco → renderiza mapa iframe (Maps Embed API).
 * - Se não tem, chama edge fn `geocode-event` uma vez para popular o banco
 *   e mostra o mapa quando as coords voltarem.
 * - Botão "Como chegar" abre deep-link do Google Maps com destino já preenchido
 *   (funciona mesmo sem coords: usa venue+cidade+estado).
 *
 * IMPORTANTE: A chave gerenciada de Google Maps só funciona em *.lovable.app.
 * Em domínios customizados o iframe pode não carregar — nesse caso o botão
 * "Como chegar" continua funcionando (não depende da chave).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { logger } from "@/lib";

interface Props {
  eventId: string;
  venue: string;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
}

const FALLBACK_BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
  | string
  | undefined;

// Cache do módulo — evita refetch a cada montagem do componente.
let cachedBrowserKey: string | null | undefined;
let inflightKeyPromise: Promise<string | null> | null = null;

async function resolveBrowserKey(): Promise<string | null> {
  if (cachedBrowserKey !== undefined) return cachedBrowserKey;
  if (inflightKeyPromise) return inflightKeyPromise;
  inflightKeyPromise = (async () => {
    try {
      const { data } = await supabase.functions.invoke("public-maps-config", { body: {} });
      const key = (data as { browser_key?: string | null } | null)?.browser_key ?? null;
      cachedBrowserKey = key ?? FALLBACK_BROWSER_KEY ?? null;
    } catch {
      cachedBrowserKey = FALLBACK_BROWSER_KEY ?? null;
    }
    return cachedBrowserKey ?? null;
  })();
  return inflightKeyPromise;
}

export const EventLocationMap = ({
  eventId,
  venue,
  city,
  state,
  latitude,
  longitude,
}: Props) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    latitude != null && longitude != null
      ? { lat: Number(latitude), lng: Number(longitude) }
      : null,
  );
  const [loading, setLoading] = useState(false);

  const address = [venue, city, state].filter(Boolean).join(", ");
  const directionsUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address + ", Brasil")}`;

  // Auto-geocode se ainda não temos coords
  useEffect(() => {
    if (coords) return;
    if (!venue || !city) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("geocode-event", {
          body: { event_id: eventId },
        });
        if (cancelled) return;
        if (error) {
          logger.warn("geocode-event failed", { component: "EventLocationMap", error: String(error) });
          return;
        }
        if (data?.ok && data.lat != null && data.lng != null) {
          setCoords({ lat: Number(data.lat), lng: Number(data.lng) });
        }
      } catch (err) {
        logger.warn("geocode-event exception", { component: "EventLocationMap", error: err instanceof Error ? err.message : String(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, venue, city, coords]);

  const embedSrc =
    coords && BROWSER_KEY
      ? `https://www.google.com/maps/embed/v1/place?key=${BROWSER_KEY}&q=${coords.lat},${coords.lng}&language=pt-BR&region=br`
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="w-5 h-5" />
          Localização
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {embedSrc ? (
          <div className="rounded-lg overflow-hidden border border-border/50">
            <iframe
              title={`Mapa de ${venue}`}
              src={embedSrc}
              width="100%"
              height="260"
              style={{ border: 0, display: "block" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="h-[140px] flex items-center justify-center rounded-lg bg-muted/40 border border-dashed border-border/50">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Localizando no mapa…
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center px-4">
                Mapa não disponível neste domínio. Use "Como chegar" abaixo.
              </p>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{venue}</div>
          <div>
            {city} - {state}
          </div>
        </div>

        <Button asChild variant="default" className="w-full">
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="w-4 h-4 mr-2" />
            Como chegar
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};
