import {
  Calendar,
  MapPin,
  Pencil,
  Trash2,
  Copy,
  FileText,
  Loader2,
  GitMerge,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { Event } from './types';

interface Props {
  event: Event;
  mergeMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (event: Event) => void;
  onDuplicate: (event: Event) => void;
  onGenerateArticle: (event: Event) => void;
  onReactivate: (event: Event) => void;
  onDelete: (id: string) => void;
  generatingArticle: string | null;
  reactivatingId: string | null;
  mergedPrimaryTitles: Record<string, string>;
}

export function EventCard({
  event,
  mergeMode,
  selected,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onGenerateArticle,
  onReactivate,
  onDelete,
  generatingArticle,
  reactivatingId,
  mergedPrimaryTitles,
}: Props) {
  const isMergeable = event.status === 'active' && !event.is_merge_shell;

  return (
    <Card
      className={`overflow-hidden relative transition ${mergeMode && selected ? 'ring-2 ring-primary' : ''} ${mergeMode && !isMergeable ? 'opacity-50' : ''}`}
      onClick={mergeMode && isMergeable ? () => onToggleSelect(event.id) : undefined}
      style={mergeMode && isMergeable ? { cursor: 'pointer' } : undefined}
    >
      {mergeMode && (
        <div className="absolute top-2 left-2 z-10 bg-background/90 rounded p-1">
          <Checkbox checked={selected} disabled={!isMergeable} />
        </div>
      )}
      {event.image_url && (
        <div className="h-48 overflow-hidden">
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      <CardHeader>
        <CardTitle className="line-clamp-2">{event.title}</CardTitle>
        {event.status === 'merged_inactive' && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 text-[11px] uppercase font-semibold w-fit">
            <GitMerge className="w-3 h-3" />
            Inativo · mesclado
            {event.merged_into_id && mergedPrimaryTitles[event.merged_into_id]
              ? ` em "${mergedPrimaryTitles[event.merged_into_id]}"`
              : ''}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            {event.date}
            {event.end_date && event.end_date !== event.date
              ? ` → ${event.end_date}`
              : ''}{' '}
            às {event.time}
            {event.end_date && event.end_date !== event.date && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] uppercase font-semibold">
                festival
              </span>
            )}
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            {event.venue}, {event.location_city} - {event.location_state}
          </div>
          <div className="text-xs text-muted-foreground/70">Slug: {event.slug}</div>
        </div>
        <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(event)}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDuplicate(event)}
            title="Duplicar evento"
          >
            <Copy className="w-4 h-4" />
          </Button>
          {!event.blog_post_id && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onGenerateArticle(event)}
              disabled={generatingArticle === event.id}
              title="Gerar artigo do blog"
              className="bg-primary/10 hover:bg-primary/20 text-primary"
            >
              {generatingArticle === event.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </Button>
          )}
          {event.status === 'merged_inactive' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReactivate(event)}
              disabled={reactivatingId === event.id}
              title="Reativar evento (não altera o principal)"
              className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
            >
              {reactivatingId === event.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Undo2 className="w-4 h-4 mr-1" />
                  Reativar
                </>
              )}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(event.id)}
            title="Deletar evento"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
