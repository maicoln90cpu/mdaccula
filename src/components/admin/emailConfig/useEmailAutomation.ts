/**
 * useEmailAutomation — encapsula todo o estado + handlers das 3 automações
 * (Digest semanal, Agenda FDS, Blog news) que antes moravam soltos em
 * `src/pages/admin/EmailConfig.tsx`.
 *
 * Fase C do slim-down (última etapa). Comportamento 100% preservado:
 *  - Mesmos setters expostos (`setWeeklyCfg`, ...) para hidratação inicial
 *    a partir de `site_settings` continuar funcionando dentro de `loadAll`.
 *  - Mesmas edge functions e mesmos toasts.
 *  - Mesma constante `AUTOMATION_TEST_RECIPIENT` e mesmo `DAY_LABELS`.
 *
 * Nada de lógica nova aqui — só relocação para reduzir o tamanho do arquivo
 * pai e tornar a área de automações testável isoladamente.
 */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Template } from "@/lib/emailTemplates/blocks";
import type { AutomationCfg, AutomationResult } from "./types";

export const DAY_LABELS: string[] = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const AUTOMATION_TEST_RECIPIENT = "contato@mdaccula.com";

type ToastFn = (opts: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

type UseEmailAutomationInput = {
  templates: Template[];
  toast: ToastFn;
};

async function upsertSettings(rows: Array<{ key: string; value: string }>) {
  for (const r of rows) {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: r.key, value: r.value }, { onConflict: "key" });
    if (error) throw error;
  }
}

