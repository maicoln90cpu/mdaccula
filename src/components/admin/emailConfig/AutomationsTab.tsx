/**
 * AutomationsTab — aba "Automações" da tela Admin → E-mail.
 *
 * Onda 11: reduzida de 793 → ~200 linhas ao delegar cada card para
 * <AutomationCard/> (subcomponente genérico) — comportamento 100%
 * preservado, mesmos handlers/estado/UX.
 */
import { ShieldAlert } from 'lucide-react';
import type { Template } from '@/lib/emailTemplates/blocks';
import type { AutomationCfg, AutomationResult } from './types';
import { AutomationCard } from './automations/AutomationCard';

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
  sendingWeekly: boolean;
  digestLastResult: AutomationResult;
  handleSaveWeekly: () => void | Promise<void>;
  generateDigestNow: () => void | Promise<void>;
  onTestWeekly: () => void;
  onSendWeeklyNow: () => void;

  // Weekend agenda
  weekendCfg: AutomationCfg;
  setWeekendCfg: (cfg: AutomationCfg) => void;
  weekendEffectiveTemplateId: string;
  savingWeekend: boolean;
  weekendGenerating: boolean;
  testingWeekend: boolean;
  sendingWeekend: boolean;
  weekendLastResult: AutomationResult;
  handleSaveWeekend: () => void | Promise<void>;
  generateWeekendNow: () => void | Promise<void>;
  onTestWeekend: () => void;
  onSendWeekendNow: () => void;

  // Blog digest
  blogCfg: AutomationCfg;
  setBlogCfg: (cfg: AutomationCfg) => void;
  blogEffectiveTemplateId: string;
  savingBlog: boolean;
  blogGenerating: boolean;
  testingBlog: boolean;
  sendingBlog: boolean;
  blogLastResult: AutomationResult;
  handleSaveBlog: () => void | Promise<void>;
  generateBlogNow: () => void | Promise<void>;
  onTestBlog: () => void;
  onSendBlogNow: () => void;
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
  sendingWeekly,
  digestLastResult,
  handleSaveWeekly,
  generateDigestNow,
  onTestWeekly,
  onSendWeeklyNow,
  weekendCfg,
  setWeekendCfg,
  weekendEffectiveTemplateId,
  savingWeekend,
  weekendGenerating,
  testingWeekend,
  sendingWeekend,
  weekendLastResult,
  handleSaveWeekend,
  generateWeekendNow,
  onTestWeekend,
  onSendWeekendNow,
  blogCfg,
  setBlogCfg,
  blogEffectiveTemplateId,
  savingBlog,
  blogGenerating,
  testingBlog,
  sendingBlog,
  blogLastResult,
  handleSaveBlog,
  generateBlogNow,
  onTestBlog,
  onSendBlogNow,
}: AutomationsTabProps) => {
  const testTitle = `Envia via Resend para ${automationTestRecipient} — não toca a E-goi`;

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
        <AutomationCard
          title="Digest semanal"
          description="Rascunho automático na E-goi com a agenda dos próximos 7 dias + últimas matérias. Você revisa e envia."
          confirmDialogTitle="Enviar Digest semanal para toda a lista?"
          draftCreatedLabel="Rascunho criado."
          renderResultPeriod={(r) => (
            <>
              Período: {r.range} · {r.events_count} evento(s) · {r.posts_count} matéria(s)
            </>
          )}
          templates={templates}
          templateFilter={(t) =>
            t.type === 'weekly_digest' || t.type === 'weekly_digest_editorial'
          }
          effectiveTemplateId={weeklyEffectiveTemplateId}
          cfg={weeklyCfg}
          setCfg={setWeeklyCfg}
          masterEnabled={masterEnabled}
          dayLabels={dayLabels}
          testTitle={testTitle}
          saving={savingWeekly}
          generating={digestGenerating}
          testing={testingWeekly}
          sending={sendingWeekly}
          lastResult={digestLastResult}
          onSave={handleSaveWeekly}
          onGenerate={generateDigestNow}
          onTest={onTestWeekly}
          onSendNow={onSendWeeklyNow}
        />

        {/* Card 2 — Agenda FDS */}
        <AutomationCard
          title="Agenda do FDS"
          description="Rascunho automático com os eventos da próxima sexta, sábado e domingo. Ideal disparar antes do fim de semana."
          confirmDialogTitle="Enviar Agenda do FDS para toda a lista?"
          draftCreatedLabel="Rascunho FDS criado."
          renderResultPeriod={(r) => (
            <>
              Período: {r.range} · {r.events_count} evento(s)
            </>
          )}
          templates={templates}
          templateFilter={(t) => t.type === 'weekend_agenda'}
          effectiveTemplateId={weekendEffectiveTemplateId}
          cfg={weekendCfg}
          setCfg={setWeekendCfg}
          masterEnabled={masterEnabled}
          dayLabels={dayLabels}
          testTitle={testTitle}
          saving={savingWeekend}
          generating={weekendGenerating}
          testing={testingWeekend}
          sending={sendingWeekend}
          lastResult={weekendLastResult}
          onSave={handleSaveWeekend}
          onGenerate={generateWeekendNow}
          onTest={onTestWeekend}
          onSendNow={onSendWeekendNow}
        />

        {/* Card 3 — Blog news */}
        <AutomationCard
          title="Blog news (novidades do blog)"
          description={
            <>
              Rascunho automático apenas com as <b>matérias publicadas</b> na semana (sem eventos).
              Sugerido: domingo à noite.
            </>
          }
          confirmDialogTitle="Enviar Blog news para toda a lista?"
          draftCreatedLabel="Rascunho Blog news criado."
          templatePlaceholder="Selecione um template"
          renderResultPeriod={(r) => (
            <>
              Período: {r.range} · {r.posts_count} matéria(s)
            </>
          )}
          templates={templates}
          templateFilter={(t) => t.type === 'blog_digest'}
          effectiveTemplateId={blogEffectiveTemplateId}
          cfg={blogCfg}
          setCfg={setBlogCfg}
          masterEnabled={masterEnabled}
          dayLabels={dayLabels}
          testTitle={testTitle}
          saving={savingBlog}
          generating={blogGenerating}
          testing={testingBlog}
          sending={sendingBlog}
          lastResult={blogLastResult}
          onSave={handleSaveBlog}
          onGenerate={generateBlogNow}
          onTest={onTestBlog}
          onSendNow={onSendBlogNow}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Fuso fixo BRT (-3). O sistema converte automaticamente para UTC no <code>pg_cron</code>. O
        e-mail <b>não é enviado</b> automaticamente — sempre fica como rascunho na E-goi para
        revisão.
      </p>
    </div>
  );
};
