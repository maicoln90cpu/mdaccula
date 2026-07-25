import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageDown, Loader2, Search } from 'lucide-react';
import { PRESET_LABELS, type CheckResult, type CompressionPreset, type ConvertResult } from './types';

interface Props {
  checkLoading: boolean;
  checkResult: CheckResult | null;
  onCheck: () => void;
  converting: boolean;
  selectedPreset: CompressionPreset;
  onSelectPreset: (p: CompressionPreset) => void;
  conversionResult: ConvertResult | null;
  onConvert: () => void;
}

export const ImageOptimizationCard = ({
  checkLoading,
  checkResult,
  onCheck,
  converting,
  selectedPreset,
  onSelectPreset,
  conversionResult,
  onConvert,
}: Props) => {
  return (
    <Card className="border-green-500/20">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <ImageDown className="w-5 h-5 text-green-500" />
          <CardTitle className="text-lg sm:text-xl">Otimização de Imagens</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Analise o acervo de todos os buckets e converta imagens com upload direto para o Bunny
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <Button onClick={onCheck} disabled={checkLoading} variant="outline" className="w-full">
          {checkLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analisando todos os buckets...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Analisar Acervo (todos os buckets)
            </>
          )}
        </Button>

        {checkResult && (
          <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                Total arquivos: <strong>{checkResult.totalFiles}</strong>
              </div>
              <div>
                Imagens: <strong>{checkResult.totalImages}</strong>
              </div>
              <div>
                No Bunny:{' '}
                <strong>{checkResult.bunnyImages >= 0 ? checkResult.bunnyImages : 'N/A'}</strong>
              </div>
              <div>
                Tamanho total: <strong>{checkResult.totalMB} MB</strong>
              </div>
              <div className="col-span-2">
                Média por imagem: <strong>{checkResult.avgMB} MB</strong>
              </div>
            </div>

            {checkResult.bucketDetails && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Por bucket:</p>
                {Object.entries(checkResult.bucketDetails).map(([bucket, info]) => (
                  <div key={bucket} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-muted-foreground">{bucket}:</span>
                    <span>
                      {info.images} imagens · {info.sizeMB} MB
                    </span>
                    <span className="text-muted-foreground">· Bunny: {info.bunnyCount}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs font-medium">Distribuição por tamanho:</p>
              {Object.entries(checkResult.breakdown || {}).map(([key, info]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${key === 'small' ? 'bg-green-500' : key === 'medium' ? 'bg-amber-500' : 'bg-red-500'}`}
                  />
                  <span className="text-muted-foreground">{info.label}:</span>
                  <strong>{info.count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Nível de compressão:</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PRESET_LABELS) as CompressionPreset[]).map((key) => (
              <button
                key={key}
                onClick={() => onSelectPreset(key)}
                className={`p-2 rounded-md border text-xs text-center transition-colors ${
                  selectedPreset === key
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-medium">{PRESET_LABELS[key].label}</div>
                <div className="text-[10px] text-muted-foreground">{PRESET_LABELS[key].desc}</div>
                <div className="text-[9px] text-muted-foreground/70 mt-0.5">
                  {PRESET_LABELS[key].details}
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={onConvert} disabled={converting} variant="outline" className="w-full">
          {converting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Convertendo ({PRESET_LABELS[selectedPreset].label})...
            </>
          ) : (
            <>
              <ImageDown className="w-4 h-4 mr-2" />
              Converter Imagens → Bunny ({PRESET_LABELS[selectedPreset].label})
            </>
          )}
        </Button>

        {conversionResult && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2 text-xs">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              ✅ Conversão concluída!
            </p>
            <p className="text-muted-foreground">
              Preset: {conversionResult.preset?.label} · Buckets:{' '}
              {conversionResult.buckets?.join(', ')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                Convertidas: <strong>{conversionResult.summary?.processed}</strong>
              </div>
              <div>
                Sem ganho: <strong>{conversionResult.summary?.skipped}</strong>
              </div>
              <div>
                Erros: <strong>{conversionResult.summary?.errors}</strong>
              </div>
              <div className="col-span-2">
                Economizado: <strong>{conversionResult.summary?.totalSavedMB} MB</strong>
              </div>
            </div>
            {conversionResult.details?.processed?.length > 0 && (
              <details>
                <summary className="cursor-pointer text-green-600 dark:text-green-400">
                  Ver convertidas
                </summary>
                <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-24 text-[10px]">
                  {conversionResult.details.processed.join('\n')}
                </pre>
              </details>
            )}
            {conversionResult.details?.errors?.length > 0 && (
              <details>
                <summary className="cursor-pointer text-destructive">Ver erros</summary>
                <pre className="mt-1 bg-muted p-2 rounded overflow-auto max-h-24 text-[10px]">
                  {conversionResult.details.errors.join('\n')}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
