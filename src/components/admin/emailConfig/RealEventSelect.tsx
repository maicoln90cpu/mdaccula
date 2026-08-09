/**
 * RealEventSelect — seletor "Simular com evento real", compartilhado entre
 * o Editor + Preview e a aba Template (marca). Com até 500 eventos futuros
 * carregados (useEmailConfigState), navegar sem busca ficava difícil perto
 * de datas cheias — adiciona um campo de busca por nome que filtra as
 * opções antes de renderizar o Select.
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EmailEventRow } from '@/lib/emailTemplates/emailComposer';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

interface RealEventSelectProps {
  value: string;
  onChange: (id: string) => void;
  events: Array<EmailEventRow & { blog_post_id: string | null }>;
  triggerClassName?: string;
}

export function RealEventSelect({
  value,
  onChange,
  events,
  triggerClassName,
}: RealEventSelectProps) {
  const [search, setSearch] = useState('');
  const q = norm(search);
  const filtered = q ? events.filter((e) => norm(e.title).includes(q)) : events;

  return (
    <div className="flex items-center gap-1.5">
      {events.length > 8 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar evento…"
          className="h-8 w-[120px] text-xs"
        />
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={triggerClassName ?? 'w-[280px]'}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mock">— Dados fictícios (mock) —</SelectItem>
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Nenhum evento encontrado para "{search}".
            </div>
          ) : (
            filtered.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.title} · {e.date}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
