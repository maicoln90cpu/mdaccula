/**
 * FiltersBar — barra de filtros UTM + intervalo de datas + ordenação
 * do RedirectsManager. Extraído na Onda 11 sem alterações de comportamento.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Filter, CalendarDays } from 'lucide-react';
import { format, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

type SortBy = 'recent' | 'clicks';

interface FiltersBarProps {
  uniqueSources: string[];
  uniqueMediums: string[];
  uniqueCampaigns: string[];
  filterSource: string;
  filterMedium: string;
  filterCampaign: string;
  dateRange: DateRange | undefined;
  periodLabel: string;
  sortBy: SortBy;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  setFilterSource: (v: string) => void;
  setFilterMedium: (v: string) => void;
  setFilterCampaign: (v: string) => void;
  setDateRange: (r: DateRange | undefined) => void;
  setPeriodLabel: (s: string) => void;
  setSortBy: (s: SortBy) => void;
  handlePeriodShortcut: (label: string, from: Date | null, to: Date | null) => void;
}

export const FiltersBar = ({
  uniqueSources,
  uniqueMediums,
  uniqueCampaigns,
  filterSource,
  filterMedium,
  filterCampaign,
  dateRange,
  periodLabel,
  sortBy,
  hasActiveFilters,
  filteredCount,
  totalCount,
  setFilterSource,
  setFilterMedium,
  setFilterCampaign,
  setDateRange,
  setPeriodLabel,
  setSortBy,
  handlePeriodShortcut,
}: FiltersBarProps) => (
  <Card variant="ghost" className="mb-4">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="utm_source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos sources</SelectItem>
            {uniqueSources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMedium} onValueChange={setFilterMedium}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="utm_medium" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos mediums</SelectItem>
            {uniqueMediums.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="utm_campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas campaigns</SelectItem>
            {uniqueCampaigns.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-8 text-xs justify-start min-w-[160px]',
                !dateRange?.from && 'text-muted-foreground'
              )}
            >
              <CalendarDays className="w-3 h-3 mr-1" />
              {dateRange?.from
                ? dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime()
                  ? `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}`
                  : format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                : periodLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-wrap gap-1 p-2 border-b">
              <Button
                variant={periodLabel === 'Hoje' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  handlePeriodShortcut('Hoje', startOfDay(new Date()), new Date())
                }
              >
                Hoje
              </Button>
              <Button
                variant={periodLabel === '7 dias' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  handlePeriodShortcut(
                    '7 dias',
                    startOfDay(subDays(new Date(), 7)),
                    new Date()
                  )
                }
              >
                7 dias
              </Button>
              <Button
                variant={periodLabel === '30 dias' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  handlePeriodShortcut(
                    '30 dias',
                    startOfDay(subDays(new Date(), 30)),
                    new Date()
                  )
                }
              >
                30 dias
              </Button>
              <Button
                variant={periodLabel === 'Todo período' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => handlePeriodShortcut('Todo período', null, null)}
              >
                Todo período
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                setPeriodLabel('Personalizado');
              }}
              numberOfMonths={1}
              locale={ptBR}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="clicks">Mais clicados</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setFilterSource('__all__');
              setFilterMedium('__all__');
              setFilterCampaign('__all__');
              setDateRange(undefined);
              setPeriodLabel('Todo período');
              setSortBy('recent');
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>
      {hasActiveFilters && (
        <p className="text-xs text-muted-foreground mt-2">
          Mostrando {filteredCount} de {totalCount} links
        </p>
      )}
    </CardContent>
  </Card>
);
