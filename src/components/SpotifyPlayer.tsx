import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Music } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const SpotifyPlayer = () => {
  const { settings } = useSiteSettings();
  const playlistId = settings.spotify_playlist_id;
  const [shouldLoad, setShouldLoad] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!playlistId) return null;

  return (
    <div className="w-full bg-card rounded-lg p-6 border border-border" ref={observerRef}>
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Ouça Agora</h3>
      </div>
      {shouldLoad ? (
        <iframe
          title="Spotify Playlist MDAccula - Música Eletrônica Techno e House"
          style={{ borderRadius: '12px' }}
          src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
          width="100%"
          height="352"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-[352px] bg-muted/20 animate-pulse rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">Carregando player...</p>
        </div>
      )}
    </div>
  );
};
