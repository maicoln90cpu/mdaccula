import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Bell, RefreshCw } from 'lucide-react';
import { EgressAlertsCard } from '@/components/admin/EgressAlertsCard';
import { formatDateTimeBR } from '@/lib/formatters';
import { BunnyTab } from './egressMonitor/BunnyTab';
import { SupabaseTab } from './egressMonitor/SupabaseTab';
import { HistoryTab } from './egressMonitor/HistoryTab';
import { InternalTab } from './egressMonitor/InternalTab';
import type {
  BunnyResp,
  EgressRow,
  Period,
  SnapshotRow,
  SupabaseUsageResp,
} from './egressMonitor/types';

const EgressMonitor = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('lifetime');

  const [internalRows, setInternalRows] = useState<EgressRow[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);

  const [sbData, setSbData] = useState<SupabaseUsageResp | null>(null);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbError, setSbError] = useState<string | null>(null);

  const [bunny, setBunny] = useState<BunnyResp | null>(null);
  const [bunnyLoading, setBunnyLoading] = useState(false);
  const [bunnyError, setBunnyError] = useState<string | null>(null);

  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);

  const isLifetime = period === 'lifetime';
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;

  const fetchInternal = useCallback(async () => {
    setInternalLoading(true);
    let q = supabase
      .from('egress_metrics')
      .select('*')
      .order('period_start', { ascending: true })
      .limit(5000);
    if (!isLifetime) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      q = q.gte('period_start', since.toISOString());
    }
    const { data: rows } = await q;
    setInternalRows((rows as EgressRow[]) || []);
    setInternalLoading(false);
  }, [days, isLifetime]);

  const fetchSupabase = useCallback(async () => {
    setSbLoading(true);
    setSbError(null);
    const interval = isLifetime ? 'lifetime' : `${days}day`;
    const { data, error } = await supabase.functions.invoke('supabase-usage', {
      body: { interval },
    });
    if (error) {
      setSbError(error.message || 'Falha ao consultar');
    } else if ((data as { error?: string })?.error) {
      setSbError((data as { error: string }).error);
    } else setSbData(data as SupabaseUsageResp);
    setSbLoading(false);
  }, [days, isLifetime]);

  const fetchBunny = useCallback(async () => {
    setBunnyLoading(true);
    setBunnyError(null);
    const body = isLifetime ? { mode: 'lifetime' } : { mode: 'range', days };
    const { data, error } = await supabase.functions.invoke('bunny-stats', { body });
    if (error) setBunnyError(error.message || 'Falha ao consultar Bunny');
    else if ((data as { error?: string })?.error) setBunnyError((data as { error: string }).error);
    else setBunny(data as BunnyResp);
    setBunnyLoading(false);
  }, [days, isLifetime]);

  const fetchSnapshots = useCallback(async () => {
    setSnapLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('metrics_snapshots')
      .select('*')
      .order('day', { ascending: true })
      .limit(365);
    setSnapshots((data as SnapshotRow[]) || []);
    setSnapLoading(false);
  }, []);

  const captureNow = useCallback(async () => {
    setCapturing(true);
    setCaptureMsg(null);
    const { data, error } = await supabase.functions.invoke('metrics-snapshot', { body: {} });
    if (error) setCaptureMsg('Erro: ' + error.message);
    else if ((data as { error?: string })?.error)
      setCaptureMsg('Erro: ' + (data as { error: string }).error);
    else {
      setCaptureMsg('Snapshot capturado: ' + (data as { day: string }).day);
      await fetchSnapshots();
    }
    setCapturing(false);
  }, [fetchSnapshots]);

  useEffect(() => {
    fetchInternal();
    fetchSupabase();
    fetchBunny();
    fetchSnapshots();
  }, [fetchInternal, fetchSupabase, fetchBunny, fetchSnapshots]);

  return (
    <div className="w-full">
      <main className="w-full px-4 md:px-6 py-6">
        <div className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold hero-text">Métricas Reais</h1>
                <p className="text-muted-foreground text-sm">Supabase + Bunny CDN consolidados</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <TabsList>
                  <TabsTrigger value="7d">7 dias</TabsTrigger>
                  <TabsTrigger value="30d">30 dias</TabsTrigger>
                  <TabsTrigger value="90d">90 dias</TabsTrigger>
                  <TabsTrigger value="lifetime">Lifetime</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  fetchInternal();
                  fetchSupabase();
                  fetchBunny();
                  fetchSnapshots();
                }}
              >
                <RefreshCw
                  className={`h-4 w-4 ${internalLoading || sbLoading || bunnyLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="bunny" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="bunny">Bunny CDN (oficial)</TabsTrigger>
              <TabsTrigger value="supabase">Supabase (oficial)</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="internal">Estimativa Interna (SW)</TabsTrigger>
              <TabsTrigger value="alerts">
                <Bell className="h-3.5 w-3.5 mr-1" />
                Alertas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bunny">
              <BunnyTab
                bunny={bunny}
                bunnyLoading={bunnyLoading}
                bunnyError={bunnyError}
                isLifetime={isLifetime}
                days={days}
              />
            </TabsContent>

            <TabsContent value="supabase">
              <SupabaseTab sbData={sbData} sbLoading={sbLoading} sbError={sbError} />
            </TabsContent>

            <TabsContent value="history">
              <HistoryTab
                snapshots={snapshots}
                snapLoading={snapLoading}
                capturing={capturing}
                captureMsg={captureMsg}
                onCapture={captureNow}
              />
            </TabsContent>

            <TabsContent value="internal">
              <InternalTab internalRows={internalRows} days={days} />
            </TabsContent>

            <TabsContent value="alerts" className="space-y-6">
              <EgressAlertsCard />
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Bunny atualizado: {bunny ? formatDateTimeBR(bunny.fetchedAt) : '—'} · Supabase
            atualizado: {sbData ? formatDateTimeBR(sbData.fetchedAt) : '—'}
          </p>
        </div>
      </main>
    </div>
  );
};

export default EgressMonitor;
