import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GripVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Plus,
} from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '@/components/links/SortableItem';
import { useToast } from '@/hooks/useToast';
import { LinkRow } from './LinkRow';
import type { CustomLink, LinkGroup } from './types';

interface GroupCardProps {
  group: LinkGroup;
  onToggleGroupEnabled: (groupId: string, enabled: boolean) => void;
  onEditGroup: (group: LinkGroup) => void;
  onRequestDeleteGroup: (groupId: string) => void;
  onAddLinkToGroup: (groupId: string) => void;
  onToggleLinkEnabled: (linkId: string, enabled: boolean) => void;
  onResetManualOrder: (linkId: string) => void;
  onRequestAddToGroup: (link: CustomLink) => void;
  onDuplicateLink: (link: CustomLink) => void;
  onEditLink: (link: CustomLink) => void;
  onRequestDeleteLink: (linkId: string) => void;
}

export const GroupCard = ({
  group,
  onToggleGroupEnabled,
  onEditGroup,
  onRequestDeleteGroup,
  onAddLinkToGroup,
  onToggleLinkEnabled,
  onResetManualOrder,
  onRequestAddToGroup,
  onDuplicateLink,
  onEditLink,
  onRequestDeleteLink,
}: GroupCardProps) => {
  const { toast } = useToast();

  return (
    <Card className={!group.enabled ? 'opacity-50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <SortableItem id={`group-${group.id}`}>
              <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
            </SortableItem>
            <div>
              <CardTitle className="text-xl">{group.name}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                /links/{group.slug}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/links/${group.slug}`
                    );
                    toast({ title: 'Link copiado!' });
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleGroupEnabled(group.id, group.enabled)}
            >
              {group.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEditGroup(group)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRequestDeleteGroup(group.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <SortableContext
            items={group.custom_links?.map((l) => l.id) || []}
            strategy={verticalListSortingStrategy}
          >
            {group.custom_links?.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                onToggleEnabled={onToggleLinkEnabled}
                onResetManualOrder={onResetManualOrder}
                onRequestAddToGroup={onRequestAddToGroup}
                onDuplicate={onDuplicateLink}
                onEdit={onEditLink}
                onRequestDelete={onRequestDeleteLink}
              />
            ))}
          </SortableContext>

          {(!group.custom_links || group.custom_links.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">Nenhum link neste grupo</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddLinkToGroup(group.id)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Link
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupCard;
