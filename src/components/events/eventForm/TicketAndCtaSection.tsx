import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  EVENT_CTA_TYPES,
  EVENT_CTA_CONFIG,
  DEFAULT_EVENT_CTA_TYPE,
} from '@shared/eventCta.ts';
import { normalizeUrl, type EventFormData } from './constants';

export const TicketAndCtaSection = () => {
  const { register, control, watch, setValue } = useFormContext<EventFormData>();

  const pixEnabled = watch('pix_button_enabled') === true;
  const vipLinkVal = (watch('vip_link') || '').trim();
  const missingVip = pixEnabled && !vipLinkVal;

  const startDate = watch('date');
  const endDate = watch('end_date');
  const isMultiDay = !!endDate && !!startDate && endDate > startDate;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ticket_link">Link Ingresso</Label>
          <Input
            id="ticket_link"
            {...register('ticket_link')}
            placeholder="https://... ou bit.ly/..."
            onBlur={(e) => {
              const normalized = normalizeUrl(e.target.value);
              if (normalized && normalized !== e.target.value) {
                setValue('ticket_link', normalized);
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vip_link">Link Camarote</Label>
          <Controller
            name="vip_link"
            control={control}
            render={({ field }) => (
              <Select
                value={
                  field.value?.includes('5511999136884')
                    ? 'maicoln'
                    : field.value?.includes('5511997819194')
                      ? 'guilherme'
                      : field.value
                        ? 'none'
                        : ''
                }
                onValueChange={(value) => {
                  if (value === 'none' || !value) {
                    field.onChange('');
                  } else if (value === 'maicoln') {
                    const message = `Olá MD, queria ver um camarote para ${watch('title') || 'evento'}`;
                    field.onChange(
                      `https://api.whatsapp.com/send?phone=5511999136884&text=${encodeURIComponent(message)}`
                    );
                  } else if (value === 'guilherme') {
                    const message = `Olá Gui, queria ver um camarote para ${watch('title') || 'evento'}`;
                    field.onChange(
                      `https://api.whatsapp.com/send?phone=5511997819194&text=${encodeURIComponent(message)}`
                    );
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma opção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="maicoln">Maicoln Douglas</SelectItem>
                  <SelectItem value="guilherme">Guilherme Accula</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cta_type">Botão do evento (site e e-mail)</Label>
        <Controller
          name="cta_type"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? DEFAULT_EVENT_CTA_TYPE} onValueChange={field.onChange}>
              <SelectTrigger id="cta_type">
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_CTA_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {EVENT_CTA_CONFIG[type].buttonLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Define o texto do botão principal na Home, em /eventos, na página do evento e nos e-mails
          deste evento (disparo único e resumos semanais).
        </p>
      </div>

      <div
        className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
          missingVip ? 'border-amber-500/60 bg-amber-500/10' : 'border-input bg-muted/30'
        }`}
      >
        <Controller
          name="pix_button_enabled"
          control={control}
          render={({ field }) => (
            <Switch
              id="pix_button_enabled"
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              className="mt-0.5 data-[state=checked]:bg-[#25D366]"
            />
          )}
        />
        <div className="space-y-1">
          <Label htmlFor="pix_button_enabled" className="cursor-pointer">
            Mostrar botão "Comprar Sem Taxa via Pix"
          </Label>
          <p className="text-xs text-muted-foreground">
            Exibe um terceiro botão verde na página do evento que abre o mesmo WhatsApp configurado
            em Link Camarote, com mensagem de Pix sem taxa.
          </p>
          {missingVip && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              ⚠️ O botão NÃO vai aparecer no evento até você preencher um "Link Camarote" acima
              (Maicoln ou Guilherme).
            </p>
          )}
        </div>
      </div>

      {isMultiDay && (
        <div className="flex items-start gap-3 rounded-md border border-input bg-muted/30 p-3">
          <Controller
            name="tickets_per_day"
            control={control}
            render={({ field }) => (
              <Switch
                id="tickets_per_day"
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                className="mt-0.5"
              />
            )}
          />
          <div className="space-y-1">
            <Label htmlFor="tickets_per_day" className="cursor-pointer">
              Um link de venda por dia (festival)
            </Label>
            <p className="text-xs text-muted-foreground">
              Ative quando cada dia do festival tem ingresso vendido separadamente. Na página do
              evento, o botão "Comprar Ingresso" abrirá um modal para a pessoa escolher o dia. Os
              links por dia precisam estar cadastrados em <strong>Links</strong> com o evento
              vinculado e a data de override preenchida.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