async function saveAutomation(
  job: "weekly_digest" | "weekend_agenda" | "blog_digest",
  cfg: AutomationCfg,
) {
  const prefix = job;
  await upsertSettings([
    { key: `${prefix}_enabled`, value: cfg.enabled ? "true" : "false" },
    { key: `${prefix}_cron_day`, value: String(cfg.day) },
    { key: `${prefix}_cron_hour`, value: String(cfg.hour) },
    { key: `${prefix}_template_id`, value: cfg.templateId || "" },
  ]);
  const { data, error } = await supabase.functions.invoke("update-digest-schedule", {
    body: { job },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error);
  return data;
}

export function useEmailAutomation({ templates, toast }: UseEmailAutomationInput) {
  // Configurações persistidas em site_settings
  const [weeklyCfg, setWeeklyCfg] = useState<AutomationCfg>({
    enabled: false, day: 4, hour: 18, templateId: "",
  });
  const [weekendCfg, setWeekendCfg] = useState<AutomationCfg>({
    enabled: false, day: 4, hour: 12, templateId: "",
  });
  const [blogCfg, setBlogCfg] = useState<AutomationCfg>({
    enabled: false, day: 0, hour: 12, templateId: "",
  });

  // Flags de UI (Salvar / Gerar agora / Enviar teste)
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [savingWeekend, setSavingWeekend] = useState(false);
  const [savingBlog, setSavingBlog] = useState(false);
  const [digestGenerating, setDigestGenerating] = useState(false);
  const [weekendGenerating, setWeekendGenerating] = useState(false);
  const [blogGenerating, setBlogGenerating] = useState(false);
  const [testingWeekly, setTestingWeekly] = useState(false);
  const [testingWeekend, setTestingWeekend] = useState(false);
  const [testingBlog, setTestingBlog] = useState(false);

  // Últimos resultados de geração (exibidos como card verde)
  const [digestLastResult, setDigestLastResult] = useState<AutomationResult>(null);
  const [weekendLastResult, setWeekendLastResult] = useState<AutomationResult>(null);
  const [blogLastResult, setBlogLastResult] = useState<AutomationResult>(null);

  // Template efetivo = escolhido pelo usuário || default do tipo || primeiro do tipo
  const weeklyEffectiveTemplateId = useMemo(
    () => weeklyCfg.templateId
      || templates.find((t) => (t.type === "weekly_digest" || t.type === "weekly_digest_editorial") && t.is_default)?.id
      || templates.find((t) => t.type === "weekly_digest" || t.type === "weekly_digest_editorial")?.id
      || "",
    [weeklyCfg.templateId, templates],
  );
  const weekendEffectiveTemplateId = useMemo(
    () => weekendCfg.templateId
      || templates.find((t) => t.type === "weekend_agenda" && t.is_default)?.id
      || templates.find((t) => t.type === "weekend_agenda")?.id
      || "",
    [weekendCfg.templateId, templates],
  );
  const blogEffectiveTemplateId = useMemo(
    () => blogCfg.templateId
      || templates.find((t) => t.type === "blog_digest" && t.is_default)?.id
      || templates.find((t) => t.type === "blog_digest")?.id
      || "",
    [blogCfg.templateId, templates],
  );

  // ---- Handlers: Salvar agendamento ----
  const handleSaveWeekly = async () => {
    setSavingWeekly(true);
    try {
      await saveAutomation("weekly_digest", { ...weeklyCfg, templateId: weeklyEffectiveTemplateId });
      toast({
        title: weeklyCfg.enabled ? "Digest semanal agendado" : "Digest semanal salvo (desligado)",
        description: weeklyCfg.enabled
          ? `Próxima execução: ${DAY_LABELS[weeklyCfg.day]} ${String(weeklyCfg.hour).padStart(2, "0")}:00 BRT.`
          : "As chaves foram salvas; nenhum cron ativo.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Erro ao salvar", description: msg });
    } finally {
      setSavingWeekly(false);
    }
  };

  const handleSaveWeekend = async () => {
    setSavingWeekend(true);
    try {
      await saveAutomation("weekend_agenda", { ...weekendCfg, templateId: weekendEffectiveTemplateId });
      toast({
        title: weekendCfg.enabled ? "Agenda FDS agendada" : "Agenda FDS salva (desligada)",
        description: weekendCfg.enabled
          ? `Próxima execução: ${DAY_LABELS[weekendCfg.day]} ${String(weekendCfg.hour).padStart(2, "0")}:00 BRT.`
          : "As chaves foram salvas; nenhum cron ativo.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Erro ao salvar", description: msg });
    } finally {
      setSavingWeekend(false);
    }
  };

  const handleSaveBlog = async () => {
    setSavingBlog(true);
    try {
      await saveAutomation("blog_digest", { ...blogCfg, templateId: blogEffectiveTemplateId });
      toast({
        title: blogCfg.enabled ? "Blog news agendado" : "Blog news salvo (desligado)",
        description: blogCfg.enabled
          ? `Próxima execução: ${DAY_LABELS[blogCfg.day]} ${String(blogCfg.hour).padStart(2, "0")}:00 BRT.`
          : "As chaves foram salvas; nenhum cron ativo.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Erro ao salvar", description: msg });
    } finally {
      setSavingBlog(false);
    }
  };

  // ---- Handlers: Gerar rascunho agora ----
  const generateDigestNow = async () => {
    setDigestGenerating(true);
    setDigestLastResult(null);
    try {
      const body: Record<string, unknown> = { force: true };
      if (weeklyEffectiveTemplateId) body.template_id = weeklyEffectiveTemplateId;
      const { data, error } = await supabase.functions.invoke("weekly-digest-draft", { body });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          digest_disabled: "Digest está desligado — ligue o toggle acima primeiro.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
          no_content_in_range: "Nenhum evento ou matéria encontrado no período.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar rascunho");
      setDigestLastResult(res);
      toast({
        title: "Rascunho criado na E-goi",
        description: `${res.events_count ?? 0} evento(s) e ${res.posts_count ?? 0} matéria(s) no digest${res.template_name ? ` · ${res.template_name}` : ""}.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Erro ao gerar digest", description: msg });
    } finally {
      setDigestGenerating(false);
    }
  };

  const generateWeekendNow = async () => {
    setWeekendGenerating(true);
    setWeekendLastResult(null);
    try {
      const body: Record<string, unknown> = { force: true };
      if (weekendEffectiveTemplateId) body.template_id = weekendEffectiveTemplateId;
      const { data, error } = await supabase.functions.invoke("weekend-agenda-draft", { body });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        egoi_campaign_id?: string | null; events_count?: number; posts_count?: number; range?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          agenda_disabled: "Agenda FDS está desligada — ligue o toggle primeiro.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
          no_events_in_range: "Nenhum evento encontrado para este fim de semana.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar rascunho");
      setWeekendLastResult(res);
      toast({
        title: "Rascunho FDS criado na E-goi",
        description: `${res.events_count ?? 0} evento(s) no fim de semana${res.template_name ? ` · ${res.template_name}` : ""}.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Erro ao gerar agenda FDS", description: msg });
    } finally {
      setWeekendGenerating(false);
    }
  };

  const generateBlogNow = async () => {
    setBlogGenerating(true);
    setBlogLastResult(null);
    try {
      const body: Record<string, unknown> = { force: true };
      if (blogEffectiveTemplateId) body.template_id = blogEffectiveTemplateId;
      const { data, error } = await supabase.functions.invoke("blog-digest-draft", { body });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        egoi_campaign_id?: string | null; posts_count?: number; range?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          digest_disabled: "Blog news está desligado — ligue o toggle primeiro.",
          config_disabled_or_incomplete: "Configuração da agência incompleta ou desligada.",
          no_posts_in_range: "Nenhuma matéria publicada no período. Publique posts no blog primeiro.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar rascunho");
      setBlogLastResult(res);
      toast({
        title: "Rascunho Blog news criado na E-goi",
        description: `${res.posts_count ?? 0} matéria(s) no digest${res.template_name ? ` · ${res.template_name}` : ""}.`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Erro ao gerar Blog news", description: msg });
    } finally {
      setBlogGenerating(false);
    }
  };

  // ---- Handler: Enviar teste agora (dry_run + send-test-email) ----
  const sendAutomationTest = async (
    fnName: "weekly-digest-draft" | "weekend-agenda-draft" | "blog-digest-draft",
    label: string,
    setBusy: (v: boolean) => void,
    templateId?: string,
  ) => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { force: true, dry_run: true };
      if (templateId) body.template_id = templateId;
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      const res = data as {
        ok?: boolean; skipped?: boolean; reason?: string; error?: string;
        subject?: string; html?: string; preheader?: string; template_name?: string | null;
      };
      if (res?.skipped) {
        const reasons: Record<string, string> = {
          master_off: "Master switch está OFF.",
          digest_disabled: "Automação desligada — ligue o toggle primeiro.",
          agenda_disabled: "Automação desligada — ligue o toggle primeiro.",
          no_posts_in_range: "Nenhuma matéria publicada no período.",
          no_events_in_range: "Nenhum evento encontrado no período.",
          no_content_in_range: "Nenhum evento ou matéria encontrado no período.",
        };
        toast({ variant: "destructive", title: "Não gerado", description: reasons[res.reason || ""] || res.reason || "Motivo desconhecido" });
        return;
      }
      if (!res?.ok || !res.html || !res.subject) {
        throw new Error(res?.error || "Renderização vazia");
      }
      const { data: sent, error: sendErr } = await supabase.functions.invoke("send-test-email", {
        body: { html: res.html, subject: `[TESTE] ${res.subject}`, to_email: AUTOMATION_TEST_RECIPIENT },
      });
      if (sendErr) throw sendErr;
      const sentTo = (sent as { sent_to?: string } | null)?.sent_to || AUTOMATION_TEST_RECIPIENT;
      toast({
        title: `Teste de ${label} enviado`,
        description: `Enviado para ${sentTo}${res.template_name ? ` · ${res.template_name}` : ""}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: `Erro no teste de ${label}`, description: msg });
    } finally {
      setBusy(false);
    }
  };

  return {
    // configs + setters (setters expostos para o pai hidratar em loadAll)
    weeklyCfg, setWeeklyCfg,
    weekendCfg, setWeekendCfg,
    blogCfg, setBlogCfg,
    // flags
    savingWeekly, savingWeekend, savingBlog,
    digestGenerating, weekendGenerating, blogGenerating,
    testingWeekly, setTestingWeekly,
    testingWeekend, setTestingWeekend,
    testingBlog, setTestingBlog,
    // resultados
    digestLastResult, weekendLastResult, blogLastResult,
    // computed
    weeklyEffectiveTemplateId, weekendEffectiveTemplateId, blogEffectiveTemplateId,
    // handlers
    handleSaveWeekly, handleSaveWeekend, handleSaveBlog,
    generateDigestNow, generateWeekendNow, generateBlogNow,
    sendAutomationTest,
  };
}
