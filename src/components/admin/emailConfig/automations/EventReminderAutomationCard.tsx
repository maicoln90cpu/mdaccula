/**
 * EventReminderAutomationCard — card da automação "Lembrete de evento"
 * (item 5 da melhoria de disparo de e-mail): dispara automaticamente o
 * e-mail de cada evento ativo e não-recorrente X dias antes da data.
 *
 * Layout deliberadamente separado de <AutomationCard/> (usado pelas outras
 * 3 automações): aqui não há "1 evento alvo" nem "dia da semana" — é uma
 * regra que pode gerar várias campanhas por execução (uma por evento
 * elegível na data-alvo), então os botões e o resultado são diferentes.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PlayCircle, RefreshCw, Save } from 'lucide-react';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { EventReminderCfg, EventReminderResult } from '../useEventReminderAutomation';
import { SendOnCronToggle } from './SendOnCronToggle';

export interface EventReminderAutomationCardProps {
  masterEnabled: boolean;
  templates: Template[];
  effectiveTemplateId: string;
  cfg: EventReminderCfg;
  setCfg: (cfg: EventReminderCfg) => void;
  saving: boolean;
  running: boolean;
  lastResult: EventReminderResult;
  onSave: () => void | Promise<void>;
  onRunNow: () => void | Promise<void>;
}

export const EventReminderAutomationCard = ({
  masterEnabled,
  templates,
  effectiveTemplateId,
  cfg,
  setCfg,
  saving,
  running,
  lastResult,
  onSave,
  onRunNow,
}: EventReminderAutomationCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Lembrete de evento</span>
          <Badge variant={cfg.enabled ? 'default' : 'secondary'}>{cfg.enabled ? 'ON' : 'OFF'}</Badge>
        </CardTitle>
        <CardDescription>
          Envia automaticamente o e-mail de cada evento (exceto recorrentes) alguns dias antes da
          data. Roda de hora em hora e só age no horário configurado abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="text-sm">Ativar lembrete automático</div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>

        <SendOnCronToggle
          checked={!!cfg.sendOnCron}
          onChange={(v) => setCfg({ ...cfg, sendOnCron: v })}
          label="Enviar automaticamente no cron"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Dias antes do evento</Label>
            <Select
              value={String(cfg.daysBefore)}
              onValueChange={(v) => setCfg({ ...cfg, daysBefore: parseInt(v, 10) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} dia{n > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Horário (BRT)</Label>
            <Select
              value={String(cfg.hour)}
              onValueChange={(v) => setCfg({ ...cfg, hour: parseInt(v, 10) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Template</Label>
          <Select value={effectiveTemplateId} onValueChange={(v) => setCfg({ ...cfg, templateId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {templates
                .filter((t) => t.type === 'event_reminder')
                .map((t) => (
                  <SelectItem key={t.id} value={t.id!}>
                    {t.name}
                    {t.is_default ? ' · padrão' : ''}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar agendamento
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onRunNow}
            disabled={!masterEnabled || running}
            title="Roda a automação agora mesmo, usando a configuração atual (respeita o toggle de envio automático)"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Rodando…
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Rodar agora
              </>
            )}
          </Button>
        </div>

        {cfg.enabled && (
          <div className="text-xs text-muted-foreground">
            Roda todo dia, checa às <b>{String(cfg.hour).padStart(2, '0')}:00 BRT</b>, para eventos
            que caem <b>{cfg.daysBefore} dia{cfg.daysBefore > 1 ? 's' : ''}</b> à frente.
          </div>
        )}

        {lastResult && (
          <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-md p-3">
            <div>
              <b>Última execução</b> — data-alvo {lastResult.target_date || '—'}
            </div>
            <div>
              {lastResult.candidates ?? 0} evento(s) elegível(is) · {lastResult.sent ?? 0} enviado(s)
              · {lastResult.drafted ?? 0} rascunho(s) · {lastResult.failed ?? 0} falha(s)
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
