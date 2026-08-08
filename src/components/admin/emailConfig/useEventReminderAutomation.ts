/**
 * useEventReminderAutomation — automação "Lembrete de evento" (item 5 da
 * melhoria de disparo de e-mail): envia automaticamente o e-mail de cada
 * evento ativo e não-recorrente X dias antes da data, via
 * send-event-reminder-campaigns (cron horário — ver migration do cron).
 *
 * Hook separado de `useEmailAutomation.ts` (Digest/Agenda FDS/Blog news) de
 * propósito: essa automação não segue o padrão "dia da semana → 1
 * campanha" — é "N dias antes de cada evento" e pode gerar várias
 * campanhas por execução (uma por evento elegível na data-alvo), então tem
 * sua própria config/UI/resultado.
 */
import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getEdgeFunctionErrorMessage } from '@/lib';
import type { Template } from '@/lib/emailTemplates/blocks';

export type EventReminderCfg = {
  enabled: boolean;
  daysBefore: number;
  hour: number;
  templateId: string;
  sendOnCron: boolean;
};

export type EventReminderResult = {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  target_date?: string;
  days_before?: number;
  candidates?: number;
  processed?: number;
  sent?: number;
  drafted?: number;
  failed?: number;
} | null;

type ToastFn = (opts: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

async function upsertSettings(rows: Array<{ key: string; value: string }>) {
  for (const r of rows) {
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: r.key, value: r.value }, { onConflict: 'key' });
    if (error) throw error;
  }
}

export function useEventReminderAutomation({
  templates,
  toast,
}: {
  templates: Template[];
  toast: ToastFn;
}) {
  const [cfg, setCfg] = useState<EventReminderCfg>({
    enabled: false,
    daysBefore: 3,
    hour: 10,
    templateId: '',
    sendOnCron: false,
  });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<EventReminderResult>(null);

  const effectiveTemplateId = useMemo(
    () =>
      cfg.templateId ||
      templates.find((t) => t.type === 'event_reminder' && t.is_default)?.id ||
      templates.find((t) => t.type === 'event_reminder')?.id ||
      '',
    [cfg.templateId, templates]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertSettings([
        { key: 'event_reminder_enabled', value: cfg.enabled ? 'true' : 'false' },
        { key: 'event_reminder_days_before', value: String(cfg.daysBefore) },
        { key: 'event_reminder_hour', value: String(cfg.hour) },
        { key: 'event_reminder_template_id', value: effectiveTemplateId || '' },
        { key: 'event_reminder_send_on_cron', value: cfg.sendOnCron ? 'true' : 'false' },
      ]);
      toast({
        title: cfg.enabled ? 'Lembrete de evento agendado' : 'Lembrete de evento salvo (desligado)',
        description: cfg.enabled
          ? `Roda todo dia, dispara às ${String(cfg.hour).padStart(2, '0')}:00 BRT, ${cfg.daysBefore} dia(s) antes de cada evento.`
          : 'As chaves foram salvas; nenhum envio automático ativo.',
      });
    } catch (e: unknown) {
      const msg = await getEdgeFunctionErrorMessage(e);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: msg });
    } finally {
      setSaving(false);
    }
  };

  // "Rodar agora" chama a mesma edge function do cron com force=true —
  // pula o gate de horário e de enabled, mas continua respeitando o
  // toggle "Enviar automaticamente no cron" e todos os outros guards
  // (master switch, config da E-goi). Não existe um "enviar teste" próprio
  // aqui porque a automação pode gerar N campanhas por execução (uma por
  // evento elegível), diferente do fluxo de 1 campanha das outras 3.
  const runNow = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-event-reminder-campaigns', {
        body: { force: true },
      });
      if (error) throw error;
      const res = data as EventReminderResult;
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: 'Master switch está OFF.',
          config_disabled_or_incomplete: 'Configuração da agência incompleta ou desligada.',
          no_events_on_target_date: 'Nenhum evento cai exatamente na data-alvo.',
          all_already_processed: 'Todos os eventos elegíveis já foram processados.',
        };
        toast({
          title: 'Nada pra processar',
          description: reasons[res.reason || ''] || res.reason || 'Motivo desconhecido',
        });
        setLastResult(res);
        return;
      }
      if (!res?.ok) throw new Error(res?.error || 'Falha ao rodar a automação');
      setLastResult(res);
      toast({
        title: 'Lembrete de evento processado',
        description: `${res.candidates ?? 0} evento(s) na data-alvo (${res.target_date}) · ${res.sent ?? 0} enviado(s) · ${res.drafted ?? 0} rascunho(s) · ${res.failed ?? 0} falha(s).`,
      });
    } catch (e: unknown) {
      const msg = await getEdgeFunctionErrorMessage(e);
      toast({ variant: 'destructive', title: 'Erro ao rodar automação', description: msg });
    } finally {
      setRunning(false);
    }
  };

  return {
    cfg,
    setCfg,
    saving,
    running,
    lastResult,
    setLastResult,
    effectiveTemplateId,
    handleSave,
    runNow,
  };
}
