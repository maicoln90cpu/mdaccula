import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EventFormData } from './constants';

export const DateTimeSection = () => {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<EventFormData>();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Data Inicial *</Label>
          <Input
            id="date"
            type="date"
            {...register('date', { required: 'Data é obrigatória' })}
          />
          {errors.date && (
            <span className="text-sm text-destructive">{errors.date.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date">Data Final (festival) — opcional</Label>
          <Input
            id="end_date"
            type="date"
            {...register('end_date')}
            min={watch('date') || undefined}
          />
          <p className="text-xs text-muted-foreground">
            Preencha apenas se for festival de múltiplos dias (ex.: So Track Boa 05 e 06/06).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="time">Horário de Início (Opcional)</Label>
          <Input id="time" type="time" {...register('time')} />
          <p className="text-xs text-muted-foreground">
            Deixe vazio se a produtora ainda não divulgou o horário
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_time">Horário de Término (Opcional)</Label>
          <Input id="end_time" type="time" {...register('end_time')} />
          <p className="text-xs text-muted-foreground">
            Deixe vazio se o evento não tiver horário definido de término
          </p>
        </div>
      </div>
    </>
  );
};
