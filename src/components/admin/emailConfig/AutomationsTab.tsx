/**
 * AutomationsTab — aba "Automações" da tela Admin → E-mail.
 *
 * Extraído de `src/pages/admin/EmailConfig.tsx` (Fase C do slim-down).
 * Comportamento 100% preservado: mesmos 3 cards (Digest semanal, Agenda FDS,
 * Blog news), mesmos toggles, seletores de dia/horário/template e botões
 * (Salvar agendamento, Gerar rascunho agora, Enviar teste agora).
 *
 * Toda a lógica de fetch/save continua no pai; aqui é só apresentação +
 * delegação via callbacks — não há chamada Supabase neste componente.
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
import { Mail, RefreshCw, Save, Send, ShieldAlert } from 'lucide-react';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { AutomationCfg, AutomationResult } from './types';

interface AutomationsTabProps {
  masterEnabled: boolean;
  templates: Template[];
  dayLabels: string[];
  automationTestRecipient: string;

  // Weekly digest
  weeklyCfg: AutomationCfg;
  setWeeklyCfg: (cfg: AutomationCfg) => void;
  weeklyEffectiveTemplateId: string;
  savingWeekly: boolean;
  digestGenerating: boolean;
  testingWeekly: boolean;
  digestLastResult: AutomationResult;
  handleSaveWeekly: () => void | Promise<void>;
  generateDigestNow: () => void | Promise<void>;
  onTestWeekly: () => void;

  // Weekend agenda
  weekendCfg: AutomationCfg;
  setWeekendCfg: (cfg: AutomationCfg) => void;
  weekendEffectiveTemplateId: string;
  savingWeekend: boolean;
  weekendGenerating: boolean;
  testingWeekend: boolean;
  weekendLastResult: AutomationResult;
  handleSaveWeekend: () => void | Promise<void>;
  generateWeekendNow: () => void | Promise<void>;
  onTestWeekend: () => void;

  // Blog digest
  blogCfg: AutomationCfg;
  setBlogCfg: (cfg: AutomationCfg) => void;
  blogEffectiveTemplateId: string;
  savingBlog: boolean;
  blogGenerating: boolean;
  testingBlog: boolean;
  blogLastResult: AutomationResult;
  handleSaveBlog: () => void | Promise<void>;
  generateBlogNow: () => void | Promise<void>;
  onTestBlog: () => void;
}

export const AutomationsTab = ({
  masterEnabled,
  templates,
  dayLabels,
  automationTestRecipient,
  weeklyCfg,
  setWeeklyCfg,
  weeklyEffectiveTemplateId,
  savingWeekly,
  digestGenerating,
  testingWeekly,
  digestLastResult,
  handleSaveWeekly,
  generateDigestNow,
  onTestWeekly,
  weekendCfg,
  setWeekendCfg,
  weekendEffectiveTemplateId,
  savingWeekend,
  weekendGenerating,
  testingWeekend,
  weekendLastResult,
  handleSaveWeekend,
  generateWeekendNow,
  onTestWeekend,
  blogCfg,
  setBlogCfg,
  blogEffectiveTemplateId,
  savingBlog,
  blogGenerating,
  testingBlog,
  blogLastResult,
  handleSaveBlog,
  generateBlogNow,
  onTestBlog,
}: AutomationsTabProps) => {
  const testTitle = `Envia via Resend para ${automationTestRecipient} — não toca a E-goi`;

  const SendOnCronToggle = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
  }) => (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="text-sm">
        {label}
        <p className="text-xs text-muted-foreground">
          Quando ON, o cron envia direto. Quando OFF, só cria rascunho.
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-4">
      {!masterEnabled && (
        <div className="flex items-start gap-2 text-xs p-3 rounded-lg bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Master switch está OFF — nenhum rascunho será criado. Ligue em "Configuração" antes.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card 1 — Digest semanal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Digest semanal</span>
              <Badge variant={weeklyCfg.enabled ? 'default' : 'secondary'}>
                {weeklyCfg.enabled ? 'ON' : 'OFF'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Rascunho automático na E-goi com a agenda dos próximos 7 dias + últimas matérias. Você
              revisa e envia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="text-sm">Ativar geração automática</div>
              <Switch
                checked={weeklyCfg.enabled}
                onCheckedChange={(v) => setWeeklyCfg({ ...weeklyCfg, enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <Select
                  value={String(weeklyCfg.day)}
                  onValueChange={(v) => setWeeklyCfg({ ...weeklyCfg, day: parseInt(v, 10) })}
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
                  value={String(weeklyCfg.hour)}
                  onValueChange={(v) => setWeeklyCfg({ ...weeklyCfg, hour: parseInt(v, 10) })}
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
                value={weeklyEffectiveTemplateId}
                onValueChange={(v) => setWeeklyCfg({ ...weeklyCfg, templateId: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Sem opção genérica "Padrão": o default aparece com "· padrão" no rótulo. */}
                  {templates
                    .filter(
                      (t) => t.type === 'weekly_digest' || t.type === 'weekly_digest_editorial'
                    )
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
              <Button size="sm" onClick={handleSaveWeekly} disabled={savingWeekly}>
                {savingWeekly ? (
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
                onClick={generateDigestNow}
                disabled={!masterEnabled || digestGenerating}
              >
                {digestGenerating ? (
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
                onClick={onTestWeekly}
                disabled={testingWeekly}
                title={testTitle}
              >
                {testingWeekly ? (
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
            </div>

            {weeklyCfg.enabled && (
              <div className="text-xs text-muted-foreground">
                Próxima execução:{' '}
                <b>
                  {dayLabels[weeklyCfg.day]} {String(weeklyCfg.hour).padStart(2, '0')}:00 BRT
                </b>
                .
              </div>
            )}

            {digestLastResult && (
              <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-md p-3">
                <div>
                  <b>Rascunho criado.</b> Campanha #{digestLastResult.egoi_campaign_id || '—'}
                </div>
                <div>
                  Período: {digestLastResult.range} · {digestLastResult.events_count} evento(s) ·{' '}
                  {digestLastResult.posts_count} matéria(s)
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2 — Agenda FDS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Agenda do FDS</span>
              <Badge variant={weekendCfg.enabled ? 'default' : 'secondary'}>
                {weekendCfg.enabled ? 'ON' : 'OFF'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Rascunho automático com os eventos da próxima sexta, sábado e domingo. Ideal disparar
              antes do fim de semana.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="text-sm">Ativar geração automática</div>
              <Switch
                checked={weekendCfg.enabled}
                onCheckedChange={(v) => setWeekendCfg({ ...weekendCfg, enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <Select
                  value={String(weekendCfg.day)}
                  onValueChange={(v) => setWeekendCfg({ ...weekendCfg, day: parseInt(v, 10) })}
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
                  value={String(weekendCfg.hour)}
                  onValueChange={(v) => setWeekendCfg({ ...weekendCfg, hour: parseInt(v, 10) })}
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
                value={weekendEffectiveTemplateId}
                onValueChange={(v) => setWeekendCfg({ ...weekendCfg, templateId: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Sem opção genérica "Padrão": o default aparece com "· padrão" no rótulo. */}
                  {templates
                    .filter((t) => t.type === 'weekend_agenda')
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
              <Button size="sm" onClick={handleSaveWeekend} disabled={savingWeekend}>
                {savingWeekend ? (
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
                onClick={generateWeekendNow}
                disabled={!masterEnabled || weekendGenerating}
              >
                {weekendGenerating ? (
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
                onClick={onTestWeekend}
                disabled={testingWeekend}
                title={testTitle}
              >
                {testingWeekend ? (
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
            </div>

            {weekendCfg.enabled && (
              <div className="text-xs text-muted-foreground">
                Próxima execução:{' '}
                <b>
                  {dayLabels[weekendCfg.day]} {String(weekendCfg.hour).padStart(2, '0')}:00 BRT
                </b>
                .
              </div>
            )}

            {weekendLastResult && (
              <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-md p-3">
                <div>
                  <b>Rascunho FDS criado.</b> Campanha #{weekendLastResult.egoi_campaign_id || '—'}
                </div>
                <div>
                  Período: {weekendLastResult.range} · {weekendLastResult.events_count} evento(s)
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3 — Blog news */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Blog news (novidades do blog)</span>
              <Badge variant={blogCfg.enabled ? 'default' : 'secondary'}>
                {blogCfg.enabled ? 'ON' : 'OFF'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Rascunho automático apenas com as <b>matérias publicadas</b> na semana (sem eventos).
              Sugerido: domingo à noite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="text-sm">Ativar geração automática</div>
              <Switch
                checked={blogCfg.enabled}
                onCheckedChange={(v) => setBlogCfg({ ...blogCfg, enabled: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dia da semana</Label>
                <Select
                  value={String(blogCfg.day)}
                  onValueChange={(v) => setBlogCfg({ ...blogCfg, day: parseInt(v, 10) })}
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
                  value={String(blogCfg.hour)}
                  onValueChange={(v) => setBlogCfg({ ...blogCfg, hour: parseInt(v, 10) })}
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
                value={blogEffectiveTemplateId}
                onValueChange={(v) => setBlogCfg({ ...blogCfg, templateId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates
                    .filter((t) => t.type === 'blog_digest')
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
              <Button size="sm" onClick={handleSaveBlog} disabled={savingBlog}>
                {savingBlog ? (
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
                onClick={generateBlogNow}
                disabled={!masterEnabled || blogGenerating}
              >
                {blogGenerating ? (
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
                onClick={onTestBlog}
                disabled={testingBlog}
                title={testTitle}
              >
                {testingBlog ? (
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
            </div>

            {blogCfg.enabled && (
              <div className="text-xs text-muted-foreground">
                Próxima execução:{' '}
                <b>
                  {dayLabels[blogCfg.day]} {String(blogCfg.hour).padStart(2, '0')}:00 BRT
                </b>
                .
              </div>
            )}

            {blogLastResult && (
              <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-md p-3">
                <div>
                  <b>Rascunho Blog news criado.</b> Campanha #
                  {blogLastResult.egoi_campaign_id || '—'}
                </div>
                <div>
                  Período: {blogLastResult.range} · {blogLastResult.posts_count} matéria(s)
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Fuso fixo BRT (-3). O sistema converte automaticamente para UTC no <code>pg_cron</code>. O
        e-mail <b>não é enviado</b> automaticamente — sempre fica como rascunho na E-goi para
        revisão.
      </p>
    </div>
  );
};
