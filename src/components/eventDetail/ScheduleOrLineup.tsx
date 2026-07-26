import { motion, useReducedMotion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseLocalDate } from '@/lib/dateUtils';
import { parseSchedule } from '@/lib/eventScheduleHelper';
import { normalizeLineup } from '@/lib/lineupNormalizer';

export function ScheduleOrLineup({ schedule, lineup }: { schedule?: unknown; lineup: string[] }) {
  const prefersReducedMotion = useReducedMotion();
  const parsed = parseSchedule(schedule);

  if (parsed && parsed.length > 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Programação por dia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {parsed.map((day) => {
            const dayLineup =
              day.lineup && day.lineup.length > 0
                ? normalizeLineup(day.lineup)
                : normalizeLineup(lineup);
            const dayLabel = parseLocalDate(day.date).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            });
            return (
              <div key={day.date} className="border-l-2 border-primary pl-4 space-y-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-semibold capitalize">{dayLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    {day.time ? day.time.slice(0, 5) : 'Horário a confirmar'}
                    {day.end_time ? ` – ${day.end_time.slice(0, 5)}` : ''}
                  </p>
                </div>
                {dayLineup.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {dayLineup.map((artist, i) => (
                      <motion.span
                        key={i}
                        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.3,
                          delay: Math.min(i, 10) * 0.04,
                          ease: 'easeOut',
                        }}
                      >
                        <Badge
                          variant="outline"
                          className="text-sm px-3 py-1 leading-relaxed whitespace-normal break-words max-w-full"
                        >
                          {artist}
                        </Badge>
                      </motion.span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Line-up a ser anunciado</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  if (lineup && lineup.length > 0) {
    const cleanLineup = normalizeLineup(lineup);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Line-up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            {cleanLineup.map((artist, index) => (
              <motion.span
                key={index}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index, 10) * 0.04,
                  ease: 'easeOut',
                }}
              >
                <Badge
                  variant="outline"
                  className="text-sm md:text-base px-3.5 py-1.5 leading-relaxed whitespace-normal break-words max-w-full"
                >
                  {artist}
                </Badge>
              </motion.span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
