import { Badge } from '@/components/ui/badge';
import type { Campaign } from '../types';

export type PeriodFilter = 'next7' | 'next30' | 'future' | 'past30' | 'all';
export type SummaryStatus = 'pending' | 'draft' | 'scheduled' | 'sent' | 'manual' | 'failed';
export type StatusFilter = 'all' | SummaryStatus;

export type EventLite = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  slug: string | null;
  venue: string | null;
  location_city: string | null;
  location_state: string | null;
};

export type EventEntry = {
  event: EventLite;
  campaigns: Campaign[]; // ordenadas created_at desc — [0] é a mais recente
};

export const QUERY_KEY_PREFIX = 'email-events-unified';

export function periodRange(period: PeriodFilter): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (period === 'past30') {
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    return { from: iso(from), to: iso(today) };
  }
  if (period === 'next7') {
    const to = new Date(today);
    to.setDate(to.getDate() + 7);
    return { from: iso(today), to: iso(to) };
  }
  if (period === 'next30') {
    const to = new Date(today);
    to.setDate(to.getDate() + 30);
    return { from: iso(today), to: iso(to) };
  }
  if (period === 'all') {
    const from = new Date(today);
    from.setFullYear(from.getFullYear() - 5);
    const to = new Date(today);
    to.setFullYear(to.getFullYear() + 5);
    return { from: iso(from), to: iso(to) };
  }
  // future = todos os futuros (limite alto)
  const to = new Date(today);
  to.setFullYear(to.getFullYear() + 5);
  return { from: iso(today), to: iso(to) };
}

export function summaryStatusOf(latest: Campaign | undefined): SummaryStatus {
  if (!latest) return 'pending';
  if (latest.mode === 'manual' && latest.status === 'sent') return 'manual';
  if (latest.status === 'sent') return 'sent';
  if (latest.status === 'failed') return 'failed';
  // 'scheduled' era fundido com 'draft' aqui — um evento com agendamento
  // pendente aparecia como "Rascunho na E-goi", escondendo que existe um
  // envio programado que ainda vai disparar (e tornando fácil sobrescrever
  // esse agendamento sem perceber via "Marcar como enviado manualmente").
  if (latest.status === 'scheduled') return 'scheduled';
  if (latest.status === 'draft') return 'draft';
  return 'pending';
}

export function summaryStatusBadge(s: SummaryStatus) {
  switch (s) {
    case 'sent':
      return <Badge className="bg-green-600 hover:bg-green-600">Enviado</Badge>;
    case 'manual':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Enviado manualmente</Badge>;
    case 'scheduled':
      return <Badge className="bg-blue-600 hover:bg-blue-600">Agendado</Badge>;
    case 'draft':
      return <Badge variant="secondary">Rascunho na E-goi</Badge>;
    case 'failed':
      return <Badge variant="destructive">Erro</Badge>;
    default:
      return <Badge variant="outline">Não disparado</Badge>;
  }
}

export function campaignStatusBadge(s: Campaign['status']) {
  const map: Record<Campaign['status'], string> = {
    draft: 'bg-muted text-muted-foreground',
    scheduled: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    sent: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s]}`}>{s}</span>;
}

export function fmtDate(date: string, time: string | null) {
  try {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    const label = dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return time ? `${label} • ${time.slice(0, 5)}` : label;
  } catch {
    return date;
  }
}

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
