import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Clock } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

const EventVisibilitySettings = () => {
  const [eventHoursAfterStart, setEventHoursAfterStart] = useState(12);
  const [eventHoursWithoutTime, setEventHoursWithoutTime] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['event_hours_after_start', 'event_hours_without_time']);

      if (error) throw error;

      data?.forEach((setting) => {
        if (setting.key === 'event_hours_after_start') {
          setEventHoursAfterStart(parseInt(setting.value || '12'));
        } else if (setting.key === 'event_hours_without_time') {
          setEventHoursWithoutTime(parseInt(setting.value || '24'));
        }
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar configurações',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'event_hours_after_start', value: eventHoursAfterStart.toString() },
        { key: 'event_hours_without_time', value: eventHoursWithoutTime.toString() },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });

        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas',
        description: 'As regras de visibilidade de eventos foram atualizadas.',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-lg sm:text-xl">Regras de Visibilidade</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Quando um evento passa a ficar inativo e some do site. O timezone global fica em
          Configurações → Geral.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-4 sm:px-6">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Horas até inativar (com horário definido)</Label>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={1}
              max={72}
              value={eventHoursAfterStart}
              onChange={(e) => setEventHoursAfterStart(parseInt(e.target.value) || 12)}
              className="w-24 h-12"
            />
            <span className="text-sm text-muted-foreground">horas após o início</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Quanto tempo após o horário de início o evento continua ativo (1-72h, padrão 12h).
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Horas até inativar (sem horário definido)</Label>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={1}
              max={72}
              value={eventHoursWithoutTime}
              onChange={(e) => setEventHoursWithoutTime(parseInt(e.target.value) || 24)}
              className="w-24 h-12"
            />
            <span className="text-sm text-muted-foreground">horas após 00:00 do dia</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Quando não houver horário definido, conta a partir da meia-noite do dia do evento
            (1-72h, padrão 24h).
          </p>
        </div>

        <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
          <p className="text-sm font-medium">Como funciona a regra de visibilidade:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              Evento usa apenas <strong>data</strong> e <strong>horário de início</strong>
            </li>
            <li>
              Com horário: visível até <strong>início + horas configuradas</strong>
            </li>
            <li>
              Sem horário: visível até <strong>meia-noite do dia + horas configuradas</strong>
            </li>
            <li>
              Comparação respeita o <strong>timezone</strong> configurado em Configurações → Geral
            </li>
          </ul>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Regras de Visibilidade'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EventVisibilitySettings;
