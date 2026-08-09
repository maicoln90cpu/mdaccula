import { useState } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, Send, LayoutGrid, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

import { useEmailGlobalBlocks } from '@/hooks/useEmailGlobalBlocks';

import { EmailDashboard } from '@/components/admin/EmailDashboard';
import { EmailEventsTab } from '@/components/admin/emailConfig/EmailEventsTab';
import { AutomationsTab } from '@/components/admin/emailConfig/AutomationsTab';
import { ConfigTab } from '@/components/admin/emailConfig/ConfigTab';
import { ManualSendTab } from '@/components/admin/emailConfig/ManualSendTab';
import { TemplateBrandTab } from '@/components/admin/emailConfig/TemplateBrandTab';
import { TemplateEditorTab } from '@/components/admin/emailConfig/TemplateEditorTab';
import {
  useEmailAutomation,
  DAY_LABELS,
  AUTOMATION_TEST_RECIPIENT,
} from '@/components/admin/emailConfig/useEmailAutomation';
import { useEmailConfigState } from '@/components/admin/emailConfig/useEmailConfigState';
import { useEventReminderAutomation } from '@/components/admin/emailConfig/useEventReminderAutomation';
import { useEmailPreview } from '@/components/admin/emailConfig/useEmailPreview';
import { useManualBatch } from '@/components/admin/emailConfig/useManualBatch';

import { formatCount } from '@/lib/formatters';
import type { Template } from '@/lib/emailTemplates/blocks';

