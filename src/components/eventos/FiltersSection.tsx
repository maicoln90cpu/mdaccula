/**
 * Barra de filtros do /eventos — extraído de src/pages/Eventos.tsx (Onda 17).
 */
import { Calendar as CalendarIcon, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseLocalDate } from '@/lib/utils';
import { getThisWeekendDates } from './eventosHelpers';

interface FiltersSectionProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  weekendDates: string[];
  setWeekendDates: (v: string[]) => void;
  genreFilter: string;
  setGenreFilter: (v: string) => void;
  stateFilter: string;
  setStateFilter: (v: string) => void;
  cityFilter: string;
  setCityFilter: (v: string) => void;
  availableGenres: string[];
  availableStates: string[];
  availableCities: string[];
}

export const FiltersSection = ({
  searchTerm,
  setSearchTerm,
  dateFilter,
  setDateFilter,
  weekendDates,
  setWeekendDates,
  genreFilter,
  setGenreFilter,
  stateFilter,
  setStateFilter,
  cityFilter,
  setCityFilter,
  availableGenres,
  availableStates,
  availableCities,
}: FiltersSectionProps) => {
  return (
    <section className="py-8 bg-card/50">
      <div className="container mx-auto px-4">
        <h3 className="text-base sm:text-lg font-semibold mb-4">Filtros</h3>
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Buscar eventos..."
              className="pl-10 h-12 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {dateFilter && (
              <Badge
                variant="secondary"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => setDateFilter('')}
              >
                <CalendarIcon className="w-3 h-3" />
                {parseLocalDate(dateFilter).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                })}
                <X className="w-3 h-3" />
              </Badge>
            )}
          </div>

          <div>
            {weekendDates.length > 0 ? (
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/20 h-9 px-3"
                onClick={() => setWeekendDates([])}
              >
                <CalendarIcon className="w-3 h-3" />
                Este fim de semana
                <X className="w-3 h-3" />
              </Badge>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setWeekendDates(getThisWeekendDates());
                  setDateFilter('');
                }}
              >
                <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                Este fim de semana
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-2">
              <Label className="text-sm">Vertente de som</Label>
              <Select value={genreFilter} onValueChange={setGenreFilter}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Vertente de som" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {availableGenres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                  <SelectItem value="Todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm">Estado</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="Todos">Todos</SelectItem>
                  {availableStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm">Cidade</Label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todas</SelectItem>
                  {availableCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm">&nbsp;</Label>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setDateFilter('');
                  setWeekendDates([]);
                  setGenreFilter('Todos');
                  setStateFilter('Todos');
                  setCityFilter('Todos');
                }}
                className="w-full h-12"
              >
                Limpar Filtros
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm">Filtrar por vertente</Label>
            <div className="flex items-center flex-wrap gap-2">
              {availableGenres.map((genre) => (
                <Badge
                  key={genre}
                  variant={genreFilter === genre ? 'default' : 'outline'}
                  className="cursor-pointer min-h-[36px] px-4 text-sm"
                  onClick={() => setGenreFilter(genreFilter === genre ? 'Todos' : genre)}
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
