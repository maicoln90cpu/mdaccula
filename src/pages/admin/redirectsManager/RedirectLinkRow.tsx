/**
 * RedirectLinkRow — card de um link individual (com toggle, edit, delete).
 * Extraído na Onda 11 sem alterações de comportamento.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Copy,
  Pencil,
  Trash2,
  MousePointerClick,
  Calendar as CalendarIcon,
} from 'lucide-react';
import type { RedirectLink } from './types';

interface RedirectLinkRowProps {
  link: RedirectLink;
  siteUrl: string;
  hasPeriodFilter: boolean;
  periodClickCount: number;
  onCopy: (slug: string) => void;
  onEdit: (link: RedirectLink) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

export const RedirectLinkRow = ({
  link,
  siteUrl,
  hasPeriodFilter,
  periodClickCount,
  onCopy,
  onEdit,
  onToggle,
  onDelete,
}: RedirectLinkRowProps) => (
  <Card className={!link.enabled ? 'opacity-60' : ''}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 min-w-0">
            <code className="text-sm font-mono text-primary truncate">
              {siteUrl}/r/{link.slug}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => onCopy(link.slug)}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            → {link.destination_url}
          </p>
          {link.description && (
            <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
          )}
          <div className="flex gap-1 mt-2 flex-wrap items-center">
            {link.utm_source && (
              <Badge variant="outline" className="text-[10px]">
                source: {link.utm_source}
              </Badge>
            )}
            {link.utm_medium && (
              <Badge variant="outline" className="text-[10px]">
                medium: {link.utm_medium}
              </Badge>
            )}
            {link.utm_campaign && (
              <Badge variant="outline" className="text-[10px]">
                campaign: {link.utm_campaign}
              </Badge>
            )}
            {link.utm_content && (
              <Badge variant="outline" className="text-[10px]">
                content: {link.utm_content}
              </Badge>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
              <CalendarIcon className="w-3 h-3" />
              {new Date(link.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MousePointerClick className="w-4 h-4" />
            <span className="text-sm font-medium">{link.clicks}</span>
            {hasPeriodFilter && (
              <span className="text-xs text-primary ml-1">
                | {periodClickCount} no período
              </span>
            )}
          </div>
          <Switch
            checked={link.enabled}
            onCheckedChange={(enabled) => onToggle(link.id, enabled)}
          />
          <Button variant="ghost" size="icon" onClick={() => onEdit(link)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deletar link?</AlertDialogTitle>
                <AlertDialogDescription>
                  O link <strong>/r/{link.slug}</strong> será removido
                  permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(link.id)}>
                  Deletar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </CardContent>
  </Card>
);
