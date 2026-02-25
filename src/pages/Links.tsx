import { useState, lazy, Suspense, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";
import { useLinks, CustomLink } from "@/hooks/useLinks";
import { SEOHead } from "@/components/SEOHead";
import { StructuredData } from "@/components/StructuredData";
import { SocialIcons } from "@/components/links/SocialIcons";
import { SortableLinkCard } from "@/components/links/SortableLinkCard";
import { LinksSkeleton } from "@/components/links/LinksSkeleton";
import { getTheme } from "@/lib/linkThemes";
import { getOptimizedImageUrl } from "@/lib/imageUtils";
import { Plus, Copy, User } from "lucide-react";
import { CustomLinkForm } from "@/components/links/CustomLinkForm";
import Navigation from "@/components/ui/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { DragEndEvent } from "@dnd-kit/core";

// Lazy load DnD components - only admin users need drag-and-drop functionality
const DndWrapper = lazy(() => import("@/components/links/DndWrapper"));

export default function Links() {
  const { slug } = useParams();
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const { isAdmin } = useAuth();
  const { groups, loading, refetchLinks, duplicateLink, updateLinkOrder } = useLinks({
    graceHours: settings.event_grace_hours ? parseInt(settings.event_grace_hours, 10) : 6,
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
  const handle = settings.links_page_handle || "@MDAccula";
  const showEventDate = settings.links_show_event_date !== 'false';

  const handleLinkClick = async (link: CustomLink) => {
    const rawUrl = link.url?.trim();
    if (!rawUrl) return;

    // Track click using edge function (fire-and-forget for performance)
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-link-click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ linkId: link.id }),
    }).catch(() => {
      // Silently fail - don't block user navigation
    });

    // External link
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      window.open(rawUrl, "_blank", "noopener,noreferrer");
      return;
    }

    // Internal link
    const internalUrl = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
    navigate(internalUrl);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;
    if (!isAdmin) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeGroup = groups.find(g => g.custom_links.some(l => l.id === activeId));
    const overGroup = groups.find(g => g.custom_links.some(l => l.id === overId));

    if (!activeGroup || !overGroup) return;

    await updateLinkOrder(activeId, overId, activeGroup.id, overGroup.id);
  };

  const copyGroupLink = (groupSlug: string) => {
    const link = `${window.location.origin}/links/${groupSlug}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  // Show skeleton immediately while loading
  if (loading) {
    return <LinksSkeleton />;
  }

  // Filter by slug if present
  const displayGroups = slug 
    ? groups.filter(g => g.slug === slug)
    : groups;

  const allLinks = displayGroups.flatMap(g => g.custom_links);
  const allLinkIds = allLinks.map(l => l.id);

  // Render link groups content
  const renderLinksContent = () => (
    <div className="space-y-8">
      {displayGroups.length === 0 ? (
        <div className="text-center py-12">
          <p className={cn("text-lg", theme.textSecondary)}>Nenhum link disponível no momento</p>
        </div>
      ) : (
        displayGroups.map((group, groupIndex) => (
          <div key={group.id} className="animate-fade-in" style={{ animationDelay: `${groupIndex * 100}ms` }}>
            {group.custom_links.length > 0 && (
              <>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <h3 className={cn("text-xl font-bold text-center", theme.textPrimary)}>{group.name}</h3>
                  <button
                    onClick={() => copyGroupLink(group.slug)}
                    className={cn(
                      "p-1 rounded hover:bg-white/10 transition-colors",
                      theme.textSecondary
                    )}
                    title="Copiar link do grupo"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 w-full mx-auto">
                  {group.custom_links.map((link) => (
                    <SortableLinkCard
                      key={link.id}
                      link={link}
                      onLinkClick={handleLinkClick}
                      onEdit={setEditingLink}
                      onDuplicate={duplicateLink}
                      theme={theme}
                      isAdmin={isAdmin}
                      groupName={group.name}
                      showEventDate={showEventDate}
                      templateCardColor={templateCardColor}
                      templateBorderColor={templateBorderColor}
                      templateCardHeight={templateCardHeight}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <SEOHead title="Links - MD Accula" description="Todos os nossos links importantes em um só lugar" />
      <StructuredData
        type="organization"
        data={{
          name: "MD Accula",
          url: window.location.href,
        }}
      />

      <div className={cn("min-h-screen relative", theme.background)}>
        <Navigation />

        <div className="w-full max-w-[650px] mx-auto px-4 py-24 pb-12">
          {/* Header Section */}
          <div className="text-center mb-8 animate-fade-in">
            {/* Avatar */}
            {avatarUrl ? (
              <img
                src={getOptimizedImageUrl(avatarUrl)}
                alt="Avatar"
                loading="eager"
                decoding="async"
                className="w-28 h-28 md:w-32 md:h-32 rounded-full mx-auto mb-4 border-4 border-white/30 shadow-2xl object-cover"
              />
            ) : (
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full mx-auto mb-4 border-4 border-white/30 shadow-2xl bg-white/10 flex items-center justify-center">
                <User className="w-16 h-16 text-white/50" />
              </div>
            )}

            {/* Handle */}
            <h1 className={cn("text-2xl md:text-3xl font-bold mb-2", theme.textPrimary)}>{handle}</h1>

            {/* Social Icons */}
            <SocialIcons
              instagramUrl={settings.instagram_link}
              soundcloudUrl={settings.soundcloud_link}
              whatsappUrl={settings.whatsapp_link}
              email={settings.contact_email}
            />
          </div>

          {/* Links Section - Conditional DnD for admin only */}
          {isAdmin ? (
            <Suspense fallback={renderLinksContent()}>
              <DndWrapper items={allLinkIds} onDragEnd={handleDragEnd}>
                {renderLinksContent()}
              </DndWrapper>
            </Suspense>
          ) : (
            renderLinksContent()
          )}

          {/* Footer */}
          <div className="text-center mt-12 pb-6">
            <p className={cn("text-sm", theme.textSecondary)}>© {new Date().getFullYear()} MD Accula</p>
          </div>
        </div>

        {/* Add Link Button */}
        {isAdmin && (
          <button
            onClick={() => setShowAddLinkForm(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-110"
            aria-label="Adicionar Link"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Add Link Modal */}
        <Dialog open={showAddLinkForm} onOpenChange={setShowAddLinkForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <CustomLinkForm
              link={null}
              groups={groups}
              preselectedGroupId={null}
              onSuccess={() => {
                setShowAddLinkForm(false);
                refetchLinks();
              }}
              onCancel={() => setShowAddLinkForm(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Link Modal */}
        <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {editingLink && (
              <CustomLinkForm
                link={editingLink as any}
                groups={groups}
                preselectedGroupId={editingLink.group_id || null}
                onSuccess={() => {
                  setEditingLink(null);
                  refetchLinks();
                }}
                onCancel={() => setEditingLink(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
