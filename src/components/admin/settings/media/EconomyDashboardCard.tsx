import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import type { BunnyDiagnosis } from './types';

interface Props {
  diagResult: BunnyDiagnosis | null;
}

export const EconomyDashboardCard = ({ diagResult }: Props) => {
  const credOk = diagResult?.bunny_config?.auth_ok;
  if (!diagResult || (!credOk && !diagResult.bunny_bucket_sizes)) return null;

  const supabaseTotalMB = diagResult.supabase_bucket_sizes
    ? Object.values(diagResult.supabase_bucket_sizes).reduce(
        (sum, b) => sum + parseFloat(b.sizeMB || '0'),
        0
      )
    : 0;
  const bunnyTotalMB = diagResult.bunny_bucket_sizes
    ? Object.values(diagResult.bunny_bucket_sizes).reduce(
        (sum, b) => sum + parseFloat(b.sizeMB || '0'),
        0
      )
    : 0;
  const bunnyTotalFiles = diagResult.bunny_bucket_sizes
    ? Object.values(diagResult.bunny_bucket_sizes).reduce((sum, b) => sum + (b.count || 0), 0)
    : 0;

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader className="px-4 sm:px-6 pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          <CardTitle className="text-lg sm:text-xl">Dashboard de Economia</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-background border text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {bunnyTotalFiles as number}
            </div>
            <div className="text-[10px] text-muted-foreground">Imagens no Bunny</div>
          </div>
          <div className="p-3 rounded-lg bg-background border text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {(bunnyTotalMB as number).toFixed(1)} MB
            </div>
            <div className="text-[10px] text-muted-foreground">Armazenado no Bunny</div>
          </div>
          <div className="p-3 rounded-lg bg-background border text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {(supabaseTotalMB as number).toFixed(1)} MB
            </div>
            <div className="text-[10px] text-muted-foreground">Restante no Supabase</div>
          </div>
          <div className="p-3 rounded-lg bg-background border text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ~${(((bunnyTotalMB as number) * 0.01) / 1024).toFixed(3)}
            </div>
            <div className="text-[10px] text-muted-foreground">Custo Bunny/mês (est.)</div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Economia vs Supabase egress: ~${(((bunnyTotalMB as number) / 1024) * 0.09).toFixed(2)}
          /GB servido vs ~${(((bunnyTotalMB as number) / 1024) * 0.01).toFixed(3)}/GB no Bunny
        </p>
      </CardContent>
    </Card>
  );
};
