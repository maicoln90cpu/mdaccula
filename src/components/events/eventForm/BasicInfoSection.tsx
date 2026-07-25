import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { STATES, type EventFormData } from './constants';

export const BasicInfoSection = () => {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<EventFormData>();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Nome do Evento *</Label>
          <Input
            id="title"
            {...register('title', { required: 'Nome é obrigatório' })}
            placeholder="Nome do evento"
          />
          {errors.title && (
            <span className="text-sm text-destructive">{errors.title.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="venue">Local *</Label>
          <Input
            id="venue"
            {...register('venue', { required: 'Local é obrigatório' })}
            placeholder="Nome do local"
          />
          {errors.venue && (
            <span className="text-sm text-destructive">{errors.venue.message}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço Completo</Label>
        <Input id="address" {...register('address')} placeholder="Rua, número - Bairro" />
        <p className="text-xs text-muted-foreground">
          Endereço aparecerá apenas na página de detalhes do evento
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtítulo (Opcional)</Label>
        <Input
          id="subtitle"
          {...register('subtitle')}
          placeholder="Ex: Ingresso antecipado com 30% OFF"
        />
        <p className="text-xs text-muted-foreground">
          Texto chamativo que aparecerá no card do evento
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location_state">Estado *</Label>
          <Controller
            name="location_state"
            control={control}
            defaultValue="SP"
            rules={{ required: 'Estado é obrigatório' }}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.location_state && (
            <span className="text-sm text-destructive">{errors.location_state.message}</span>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="location_city">Cidade *</Label>
          <Input
            id="location_city"
            {...register('location_city', { required: 'Cidade é obrigatória' })}
            placeholder="Nome da cidade"
          />
          {errors.location_city && (
            <span className="text-sm text-destructive">{errors.location_city.message}</span>
          )}
        </div>
      </div>
    </>
  );
};
