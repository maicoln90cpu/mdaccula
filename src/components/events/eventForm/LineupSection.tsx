import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { parseLocalDateTime, formatEventDateRange } from '@/lib/dateUtils';
import type { EventSchedule } from '@/lib/eventScheduleHelper';

interface LineupSectionProps {
  manualSlug: string;
  setManualSlug: (s: string) => void;
  lineup: string[];
  setLineup: (l: string[]) => void;
  newLineupItem: string;
  setNewLineupItem: (s: string) => void;
  schedule: EventSchedule | null;
  watchedDate?: string;
  watchedEndDate?: string;
  newScheduleArtist: Record<string, string>;
  setNewScheduleArtist: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateScheduleEntry: (date: string, patch: Partial<EventSchedule[number]>) => void;
  addScheduleArtist: (date: string) => void;
  removeScheduleArtist: (date: string, idx: number) => void;
}

export const LineupSection = ({
  manualSlug,
  setManualSlug,
  lineup,
  setLineup,
  newLineupItem,
  setNewLineupItem,
  schedule,
  watchedDate,
  watchedEndDate,
  newScheduleArtist,
  setNewScheduleArtist,
  updateScheduleEntry,
  addScheduleArtist,
  removeScheduleArtist,
}: LineupSectionProps) => {
  const addLineupItem = () => {
    if (newLineupItem.trim()) {
      setLineup([...lineup, newLineupItem.trim()]);
      setNewLineupItem('');
    }
  };
  const removeLineupItem = (index: number) => {
    setLineup(lineup.filter((_, i) => i !== index));
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug (URL personalizada) - Opcional</Label>
        <Input
          id="slug"
          value={manualSlug}
          onChange={(e) => {
            const sanitized = e.target.value
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9-]/g, '-')
              .replace(/-+/g, '-')
              .replace(/(^-|-$)/g, '');
            setManualSlug(sanitized);
          }}
          placeholder="meu-evento-personalizado"
        />
        <p className="text-xs text-muted-foreground">
          Se vazio, será gerado automaticamente do título. Use apenas letras minúsculas, números e
          hífens.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Line-up</Label>
        <div className="flex gap-2">
          <Input
            value={newLineupItem}
            onChange={(e) => setNewLineupItem(e.target.value)}
            placeholder="Nome do artista"
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLineupItem())}
          />
          <Button type="button" onClick={addLineupItem} size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {lineup.map((artist, index) => (
            <div
              key={index}
              className="flex items-center gap-1 bg-secondary px-3 py-1 rounded-full text-sm"
            >
              {artist}
              <button
                type="button"
                onClick={() => removeLineupItem(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        {schedule && schedule.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Esse line-up serve como padrão. Use a "Programação por dia" abaixo para variar por dia.
          </p>
        )}
      </div>

      {schedule && schedule.length > 1 && (
        <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
          <div>
            <Label className="text-base">📅 Programação por dia (festival)</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Festival de {formatEventDateRange(watchedDate, watchedEndDate)}. Defina horário e
              line-up de cada dia. Se um dia ficar sem line-up próprio, usa o line-up principal
              acima.
            </p>
          </div>
          {schedule.map((entry) => (
            <div key={entry.date} className="border rounded-md p-3 bg-background space-y-3">
              <div className="font-semibold text-sm">
                {parseLocalDateTime(entry.date, '00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={entry.time?.slice(0, 5) || ''}
                    onChange={(e) => updateScheduleEntry(entry.date, { time: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Término</Label>
                  <Input
                    type="time"
                    value={entry.end_time?.slice(0, 5) || ''}
                    onChange={(e) =>
                      updateScheduleEntry(entry.date, { end_time: e.target.value || null })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Line-up deste dia</Label>
                <div className="flex gap-2">
                  <Input
                    value={newScheduleArtist[entry.date] || ''}
                    onChange={(e) =>
                      setNewScheduleArtist((s) => ({ ...s, [entry.date]: e.target.value }))
                    }
                    placeholder="Nome do artista"
                    onKeyPress={(e) =>
                      e.key === 'Enter' && (e.preventDefault(), addScheduleArtist(entry.date))
                    }
                  />
                  <Button type="button" size="sm" onClick={() => addScheduleArtist(entry.date)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(entry.lineup || []).map((artist, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-full text-xs"
                    >
                      {artist}
                      <button
                        type="button"
                        onClick={() => removeScheduleArtist(entry.date, idx)}
                        className="ml-0.5 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {(!entry.lineup || entry.lineup.length === 0) && (
                    <span className="text-xs text-muted-foreground italic">
                      Vazio → usa line-up principal
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
