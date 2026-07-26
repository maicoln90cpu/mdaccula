import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import type { PeriodFilter, StatusFilter, SummaryStatus } from './helpers';

interface HeaderFiltersProps {
  counts: Record<SummaryStatus, number>;
  search: string;
  setSearch: (v: string) => void;
  period: PeriodFilter;
  setPeriod: (v: PeriodFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  onRefresh: () => void;
  isFetching: boolean;
}

export function HeaderFilters({
  counts,
  search,
  setSearch,
  period,
  setPeriod,
  statusFilter,
  setStatusFilter,
  onRefresh,
  isFetching,
}: HeaderFiltersProps) {
  return (
    <CardHeader className="flex-row items-start justify-between gap-4 flex-wrap">
      <div>
        <CardTitle>Histórico e controle de e-mails</CardTitle>
        <CardDescription>
          Acompanhe quais eventos já receberam disparo, marque manualmente e revise o histórico
          completo de cada um.
        </CardDescription>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className="cursor-pointer"
          >
            <Badge variant="outline">{counts.pending} não disparados</Badge>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className="cursor-pointer"
          >
            <Badge variant="secondary">{counts.draft} rascunhos</Badge>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('sent')}
            className="cursor-pointer"
          >
            <Badge className="bg-green-600 hover:bg-green-600">{counts.sent} enviados</Badge>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('manual')}
            className="cursor-pointer"
          >
            <Badge className="bg-emerald-600 hover:bg-emerald-600">{counts.manual} manuais</Badge>
          </button>
          {counts.failed > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className="cursor-pointer"
            >
              <Badge variant="destructive">{counts.failed} com erro</Badge>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Buscar (nome, cidade)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[200px]"
        />
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="next7">Próximos 7 dias</SelectItem>
            <SelectItem value="next30">Próximos 30 dias</SelectItem>
            <SelectItem value="future">Todos os futuros</SelectItem>
            <SelectItem value="past30">Últimos 30 dias</SelectItem>
            <SelectItem value="all">Todos (±5 anos)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Não disparados</SelectItem>
            <SelectItem value="draft">Rascunho na E-goi</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="manual">Enviados manualmente</SelectItem>
            <SelectItem value="failed">Com erro</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    </CardHeader>
  );
}
