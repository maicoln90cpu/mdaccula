/**
 * Card de cada configuração recorrente na lista.
 * Extraído de src/pages/admin/RecurringEventsManager.tsx (Onda 30).
 */
import { Calendar, Clock, Edit2, Link as LinkIcon, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { WEEKDAYS, type RecurringConfig } from './types';

interface RecurringConfigCardProps {
  config: RecurringConfig;
  groupName: string | null;
  onEdit: (config: RecurringConfig) => void;
  onToggle: (config: RecurringConfig) => void;
}

export const RecurringConfigCard = ({
  config,
  groupName,
  onEdit,
  onToggle,
}: RecurringConfigCardProps) => {
  return (
    <Card className={!config.enabled ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{config.name}</CardTitle>
              <Badge variant={config.enabled ? 'default' : 'secondary'}>
                {config.enabled ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <CardDescription className="line-clamp-1">{config.title}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(config)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Switch checked={config.enabled} onCheckedChange={() => onToggle(config)} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{WEEKDAYS[config.weekday]}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{config.time.slice(0, 5)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span>{config.venue}</span>
          </div>
          {config.link_group_id && groupName && (
            <div className="flex items-center gap-1.5">
              <LinkIcon className="w-4 h-4" />
              <span>{groupName}</span>
            </div>
          )}
        </div>
        {config.image_url && (
          <div className="mt-3">
            <img
              src={getOptimizedImageUrl(config.image_url)}
              alt={config.name}
              className="h-16 w-28 object-contain rounded-md"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
