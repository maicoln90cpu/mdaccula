/**
 * RunHistoryList — lista colapsável das últimas execuções de uma
 * automação, compartilhada entre AutomationCard e
 * EventReminderAutomationCard. Antes só o último resultado ficava
 * visível; um erro anterior desaparecia assim que a próxima execução
 * rodava.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDateTimeBR } from '@/lib/formatters';
import type { RunHistoryEntry } from '../automationRunHistory';

export function RunHistoryList({ history }: { history: RunHistoryEntry[] }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;

  return (
    <div className="pt-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-[11px] text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="w-3 h-3 mr-1" />
        ) : (
          <ChevronRight className="w-3 h-3 mr-1" />
        )}
        Histórico ({history.length})
      </Button>
      {open && (
        <ul className="mt-1 space-y-1 border-l-2 border-border pl-2">
          {history.map((h, i) => (
            <li key={i} className="text-[11px]">
              <span
                className={h.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
              >
                {h.ok ? '✓' : '✕'}
              </span>{' '}
              <span className="text-muted-foreground">{formatDateTimeBR(h.at)}</span> — {h.summary}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
