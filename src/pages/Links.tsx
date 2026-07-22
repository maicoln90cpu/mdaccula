import { useState, lazy, Suspense, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuthContext';
import type { CustomLink } from '@/hooks/useLinks';
import { useLinks } from '@/hooks/useLinks';
import { SEOHead } from '@/components/SEOHead';
import { StructuredData } from '@/components/StructuredData';
import { SocialIcons } from '@/components/links/SocialIcons';
import { SimpleLinkCard } from '@/components/links/SimpleLinkCard';
import { LinksSkeleton } from '@/components/links/LinksSkeleton';
import { getTheme } from '@/lib/linkThemes';
import { getOptimizedImageUrl, getThumbnailUrl, handleThumbImageFallback } from '@/lib/imageUtils';
import { Copy, Check, User } from 'lucide-react';
import Navigation from '@/components/ui/navigation';
import { toast } from 'sonner';
import type { DragEndEvent } from '@dnd-kit/core';

// Lazy load entire admin controls — DnD, Dialog, CustomLinkForm, SortableLinkCard
const LinksAdminControls = lazy(() => import('@/components/links/LinksAdminControls'));

export default function Links() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { settings } = useSiteSettings();
  const { isAdmin } = useAuth();
  const { groups, loading, fetchError, refetchLinks, duplicateLink, updateLinkOrder } = useLinks({
    hoursAfterStart: settings.event_hours_after_start
      ? parseInt(settings.event_hours_after_start, 10)
      : 12,
    hoursWithoutTime: settings.event_hours_without_time
      ? parseInt(settings.event_hours_without_time, 10)
      : 24,
    timezoneOffset: settings.timezone_offset ? parseInt(settings.timezone_offset, 10) : -3,
  });

  const baseTheme = getTheme(settings.links_page_theme);
  const theme = {
    ...baseTheme,
    cardBorder: settings.links_page_card_border || baseTheme.cardBorder,
    cardShadow: settings.links_page_card_shadow || baseTheme.cardShadow,
    cardRoundedness: settings.links_page_card_roundedness || baseTheme.cardRoundedness,
    cardBackdrop: settings.links_page_card_backdrop || baseTheme.cardBackdrop,
    cardHoverEffect: settings.links_page_card_hover || baseTheme.cardHoverEffect,
  };
  const templateCardColor = settings.links_page_card_color || '';
  const templateBorderColor = settings.links_page_card_border_color || '';
  const templateCardHeight = parseInt(settings.links_page_card_default_height || '100');
  const avatarUrl = settings.links_page_avatar_url;
  const handle = settings.links_page_handle || '@MDAccula';
  const showEventDate = settings.links_show_event_date !== 'false';

  const handleLinkClick = useCallback(
    async (link: CustomLink) => {
      const rawUrl = link.url?.trim();
      if (!rawUrl) return;

      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-link-click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ linkId: link.id }),
      }).catch(() => {});

      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        window.open(rawUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const internalUrl = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
      navigate(internalUrl);
    },
    [navigate]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      if (!isAdmin) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      const activeGroup = groups.find((g) => g.custom_links.some((l) => l.id === activeId));
      const overGroup = groups.find((g) => g.custom_links.some((l) => l.id === overId));
      if (!activeGroup || !overGroup) return;

      await updateLinkOrder(activeId, overId, activeGroup.id, overGroup.id);
    },
    [isAdmin, groups, updateLinkOrder]
  );

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const copyGroupLink = useCallback((groupSlug: string) => {
    const link = `${window.location.origin}/links/${groupSlug}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
    setCopiedSlug(groupSlug);
    window.setTimeout(
      () => setCopiedSlug((current) => (current === groupSlug ? null : current)),
      1500
    );
  }, []);

  if (loading) {
    return <LinksSkeleton />;
  }

  const displayGroups = slug ? groups.filter((g) => g.slug === slug) : groups;
  const allLinkIds = displayGroups.flatMap((g) => g.custom_links.map((l) => l.id));

  const renderGroupHeader = (group: { name: string; slug: string }) => (
    <div className="flex items-center justify-center gap-2 mb-4">
      <h3 className={cn('text-xl font-bold text-center', theme.textPrimary)}>{group.name}</h3>
      <button
        onClick={() => copyGroupLink(group.slug)}
        className={cn('p-1 rounded hover:bg-white/10 transition-colors', theme.textSecondary)}
        title="Copiar link do grupo"
      >
        {copiedSlug === group.slug ? (
          <Check className="w-4 h-4 text-success" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Links - MD Accula"
        description="Todos os nossos links importantes em um só lugar"
      />
      <StructuredData type="organization" data={{ name: 'MD Accula', url: window.location.href }} />

      <motion.div
        className={cn('min-h-screen relative', theme.background)}
        style={{ backgroundSize: '200% 200%' }}
        animate={
          prefersReducedMotion ? undefined : { backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }
        }
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Navigation />

        <div id="main-content" className="w-full max-w-[650px] mx-auto px-4 py-24 pb-12">
          {/* Header */}
          <div className="text-center mb-8 animate-fade-in">
            {avatarUrl ? (
              <img
                src={getThumbnailUrl(avatarUrl)}
                onError={(e) => handleThumbImageFallback(e, getOptimizedImageUrl(avatarUrl))}
                alt="Avatar"
                loading="eager"
                decoding="async"
                fetchpriority="high"
                width={128}
                height={128}
                className="w-28 h-28 md:w-32 md:h-32 rounded-full mx-auto mb-4 border-4 border-white/30 shadow-2xl object-cover animate-glow"
              />
            ) : (
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full mx-auto mb-4 border-4 border-white/30 shadow-2xl bg-white/10 flex items-center justify-center animate-glow">
                <User className="w-16 h-16 text-white/50" />
              </div>
            )}
            <h1 className={cn('text-2xl md:text-3xl font-bold mb-2', theme.textPrimary)}>
              {handle}
            </h1>
            <SocialIcons
              instagramUrl={settings.instagram_link}
              soundcloudUrl={settings.soundcloud_link}
              whatsappUrl={settings.whatsapp_link}
              email={settings.contact_email}
            />
          </div>

          {/* Links */}
          {isAdmin ? (
            <Suspense
              fallback={
                <div className="space-y-8">
                  {displayGroups.map((group) => (
                    <div key={group.id}>
                      {group.custom_links.length > 0 && (
                        <>
                          {renderGroupHeader(group)}
                          <div className="space-y-3 w-full mx-auto">
                            {group.custom_links.map((link, index) => (
                              <SimpleLinkCard
                                key={link.id}
                                link={link}
                                onLinkClick={handleLinkClick}
                                theme={theme}
                                groupName={group.name}
                                showEventDate={showEventDate}
                                templateCardColor={templateCardColor}
                                templateBorderColor={templateBorderColor}
                                templateCardHeight={templateCardHeight}
                                index={index}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              }
            >
              <LinksAdminControls
                groups={groups}
                displayGroups={displayGroups}
                allLinkIds={allLinkIds}
                theme={theme}
                showEventDate={showEventDate}
                templateCardColor={templateCardColor}
                templateBorderColor={templateBorderColor}
                templateCardHeight={templateCardHeight}
                onLinkClick={handleLinkClick}
                onDragEnd={handleDragEnd}
                duplicateLink={duplicateLink}
                refetchLinks={refetchLinks}
                renderGroupHeader={renderGroupHeader}
              />
            </Suspense>
          ) : (
            <div className="space-y-8">
              {fetchError && groups.length > 0 && (
                <div className="text-center py-3 px-4 bg-warning/10 border border-warning/30 rounded-lg mb-4">
                  <p className={cn('text-sm', theme.textSecondary)}>
                    ⚠️ Modo offline — exibindo última versão salva
                  </p>
                </div>
              )}
              {displayGroups.length === 0 ? (
                <div className="text-center py-12">
                  <p className={cn('text-lg', theme.textSecondary)}>
                    {fetchError
                      ? 'Serviço temporariamente indisponível. Tente novamente em instantes.'
                      : 'Nenhum link disponível no momento'}
                  </p>
                </div>
              ) : (
                displayGroups.map((group) => (
                  <div key={group.id}>
                    {group.custom_links.length > 0 && (
                      <>
                        {renderGroupHeader(group)}
                        <div className="space-y-3 w-full mx-auto">
                          {group.custom_links.map((link, index) => (
                            <SimpleLinkCard
                              key={link.id}
                              link={link}
                              onLinkClick={handleLinkClick}
                              theme={theme}
                              groupName={group.name}
                              showEventDate={showEventDate}
                              templateCardColor={templateCardColor}
                              templateBorderColor={templateBorderColor}
                              templateCardHeight={templateCardHeight}
                              index={index}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-12 pb-6">
            <p className={cn('text-sm', theme.textSecondary)}>
              © {new Date().getFullYear()} MD Accula
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
