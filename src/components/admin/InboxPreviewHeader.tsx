/**
 * Header estilo "caixa de entrada" exibido acima do iframe de preview do e-mail.
 *
 * Motivo: antes o admin só via o corpo do e-mail — assunto/preheader ficavam
 * às cegas até enviar teste. Agora mostramos como o assinante vê no Gmail/Outlook,
 * com placeholders resolvidos a partir dos dados do preview.
 *
 * Aceita DUAS notações para o mesmo placeholder — as duas convivem em templates
 * existentes no banco:
 *   {{event_title}}  === {{event.title}}
 *   {{date_label}}   === {{event.date_label}}
 *   {{venue_name}}   === {{event.venue}}
 *   {{city_state}}   === {{event.city_state}}
 * Além disso reconhecemos {{time_label}}, {{weekend_range}}, {{week_range}}.
 */
import { Mail } from "lucide-react";
import { resolvePlaceholders } from "./inboxPreviewPlaceholders";

export type InboxPreviewData = {
  eventTitle?: string;
  dateLabel?: string;
  timeLabel?: string;
  venueName?: string;
  cityState?: string;
  /** Ex.: "28-29 jun". Usado em Agenda FDS. */
  weekendRange?: string;
  /** Ex.: "24-30 jun". Usado em Digest semanal. */
  weekRange?: string;
  /** Faixa genérica usada por funções de digest/agenda. */
  rangeLabel?: string;
  /** Quantidade de eventos renderizados no digest/agenda. */
  eventsCount?: string | number;
};

type Props = {
  subjectTemplate?: string | null;
  preheaderTemplate?: string | null;
  data?: InboxPreviewData;
  senderName?: string;
  senderInitials?: string;
  /** Assunto explícito (usa este direto, ignora subjectTemplate). Útil para digest/weekend. */
  overrideSubject?: string | null;
  /** Preheader explícito (usa este direto, ignora preheaderTemplate). Útil para digest/weekend. */
  overridePreheader?: string | null;
};

/**
 * Mapa canônico placeholder → valor.
 * Cada chave lista TODAS as variações aceitas (ponto e underline).
 */
const PLACEHOLDER_ALIASES: Array<{ keys: string[]; get: (d: InboxPreviewData) => string | undefined }> = [
  { keys: ["event_title", "event.title"], get: (d) => d.eventTitle },
  { keys: ["date_label", "event.date_label"], get: (d) => d.dateLabel },
  { keys: ["time_label", "event.time_label"], get: (d) => d.timeLabel },
  { keys: ["venue_name", "event.venue", "event.venue_name"], get: (d) => d.venueName },
  { keys: ["city_state", "event.city_state"], get: (d) => d.cityState },
  { keys: ["weekend_range"], get: (d) => d.weekendRange },
  { keys: ["week_range"], get: (d) => d.weekRange },
  { keys: ["range_label"], get: (d) => d.rangeLabel },
  { keys: ["events_count"], get: (d) => d.eventsCount == null ? undefined : String(d.eventsCount) },
];

/** Regex que casa qualquer `{{ nome }}` (com ou sem espaços, com ponto ou underline). */
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Retorna true se o texto ainda contém um placeholder que NÃO está na lista canônica. */
function hasUnknownPlaceholder(text: string): boolean {
  const matches = [...text.matchAll(PLACEHOLDER_RE)];
  return matches.some((m) => !PLACEHOLDER_ALIASES.some((e) => e.keys.includes(m[1])));
}

export function InboxPreviewHeader({
  subjectTemplate,
  preheaderTemplate,
  data,
  senderName = "MDAccula",
  senderInitials = "MD",
  overrideSubject,
  overridePreheader,
}: Props) {
  const subject = overrideSubject ?? resolvePlaceholders(subjectTemplate, data);
  const preheader = overridePreheader ?? resolvePlaceholders(preheaderTemplate, data);
  const rawCombined = `${subjectTemplate ?? ""} ${preheaderTemplate ?? ""}`;

  return (
    <div className="mb-2 rounded-md border border-border bg-background/60 backdrop-blur-sm">
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Avatar da marca */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold ring-1 ring-primary/30"
          aria-hidden
        >
          {senderInitials}
        </div>

        <div className="min-w-0 flex-1">
          {/* Linha 1: remetente + timestamp fake */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground truncate">
                {senderName}
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                &lt;noreply@mdaccula.com&gt;
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">agora</span>
          </div>

          {/* Linha 2: assunto (negrito) + preheader (cinza), estilo Gmail */}
          <div className="mt-1 text-sm leading-snug">
            {subject ? (
              <span className="font-semibold text-foreground">{subject}</span>
            ) : (
              <span className="italic text-muted-foreground">(sem assunto configurado)</span>
            )}
            {preheader && (
              <>
                <span className="mx-1.5 text-muted-foreground">—</span>
                <span className="text-muted-foreground">{preheader}</span>
              </>
            )}
          </div>

          {/* Warning só quando há placeholder que a lista canônica NÃO reconhece. */}
          {hasUnknownPlaceholder(rawCombined) && (
            <div className="mt-1 text-[10px] text-amber-500/80">
              ⚠ Placeholder não reconhecido — clique em "Ver placeholders" para a lista completa.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
