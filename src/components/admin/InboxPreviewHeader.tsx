/**
 * Header estilo "caixa de entrada" exibido acima do iframe de preview do e-mail.
 *
 * Motivo: antes o admin só via o corpo do e-mail — assunto/preheader ficavam
 * às cegas até enviar teste. Agora mostramos como o assinante vê no Gmail/Outlook,
 * com placeholders resolvidos a partir dos dados do preview.
 */
import { Mail } from "lucide-react";

export type InboxPreviewData = {
  eventTitle?: string;
  dateLabel?: string;
  timeLabel?: string;
  venueName?: string;
  cityState?: string;
};

type Props = {
  subjectTemplate?: string | null;
  preheaderTemplate?: string | null;
  data?: InboxPreviewData;
  senderName?: string;
  senderInitials?: string;
  /** Assunto explícito (usa este direto, ignora subjectTemplate). Útil para digest/weekend. */
  overrideSubject?: string | null;
};

/**
 * Substitui placeholders {{campo}} pelos valores em `data`.
 * Placeholders desconhecidos ficam literais para facilitar o debug.
 */
export function resolvePlaceholders(
  template: string | null | undefined,
  data: InboxPreviewData | undefined,
): string {
  if (!template) return "";
  if (!data) return template;
  return template
    .replace(/\{\{\s*event_title\s*\}\}/g, data.eventTitle ?? "")
    .replace(/\{\{\s*date_label\s*\}\}/g, data.dateLabel ?? "")
    .replace(/\{\{\s*time_label\s*\}\}/g, data.timeLabel ?? "")
    .replace(/\{\{\s*venue_name\s*\}\}/g, data.venueName ?? "")
    .replace(/\{\{\s*city_state\s*\}\}/g, data.cityState ?? "");
}

export function InboxPreviewHeader({
  subjectTemplate,
  preheaderTemplate,
  data,
  senderName = "MDAccula",
  senderInitials = "MD",
  overrideSubject,
}: Props) {
  const subject = overrideSubject ?? resolvePlaceholders(subjectTemplate, data);
  const preheader = resolvePlaceholders(preheaderTemplate, data);

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

          {/* Dica sutil de placeholders não resolvidos (aparece só se sobrar {{...}}) */}
          {(subject + " " + preheader).match(/\{\{[^}]+\}\}/) && (
            <div className="mt-1 text-[10px] text-amber-500/80">
              ⚠ Placeholder não reconhecido — verifique {"{{event_title}}"}, {"{{date_label}}"}, {"{{venue_name}}"}, {"{{city_state}}"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
