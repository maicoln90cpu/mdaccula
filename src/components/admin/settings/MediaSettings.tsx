import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { runEventImageBackfill, type BackfillResult } from '@/lib/eventImageBackfill';
import type {
  BunnyDiagnosis,
  MigrateFilesResult,
  CleanupResult,
  CheckResult,
  ConvertResult,
  CompressionPreset,
} from './media/types';
import { EconomyDashboardCard } from './media/EconomyDashboardCard';
import { BunnyDiagnosticsCard } from './media/BunnyDiagnosticsCard';
import { ImageOptimizationCard } from './media/ImageOptimizationCard';
import { BackfillVariantsCard } from './media/BackfillVariantsCard';
import { BrandComposeTestCard } from './media/BrandComposeTestCard';

const MediaSettings = () => {
  // Bunny diagnosis
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<BunnyDiagnosis | null>(null);

  // Bunny migration
  const [migratingFiles, setMigratingFiles] = useState(false);
  const [migrateResult, setMigrateResult] = useState<MigrateFilesResult | null>(null);
  const [migrateOffset, setMigrateOffset] = useState(0);
  const [updatingUrls, setUpdatingUrls] = useState(false);
  const [urlResult, setUrlResult] = useState<Record<string, number> | null>(null);

  // Image check
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  // Conversion
  const [converting, setConverting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<CompressionPreset>('media');
  const [conversionResult, setConversionResult] = useState<ConvertResult | null>(null);

  // Cleanup
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  // Backfill de variantes
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [backfillResults, setBackfillResults] = useState<BackfillResult[] | null>(null);

  // Teste manual de marca (compose-event-image)
  const [brandImageUrl, setBrandImageUrl] = useState('');
  const [brandTitle, setBrandTitle] = useState('');
  const [brandTesting, setBrandTesting] = useState(false);
  const [brandResult, setBrandResult] = useState<{ imageUrl: string; composed: boolean } | null>(
    null
  );

  const { toast } = useToast();

  const handleBackfillEventImages = async () => {
    setBackfillRunning(true);
    setBackfillResults(null);
    setBackfillProgress(null);
    try {
      const results = await runEventImageBackfill((done, total) =>
        setBackfillProgress({ done, total })
      );
      setBackfillResults(results);
      const uploaded = results.filter((r) => r.status === 'uploaded').length;
      const skipped = results.filter((r) => r.status === 'skipped').length;
      const errors = results.filter(
        (r) => r.status === 'error' || r.status === 'unsupported'
      ).length;
      toast({
        title: 'Backfill concluído',
        description: `${uploaded} imagem(ns) processada(s), ${skipped} já estavam ok${errors > 0 ? `, ${errors} com problema` : ''}.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro no backfill', description: message });
    } finally {
      setBackfillRunning(false);
    }
  };

  const handleTestBrandCompose = async () => {
    if (!brandImageUrl.trim() || !brandTitle.trim()) {
      toast({
        variant: 'destructive',
        title: 'Preencha os dois campos',
        description: 'URL da imagem e título de teste são obrigatórios.',
      });
      return;
    }
    setBrandTesting(true);
    setBrandResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        imageUrl: string;
        composed: boolean;
      }>('compose-event-image', {
        body: { imageUrl: brandImageUrl.trim(), title: brandTitle.trim() },
      });
      if (error) throw error;
      setBrandResult({ imageUrl: data.imageUrl, composed: data.composed });
      if (data.composed) {
        toast({ title: 'Marca aplicada!', description: 'Barra + logo compostos com sucesso.' });
      } else {
        toast({
          variant: 'destructive',
          title: 'Marca não aplicada',
          description:
            'A composição falhou e a imagem original foi mantida — confira os logs da function pra causa.',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao testar composição', description: message });
    } finally {
      setBrandTesting(false);
    }
  };

  const handleDiagnose = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<BunnyDiagnosis>('migrate-to-bunny', {
        body: { action: 'diagnose' },
      });
      if (error) throw error;
      setDiagResult(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro no diagnóstico', description: message });
    } finally {
      setDiagLoading(false);
    }
  };

  const handleMigrateFiles = async () => {
    setMigratingFiles(true);
    setMigrateResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<MigrateFilesResult>(
        'migrate-to-bunny',
        {
          body: { action: 'migrate_files', batch_size: 20, offset: migrateOffset },
        }
      );
      if (error) throw error;

      if (data.error) {
        setMigrateResult(data);
        toast({
          variant: 'destructive',
          title: 'Erro na migração',
          description: data.credential_hint || data.error,
        });
        return;
      }

      setMigrateResult(data);
      setMigrateOffset(data.nextOffset || 0);
      const hasMore = Object.values(data.results || {}).some((r) => r.hasMore);
      toast({
        title: hasMore ? 'Lote processado' : 'Migração concluída',
        description: `${data.totalMigrated} arquivos migrados.${hasMore ? ' Clique novamente.' : ''}`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro na migração', description: message });
    } finally {
      setMigratingFiles(false);
    }
  };

  const handleUpdateUrls = async () => {
    setUpdatingUrls(true);
    setUrlResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<{ updated: Record<string, number> }>(
        'migrate-to-bunny',
        {
          body: { action: 'update_urls' },
        }
      );
      if (error) throw error;
      setUrlResult(data.updated);
      const total = Object.values(data.updated).reduce((a, b) => a + b, 0);
      toast({ title: 'URLs atualizadas', description: `${total} URLs reescritas.` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao atualizar URLs', description: message });
    } finally {
      setUpdatingUrls(false);
    }
  };

  const handleCleanupSupabase = async () => {
    setCleaningUp(true);
    setCleanupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<CleanupResult>('migrate-to-bunny', {
        body: { action: 'cleanup_supabase' },
      });
      if (error) throw error;
      setCleanupResult(data);
      const total = Object.values(data.results || {}).reduce(
        (a: number, r) => a + (r.deleted || 0),
        0
      );
      toast({
        title: 'Limpeza concluída',
        description: `${total} arquivos removidos do Supabase após verificação no Bunny.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro na limpeza', description: message });
    } finally {
      setCleaningUp(false);
    }
  };

  const handleCheck = async () => {
    setCheckLoading(true);
    setCheckResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<CheckResult>('batch-convert-webp', {
        body: { action: 'check', bucket: 'all' },
      });
      if (error) throw error;
      setCheckResult(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro na análise', description: message });
    } finally {
      setCheckLoading(false);
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    setConversionResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<ConvertResult>('batch-convert-webp', {
        body: { action: 'convert', bucket: 'all', preset: selectedPreset, maxFiles: 2 },
      });
      if (error) throw error;
      setConversionResult(data);
      toast({
        title: 'Conversão concluída',
        description: `${data.summary?.processed} imagens. ${data.summary?.totalSavedMB} MB economizados.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro na conversão', description: message });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <EconomyDashboardCard diagResult={diagResult} />

      <BunnyDiagnosticsCard
        diagLoading={diagLoading}
        diagResult={diagResult}
        onDiagnose={handleDiagnose}
        migratingFiles={migratingFiles}
        migrateResult={migrateResult}
        migrateOffset={migrateOffset}
        onMigrateFiles={handleMigrateFiles}
        onResetOffset={() => setMigrateOffset(0)}
        updatingUrls={updatingUrls}
        urlResult={urlResult}
        onUpdateUrls={handleUpdateUrls}
        cleaningUp={cleaningUp}
        cleanupResult={cleanupResult}
        onCleanupSupabase={handleCleanupSupabase}
      />

      <ImageOptimizationCard
        checkLoading={checkLoading}
        checkResult={checkResult}
        onCheck={handleCheck}
        converting={converting}
        selectedPreset={selectedPreset}
        onSelectPreset={setSelectedPreset}
        conversionResult={conversionResult}
        onConvert={handleConvert}
      />

      <BackfillVariantsCard
        running={backfillRunning}
        progress={backfillProgress}
        results={backfillResults}
        onRun={handleBackfillEventImages}
      />

      <BrandComposeTestCard
        brandImageUrl={brandImageUrl}
        brandTitle={brandTitle}
        brandTesting={brandTesting}
        brandResult={brandResult}
        onBrandImageUrlChange={setBrandImageUrl}
        onBrandTitleChange={setBrandTitle}
        onTest={handleTestBrandCompose}
      />
    </div>
  );
};

export default MediaSettings;
