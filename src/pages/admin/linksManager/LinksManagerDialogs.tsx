import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LinkGroupForm } from '@/components/links/LinkGroupForm';
import { CustomLinkForm } from '@/components/links/CustomLinkForm';
import { LinksPageSettings } from '@/components/links/LinksPageSettings';
import type { SiteSettings } from '@/contexts/siteSettingsContextValue';
import type { CustomLink, LinkGroup } from './types';

interface LinksManagerDialogsProps {
  groups: LinkGroup[];
  showGroupForm: boolean;
  onShowGroupFormChange: (open: boolean) => void;
  editingGroup: LinkGroup | null;
  onEditingGroupClear: () => void;
  showLinkForm: boolean;
  onShowLinkFormChange: (open: boolean) => void;
  editingLink: CustomLink | null;
  selectedGroupId: string | null;
  onLinkFormClear: () => void;
  deleteGroupId: string | null;
  onDeleteGroupIdChange: (id: string | null) => void;
  onConfirmDeleteGroup: () => void;
  deleteLinkId: string | null;
  onDeleteLinkIdChange: (id: string | null) => void;
  onConfirmDeleteLink: () => void;
  showTemplateSettings: boolean;
  onShowTemplateSettingsChange: (open: boolean) => void;
  settings: SiteSettings;
  onRefetch: () => void;
}

export const LinksManagerDialogs = ({
  groups,
  showGroupForm,
  onShowGroupFormChange,
  editingGroup,
  onEditingGroupClear,
  showLinkForm,
  onShowLinkFormChange,
  editingLink,
  selectedGroupId,
  onLinkFormClear,
  deleteGroupId,
  onDeleteGroupIdChange,
  onConfirmDeleteGroup,
  deleteLinkId,
  onDeleteLinkIdChange,
  onConfirmDeleteLink,
  showTemplateSettings,
  onShowTemplateSettingsChange,
  settings,
  onRefetch,
}: LinksManagerDialogsProps) => (
  <>
    <Dialog open={showGroupForm} onOpenChange={onShowGroupFormChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle>
        </DialogHeader>
        <LinkGroupForm
          group={editingGroup}
          onSuccess={() => {
            onShowGroupFormChange(false);
            onEditingGroupClear();
            onRefetch();
          }}
          onCancel={() => {
            onShowGroupFormChange(false);
            onEditingGroupClear();
          }}
        />
      </DialogContent>
    </Dialog>

    <Dialog open={showLinkForm} onOpenChange={onShowLinkFormChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingLink ? 'Editar Link' : 'Novo Link'}</DialogTitle>
        </DialogHeader>
        <CustomLinkForm
          link={editingLink}
          groups={groups}
          preselectedGroupId={selectedGroupId}
          onSuccess={() => {
            onShowLinkFormChange(false);
            onLinkFormClear();
            onRefetch();
          }}
          onCancel={() => {
            onShowLinkFormChange(false);
            onLinkFormClear();
          }}
        />
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteGroupId} onOpenChange={() => onDeleteGroupIdChange(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este grupo? Todos os links dentro dele também serão
            excluídos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmDeleteGroup}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!deleteLinkId} onOpenChange={() => onDeleteLinkIdChange(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este link?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmDeleteLink}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <LinksPageSettings
      open={showTemplateSettings}
      onOpenChange={onShowTemplateSettingsChange}
      currentAvatar={settings.links_page_avatar_url}
      currentHandle={settings.links_page_handle}
      currentTheme={settings.links_page_theme}
      currentCardBorder={settings.links_page_card_border}
      currentCardShadow={settings.links_page_card_shadow}
      currentCardRoundedness={settings.links_page_card_roundedness}
      currentCardBackdrop={settings.links_page_card_backdrop}
      currentCardHover={settings.links_page_card_hover}
      currentCardColor={settings.links_page_card_color}
      currentCardBorderColor={settings.links_page_card_border_color}
    />
  </>
);

export default LinksManagerDialogs;
