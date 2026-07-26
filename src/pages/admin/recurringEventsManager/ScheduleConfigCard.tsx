/**
 * Card de agendamento do cron dos eventos recorrentes.
 * Extraído de src/pages/admin/RecurringEventsManager.tsx (Onda 30).
 */
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WEEKDAYS } from './types';

interface ScheduleConfigCardProps {
  cronWeekday: string;
  setCronWeekday: (v: string) => void;
  cronHour: string;
  setCronHour: (v: string) => void;
  savingSchedule: boolean;
  onSave: () => void;
}

export const ScheduleConfigCard = ({
  cronWeekday,
  setCronWeekday,
  cronHour,
  setCronHour,
  savingSchedule,
  onSave,
}: ScheduleConfigCardProps) => {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Agendamento do Cron Job
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          O cron roda diariamente. A função só cria eventos no dia e horário configurados abaixo
          (BRT).
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Dia da Semana</Label>
            <Select value={cronWeekday} onValueChange={setCronWeekday}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Horário (BRT)</Label>
            <Select value={cronHour} onValueChange={setCronHour}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {String(i).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onSave} disabled={savingSchedule} size="sm">
            {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Salvar Agendamento
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Atual:{' '}
          <strong>
            {WEEKDAYS[parseInt(cronWeekday)]} às {cronHour.padStart(2, '0')}:00 (BRT)
          </strong>
          . Os eventos habilitados abaixo serão criados automaticamente neste horário.
        </p>
      </CardContent>
    </Card>
  );
};
