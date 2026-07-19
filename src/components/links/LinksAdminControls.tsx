import { useState, lazy, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CustomLinkForm } from '@/components/links/CustomLinkForm';
import type { CustomLink } from '@/hooks/useLinks';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableLinkCard, type Theme } from '@/components/links/SortableLinkCard';

const DndWrapper = lazy(() => import('@/components/links/DndWrapper'));

interface LinkGroup {
  id: string;
  name: string;
  slug: string;
  custom_links: CustomLink[];
}

interface LinksAdminControlsProps {
  groups: LinkGroup[];
  displayGroups: LinkGroup[];
  allLinkIds: string[];
  theme: Theme;
  showEventDate: boolean;
  templateCardColor: string;
  templateBorderColor: string;
  templateCardHeight: number;
  onLinkClick: (link: CustomLink) => void;
  onDragEnd: (event: DragEndEvent) => void;
  duplicateLink: (link: CustomLink) => void;
  refetchLinks: () => void;
  renderGroupHeader: (group: LinkGroup) => React.ReactNode;
}

export const LinksAdminControls = ({
  groups,
  displayGroups,
  allLinkIds,
  theme,
  showEventDate,
  templateCardColor,
  templateBorderColor,
  templateCardHeight,
  onLinkClick,
  onDragEnd,
  duplicateLink,
  refetchLinks,
  renderGroupHeader,
}: LinksAdminControlsProps) => {
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);

  return (
    <>
      <Suspense
        fallback={
          <div className="space-y-8">
            {displayGroups.map((group) => (
              <div key={group.id}>
                {group.custom_links.length > 0 && (
                  <>
                    {renderGroupHeader(group)}
                    <div className="space-y-3 w-full mx-auto">
                      {group.custom_links.map((link) => (
                        <SortableLinkCard
                          key={link.id}
                          link={link}
                          onLinkClick={onLinkClick}
                          onEdit={setEditingLink}
                          onDuplicate={duplicateLink}
                          theme={theme}
                          isAdmin={true}
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
            ))}
          </div>
        }
      >
        <DndWrapper items={allLinkIds} onDragEnd={onDragEnd}>
          <div className="space-y-8">
            {displayGroups.map((group) => (
              <div key={group.id}>
                {group.custom_links.length > 0 && (
                  <>
                    {renderGroupHeader(group)}
                    <div className="space-y-3 w-full mx-auto">
                      {group.custom_links.map((link) => (
                        <SortableLinkCard
                          key={link.id}
                          link={link}
                          onLinkClick={onLinkClick}
                          onEdit={setEditingLink}
                          onDuplicate={duplicateLink}
                          theme={theme}
                          isAdmin={true}
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
            ))}
          </div>
        </DndWrapper>
      </Suspense>

      {/* FAB */}
      <button
        onClick={() => setShowAddLinkForm(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-110"
        aria-label="Adicionar Link"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Modal */}
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

      {/* Edit Modal */}
      <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {editingLink && (
            <CustomLinkForm
              link={editingLink}
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
    </>
  );
};

export default LinksAdminControls;