const EmailConfig = () => {
  const { toast } = useToast();
  const { globalsMap } = useEmailGlobalBlocks();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const handleTabChange = (nextTab: string) => {
    if (
      activeTab === 'editor' &&
      nextTab !== 'editor' &&
      editorDirty &&
      !confirm(
        'Há alterações não salvas no editor de e-mail. Trocar de aba mesmo assim? As alterações serão perdidas.'
      )
    ) {
      return;
    }
    setActiveTab(nextTab);
  };
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [historyFocus, setHistoryFocus] = useState<{ eventTitle: string; token: number } | null>(
    null
  );
  const handleViewInHistory = (eventTitle: string) => {
    setHistoryFocus((prev) => ({ eventTitle, token: (prev?.token ?? 0) + 1 }));
    handleTabChange('eventos');
  };

  // Automações — estado + handlers encapsulados no hook `useEmailAutomation` (Fase C).
  const {
    weeklyCfg,
    setWeeklyCfg,
    weekendCfg,
    setWeekendCfg,
    blogCfg,
    setBlogCfg,
    hydrateWeeklyCfg,
    hydrateWeekendCfg,
    hydrateBlogCfg,
    isWeeklyDirty,
    isWeekendDirty,
    isBlogDirty,
    savingWeekly,
    savingWeekend,
    savingBlog,
    digestGenerating,
    weekendGenerating,
    blogGenerating,
    testingWeekly,
    setTestingWeekly,
    testingWeekend,
    setTestingWeekend,
    testingBlog,
    setTestingBlog,
    sendingWeekly,
    setSendingWeekly,
    sendingWeekend,
    setSendingWeekend,
    sendingBlog,
    setSendingBlog,
    digestLastResult,
    weekendLastResult,
    blogLastResult,
    setDigestLastResult,
    setWeekendLastResult,
    setBlogLastResult,
    weeklyEffectiveTemplateId,
    weekendEffectiveTemplateId,
    blogEffectiveTemplateId,
    handleSaveWeekly,
    handleSaveWeekend,
    handleSaveBlog,
    generateDigestNow,
    generateWeekendNow,
    generateBlogNow,
    sendAutomationTest,
    sendAutomationNow,
  } = useEmailAutomation({ templates, toast });

  // Lembrete de evento (item 5) — hook próprio, ver comentário no arquivo.
  const {
    cfg: eventReminderCfg,
    setCfg: setEventReminderCfg,
    hydrateCfg: hydrateEventReminderCfg,
    isDirty: isEventReminderDirty,
    saving: savingEventReminder,
    running: runningEventReminder,
    lastResult: eventReminderLastResult,
    effectiveTemplateId: eventReminderEffectiveTemplateId,
    handleSave: handleSaveEventReminder,
    runNow: runEventReminderNow,
  } = useEventReminderAutomation({ templates, toast });

  // Camada de dados (loadAll, CRUD egoi_config, upload logo, listas/segmentos)
  // extraída para `useEmailConfigState` na Onda 9 PR-A.
  const {
    loading,
    saving,
    masterEnabled,
    cfg,
    setCfg,
    lists,
    senders,
    segments,
    listTotal,
    lastSyncedAt,
    fetchingResources,
    fetchingSegments,
    tpl,
    setTpl,
    tplSaving,
    uploadingLogo,
    realEvents,
    canEnableAuto,
    reachEstimate,
    globalSegmentLabel,
    loadAll,
    reloadTemplates,
    fetchEgoiResources,
    save,
    toggleMaster,
    saveTemplate,
    uploadLogo,
  } = useEmailConfigState({
    toast,
    templates,
    setTemplates,
    setActiveTemplateId,
    automation: {
      // Hidratação inicial usa hydrate* (não o setter de edição ao vivo) —
      // assim o valor carregado do banco também vira o baseline "salvo" e
      // não acende o aviso de alterações não salvas assim que a página abre.
      setWeeklyCfg: hydrateWeeklyCfg,
      setWeekendCfg: hydrateWeekendCfg,
      setBlogCfg: hydrateBlogCfg,
      setDigestLastResult,
      setWeekendLastResult,
      setBlogLastResult,
      setEventReminderCfg: hydrateEventReminderCfg,
    },
  });

  // Preview (Onda 9 PR-B) — encapsula previewData, digest preview, sendTestEmail
  // e a lógica de aplicação de evento real ao preview.
  const {
    previewData,
    setPreviewData,
    selectedRealEventId,
    setSelectedRealEventId,
    previewArticle,
    activeTemplate,
    previewSource,
    eventPreviewComposition,
    eventPreviewMeta,
    previewHtml,
    digestPreviewHtml,
    digestPreviewMeta,
    digestPreviewLoading,
    loadDigestPreview,
    sendingTest,
    sendTestEmail,
  } = useEmailPreview({
    templates,
    activeTemplateId,
    tpl,
    globalsMap,
    realEvents,
    toast,
  });

  // Envio manual / Virada de lote (Onda 9 PR-B) — encapsula todo o estado do
  // batch + composição + dispatch/schedule + upload de arte.
  const {
    batchEventId,
    setBatchEventId,
    batchEventIds,
    setBatchEventIds,
    batchTemplateId,
    setBatchTemplateId,
    batchArtworkUrl,
    setBatchArtworkUrl,
    batchSubject,
    setBatchSubject,
    batchSegmentId,
    setBatchSegmentId,
    batchScheduleAt,
    setBatchScheduleAt,
    batchUploadingArt,
    batchDispatching,
    batchScheduling,
    manualTemplates,
    selectedManualTemplate,
    selectedManualEvents,
    isMultiEventTemplate,
    manualComposition,
    manualIssuePartition,
    uploadBatchArtwork,
    dispatchBatch,
    scheduleBatch,
  } = useManualBatch({
    templates,
    realEvents,
    tpl,
    globalsMap,
    toast,
    loadAll,
  });

  return (
    <main className="w-full px-4 md:px-6 py-6 space-y-6">
      <div>
        <NavLink
          to="/admin"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </NavLink>
        <h1 className="text-2xl md:text-3xl font-bold">Gestão de E-mails</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o disparo de e-mails via E-goi quando um evento novo é publicado.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
            Atualizando dados…
          </div>
        )}
        <TabsList>
          <TabsTrigger value="dashboard">
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="template">Template (marca)</TabsTrigger>
          <TabsTrigger value="editor">
            <LayoutGrid className="w-3.5 h-3.5 mr-1" />
            Editor + Preview
          </TabsTrigger>
          <TabsTrigger value="batch">
            <Send className="w-3.5 h-3.5 mr-1" />
            Envio manual
          </TabsTrigger>
          <TabsTrigger value="digest">Automações</TabsTrigger>
          <TabsTrigger value="eventos">Histórico e controle</TabsTrigger>
        </TabsList>

        {/* ================= DASHBOARD ================= */}
        <TabsContent value="dashboard" className="space-y-6">
          <EmailDashboard onViewInHistory={handleViewInHistory} />
        </TabsContent>

        {/* ================= CONFIGURAÇÃO ================= */}
        <TabsContent value="config" className="space-y-6">
          <ConfigTab
            masterEnabled={masterEnabled}
            toggleMaster={toggleMaster}
            cfg={cfg}
            setCfg={setCfg}
            canEnableAuto={canEnableAuto}
            lists={lists}
            senders={senders}
            segments={segments}
            templates={templates}
            listTotal={listTotal}
            reachEstimate={reachEstimate}
            fetchingResources={fetchingResources}
            fetchingSegments={fetchingSegments}
            lastSyncedAt={lastSyncedAt}
            fetchEgoiResources={fetchEgoiResources}
            saving={saving}
            save={save}
            formatCount={formatCount}
            onNavigateToTab={handleTabChange}
          />
        </TabsContent>

        {/* ================= TEMPLATE (marca) ================= */}
        <TabsContent value="template" className="space-y-6">
          <TemplateBrandTab
            tpl={tpl}
            setTpl={setTpl}
            tplSaving={tplSaving}
            uploadingLogo={uploadingLogo}
            uploadLogo={uploadLogo}
            saveTemplate={saveTemplate}
            activeTemplate={activeTemplate}
            previewSource={previewSource}
            previewData={previewData}
            previewHtml={previewHtml}
            digestPreviewHtml={digestPreviewHtml}
            digestPreviewMeta={digestPreviewMeta}
            selectedRealEventId={selectedRealEventId}
            setSelectedRealEventId={setSelectedRealEventId}
            realEvents={realEvents}
          />
        </TabsContent>

        {/* ================= EDITOR + PREVIEW (unificado) ================= */}
        <TabsContent value="editor" className="space-y-4">
          <TemplateEditorTab
            previewSource={previewSource}
            digestPreviewLoading={digestPreviewLoading}
            digestPreviewHtml={digestPreviewHtml}
            digestPreviewMeta={digestPreviewMeta}
            loadDigestPreview={loadDigestPreview}
            selectedRealEventId={selectedRealEventId}
            setSelectedRealEventId={setSelectedRealEventId}
            realEvents={realEvents}
            setPreviewData={setPreviewData}
            previewHtml={previewHtml}
            eventPreviewComposition={eventPreviewComposition}
            eventPreviewMeta={eventPreviewMeta}
            sendingTest={sendingTest}
            editorDirty={editorDirty}
            sendTestEmail={sendTestEmail}
            toast={toast}
            templates={templates}
            activeTemplateId={activeTemplateId}
            setActiveTemplateId={setActiveTemplateId}
            reloadTemplates={reloadTemplates}
            tpl={tpl}
            previewData={previewData}
            previewArticle={previewArticle}
            setEditorDirty={setEditorDirty}
          />
        </TabsContent>

        {/* ================= B.8 — VIRADA DE LOTE ================= */}
        <TabsContent value="batch" className="space-y-4">
          <ManualSendTab
            masterEnabled={masterEnabled}
            batchEventId={batchEventId}
            batchEventIds={batchEventIds}
            batchTemplateId={batchTemplateId}
            batchArtworkUrl={batchArtworkUrl}
            batchSubject={batchSubject}
            batchSegmentId={batchSegmentId}
            batchScheduleAt={batchScheduleAt}
            batchDispatching={batchDispatching}
            batchScheduling={batchScheduling}
            batchUploadingArt={batchUploadingArt}
            sendingTest={sendingTest}
            isMultiEventTemplate={isMultiEventTemplate}
            selectedManualTemplate={selectedManualTemplate}
            selectedManualEvents={selectedManualEvents}
            manualComposition={manualComposition}
            manualIssuePartition={manualIssuePartition}
            cfgListId={cfg.list_id}
            segments={segments}
            listTotal={listTotal}
            globalSegmentLabel={globalSegmentLabel}
            fetchingSegments={fetchingSegments}
            realEvents={realEvents}
            manualTemplates={manualTemplates}
            setBatchEventId={setBatchEventId}
            setBatchEventIds={setBatchEventIds}
            setBatchTemplateId={setBatchTemplateId}
            setBatchArtworkUrl={setBatchArtworkUrl}
            setBatchSubject={setBatchSubject}
            setBatchSegmentId={setBatchSegmentId}
            setBatchScheduleAt={setBatchScheduleAt}
            uploadBatchArtwork={uploadBatchArtwork}
            dispatchBatch={dispatchBatch}
            scheduleBatch={scheduleBatch}
            sendTestEmail={sendTestEmail}
          />
        </TabsContent>

        {/* ================= B.11 — DIGEST SEMANAL ================= */}
        <TabsContent value="digest" className="space-y-4">
          <AutomationsTab
            masterEnabled={masterEnabled}
            templates={templates}
            dayLabels={DAY_LABELS}
            automationTestRecipient={AUTOMATION_TEST_RECIPIENT}
            weeklyCfg={weeklyCfg}
            setWeeklyCfg={setWeeklyCfg}
            isWeeklyDirty={isWeeklyDirty}
            weeklyEffectiveTemplateId={weeklyEffectiveTemplateId}
            savingWeekly={savingWeekly}
            digestGenerating={digestGenerating}
            testingWeekly={testingWeekly}
            sendingWeekly={sendingWeekly}
            digestLastResult={digestLastResult}
            handleSaveWeekly={handleSaveWeekly}
            generateDigestNow={generateDigestNow}
            onTestWeekly={() =>
              sendAutomationTest(
                'weekly-digest-draft',
                'Digest semanal',
                setTestingWeekly,
                weeklyEffectiveTemplateId
              )
            }
            onSendWeeklyNow={() =>
              sendAutomationNow(
                'weekly_digest',
                digestLastResult?.egoi_campaign_id,
                'Digest semanal',
                setSendingWeekly
              )
            }
            weekendCfg={weekendCfg}
            setWeekendCfg={setWeekendCfg}
            isWeekendDirty={isWeekendDirty}
            weekendEffectiveTemplateId={weekendEffectiveTemplateId}
            savingWeekend={savingWeekend}
            weekendGenerating={weekendGenerating}
            testingWeekend={testingWeekend}
            sendingWeekend={sendingWeekend}
            weekendLastResult={weekendLastResult}
            handleSaveWeekend={handleSaveWeekend}
            generateWeekendNow={generateWeekendNow}
            onTestWeekend={() =>
              sendAutomationTest(
                'weekend-agenda-draft',
                'Agenda FDS',
                setTestingWeekend,
                weekendEffectiveTemplateId
              )
            }
            onSendWeekendNow={() =>
              sendAutomationNow(
                'weekend_agenda',
                weekendLastResult?.egoi_campaign_id,
                'Agenda FDS',
                setSendingWeekend
              )
            }
            blogCfg={blogCfg}
            setBlogCfg={setBlogCfg}
            isBlogDirty={isBlogDirty}
            blogEffectiveTemplateId={blogEffectiveTemplateId}
            savingBlog={savingBlog}
            blogGenerating={blogGenerating}
            testingBlog={testingBlog}
            sendingBlog={sendingBlog}
            blogLastResult={blogLastResult}
            handleSaveBlog={handleSaveBlog}
            generateBlogNow={generateBlogNow}
            onTestBlog={() =>
              sendAutomationTest(
                'blog-digest-draft',
                'Blog news',
                setTestingBlog,
                blogEffectiveTemplateId
              )
            }
            onSendBlogNow={() =>
              sendAutomationNow(
                'blog_digest',
                blogLastResult?.egoi_campaign_id,
                'Blog news',
                setSendingBlog
              )
            }
            eventReminderCfg={eventReminderCfg}
            setEventReminderCfg={setEventReminderCfg}
            isEventReminderDirty={isEventReminderDirty}
            eventReminderEffectiveTemplateId={eventReminderEffectiveTemplateId}
            savingEventReminder={savingEventReminder}
            runningEventReminder={runningEventReminder}
            eventReminderLastResult={eventReminderLastResult}
            handleSaveEventReminder={handleSaveEventReminder}
            runEventReminderNow={runEventReminderNow}
          />
        </TabsContent>

        {/* ================= HISTÓRICO E CONTROLE (unificado) ================= */}
        <TabsContent value="eventos" className="space-y-4">
          <EmailEventsTab
            templates={templates}
            masterEnabled={masterEnabled}
            prepareManualSend={(eventId) => {
              setBatchEventId(eventId);
              setActiveTab('batch');
            }}
            focusRequest={historyFocus}
          />
        </TabsContent>
      </Tabs>
    </main>
  );
};

// Envolve a página com o Provider único de blocos globais para evitar
// caches divergentes entre o editor e a biblioteca (bug do preview "indisponível").
import { EmailGlobalBlocksProvider } from '@/contexts/EmailGlobalBlocksContext';
const EmailConfigWithProviders = () => (
  <EmailGlobalBlocksProvider>
    <EmailConfig />
  </EmailGlobalBlocksProvider>
);

export default EmailConfigWithProviders;
