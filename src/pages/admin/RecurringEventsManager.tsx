import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { WEEKDAYS, type LinkGroup, type RecurringConfig } from './recurringEventsManager/types';
import { ScheduleConfigCard } from './recurringEventsManager/ScheduleConfigCard';
import { RecurringConfigCard } from './recurringEventsManager/RecurringConfigCard';
import { EditConfigDialog } from './recurringEventsManager/EditConfigDialog';

const RecurringEventsManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<RecurringConfig[]>([]);
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [editingConfig, setEditingConfig] = useState<RecurringConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [cronWeekday, setCronWeekday] = useState('2');
  const [cronHour, setCronHour] = useState('3');
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const [configsRes, groupsRes, settingsRes] = await Promise.all([
        supabase.from('recurring_event_configs').select('*').order('weekday'),
        supabase.from('link_groups').select('id, name, enabled').order('display_order'),
        supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['recurring_cron_weekday', 'recurring_cron_hour']),
      ]);

      if (configsRes.error) throw configsRes.error;
      if (groupsRes.error) throw groupsRes.error;

      setConfigs((configsRes.data as RecurringConfig[]) || []);
      setLinkGroups((groupsRes.data as LinkGroup[]) || []);

      settingsRes.data?.forEach((s) => {
        if (s.key === 'recurring_cron_weekday') setCronWeekday(s.value || '2');
        if (s.key === 'recurring_cron_hour') setCronHour(s.value || '3');
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao carregar configurações',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useRealtimeTable('recurring_event_configs', () => fetchConfigs());

  const handleToggleEnabled = async (config: RecurringConfig) => {
    try {
      const { error } = await supabase
        .from('recurring_event_configs')
        .update({ enabled: !config.enabled })
        .eq('id', config.id);

      if (error) throw error;

      setConfigs((prev) =>
        prev.map((c) => (c.id === config.id ? { ...c, enabled: !c.enabled } : c))
      );

      toast({
        title: config.enabled ? 'Desativado' : 'Ativado',
        description: `${config.name} foi ${config.enabled ? 'desativado' : 'ativado'}`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  const handleExecuteNow = async () => {
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        created: number;
        results?: { linkCreated?: boolean }[];
      }>('create-recurring-events', {
        body: { force: true },
      });

      if (error) throw error;

      const linksCreated = data?.results?.filter((r) => r.linkCreated)?.length || 0;

      toast({
        title: 'Execução concluída',
        description: `${data.created} evento(s) criado(s)${linksCreated > 0 ? `, ${linksCreated} link(s) criado(s)` : ''}`,
      });

      fetchConfigs();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro na execução', description: message, variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const updates = [
        { key: 'recurring_cron_weekday', value: cronWeekday },
        { key: 'recurring_cron_hour', value: cronHour },
      ];
      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });
        if (error) throw error;
      }
      toast({
        title: 'Agendamento salvo',
        description: `Eventos recorrentes serão criados toda ${WEEKDAYS[parseInt(cronWeekday)]} às ${cronHour.padStart(2, '0')}:00 (BRT)`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao salvar agendamento',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingConfig) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('recurring_event_configs')
        .update({
          title: editingConfig.title,
          subtitle: editingConfig.subtitle,
          description: editingConfig.description,
          address: editingConfig.address,
          time: editingConfig.time,
          end_time: editingConfig.end_time,
          ticket_link: editingConfig.ticket_link,
          vip_link: editingConfig.vip_link,
          image_url: editingConfig.image_url,
          link_group_id: editingConfig.link_group_id,
        })
        .eq('id', editingConfig.id);

      if (error) throw error;

      setConfigs((prev) => prev.map((c) => (c.id === editingConfig.id ? editingConfig : c)));

      toast({ title: 'Salvo', description: `${editingConfig.name} atualizado com sucesso` });

      setEditingConfig(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ title: 'Erro ao salvar', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getGroupName = (groupId: string | null) => {
    if (!groupId) return null;
    return linkGroups.find((g) => g.id === groupId)?.name || null;
  };

  return (
    <>
      <div className="w-full">
        <main className="w-full px-4 md:px-6 py-6">
          <div className="w-full">
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Eventos Recorrentes</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">Eventos Recorrentes</h1>
                  <p className="text-sm text-muted-foreground">
                    Configurações de eventos criados automaticamente toda terça-feira
                  </p>
                </div>
              </div>
              <Button onClick={handleExecuteNow} disabled={executing}>
                {executing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Executar Agora
              </Button>
            </div>

            <ScheduleConfigCard
              cronWeekday={cronWeekday}
              setCronWeekday={setCronWeekday}
              cronHour={cronHour}
              setCronHour={setCronHour}
              savingSchedule={savingSchedule}
              onSave={handleSaveSchedule}
            />

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {configs.map((config) => (
                  <RecurringConfigCard
                    key={config.id}
                    config={config}
                    groupName={getGroupName(config.link_group_id)}
                    onEdit={setEditingConfig}
                    onToggle={handleToggleEnabled}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
        <EditConfigDialog
          editingConfig={editingConfig}
          setEditingConfig={setEditingConfig}
          linkGroups={linkGroups}
          saving={saving}
          onSave={handleSaveEdit}
        />
      </div>
    </>
  );
};

export default RecurringEventsManager;
