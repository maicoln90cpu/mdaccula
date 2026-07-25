/**
 * AutomationCard — card genérico usado pelos 3 cards da aba "Automações"
 * (Digest semanal, Agenda FDS, Blog news).
 *
 * Comportamento 100% preservado do arquivo original AutomationsTab.tsx —
 * apenas parametriza os pontos que variam entre cards (título, descrição,
 * filtro de templates, textos de dialog/resultado, e como formatar a linha
 * de "período").
 */
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
import { Mail, RefreshCw, Save, Send, SendHorizonal } from 'lucide-react';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { AutomationCfg, AutomationResult } from '../types';
import { SendOnCronToggle } from './SendOnCronToggle';

export interface AutomationCardProps {
  // Identidade visual
  title: string;
  description: React.ReactNode;
  confirmDialogTitle: string;
  draftCreatedLabel: string;
  templatePlaceholder?: string;
  renderResultPeriod: (r: NonNullable<AutomationResult>) => React.ReactNode;

  // Templates
  templates: Template[];
  templateFilter: (t: Template) => boolean;
  effectiveTemplateId: string;

  // Config + setter
  cfg: AutomationCfg;
  setCfg: (cfg: AutomationCfg) => void;

  // Meta
  masterEnabled: boolean;
  dayLabels: string[];
  testTitle: string;

  // Estados de loading
  saving: boolean;
  generating: boolean;
  testing: boolean;
  sending: boolean;
  lastResult: AutomationResult;

  // Handlers
  onSave: () => void | Promise<void>;
  onGenerate: () => void | Promise<void>;
  onTest: () => void;
  onSendNow: () => void;
}

export const AutomationCard = ({
  title,
  description,
  confirmDialogTitle,
  draftCreatedLabel,
  templatePlaceholder,
  renderResultPeriod,
  templates,
  templateFilter,
  effectiveTemplateId,
  cfg,
  setCfg,
  masterEnabled,
  dayLabels,
  testTitle,
  saving,
  generating,
  testing,
  sending,
  lastResult,
  onSave,
  onGenerate,
  onTest,
  onSendNow,
}: AutomationCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant={cfg.enabled ? 'default' : 'secondary'}>{cfg.enabled ? 'ON' : 'OFF'}</Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="text-sm">Ativar geração automática</div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
          />
        </div>

        <SendOnCronToggle
          checked={!!cfg.sendOnCron}
          onChange={(v) => setCfg({ ...cfg, sendOnCron: v })}
          label="Enviar automaticamente no cron"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Dia da semana</Label>
            <Select
              value={String(cfg.day)}
              onValueChange={(v) => setCfg({ ...cfg, day: parseInt(v, 10) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dayLabels.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {d}
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
          <Label className="text-xs">Template padrão</Label>
          <Select
            value={effectiveTemplateId}
            onValueChange={(v) => setCfg({ ...cfg, templateId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder={templatePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {/* Sem opção genérica "Padrão": o default aparece com "· padrão" no rótulo. */}
              {templates.filter(templateFilter).map((t) => (
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
            onClick={onGenerate}
            disabled={!masterEnabled || generating}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Gerar rascunho agora
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onTest}
            disabled={testing}
            title={testTitle}
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar teste agora
              </>
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                disabled={!lastResult?.egoi_campaign_id || sending}
                title={
                  lastResult?.egoi_campaign_id
                    ? 'Envia de verdade para toda a lista configurada na E-goi'
                    : 'Gere o rascunho primeiro'
                }
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <SendHorizonal className="w-4 h-4 mr-2" />
                    Enviar agora
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmDialogTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso dispara de verdade a campanha #{lastResult?.egoi_campaign_id} na E-goi para
                  todos os contatos da lista configurada. Não é possível desfazer depois de enviado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onSendNow}>Enviar agora</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {cfg.enabled && (
          <div className="text-xs text-muted-foreground">
            Próxima execução:{' '}
            <b>
              {dayLabels[cfg.day]} {String(cfg.hour).padStart(2, '0')}:00 BRT
            </b>
            .
          </div>
        )}

        {lastResult && (
          <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-md p-3">
            <div>
              <b>{draftCreatedLabel}</b> Campanha #{lastResult.egoi_campaign_id || '—'}
            </div>
            <div>{renderResultPeriod(lastResult)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
