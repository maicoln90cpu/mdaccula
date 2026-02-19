import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";

interface TimezoneSettingsProps {
  timezoneOffset: string;
  setTimezoneOffset: (value: string) => void;
  timezoneName: string;
  setTimezoneName: (value: string) => void;
  eventGraceHours: number;
  setEventGraceHours: (value: number) => void;
  linksShowEventDate: boolean;
  setLinksShowEventDate: (value: boolean) => void;
}

const BRAZIL_TIMEZONES = [
  { offset: "-3", name: "America/Sao_Paulo", label: "Horário de Brasília", regions: "São Paulo, Rio, Curitiba, BH", icon: "🕐", recommended: true },
  { offset: "-4", name: "America/Manaus", label: "Amazônia", regions: "Manaus, Cuiabá, Campo Grande", icon: "🌳" },
  { offset: "-5", name: "America/Rio_Branco", label: "Acre", regions: "Rio Branco, Cruzeiro do Sul", icon: "🌿" },
  { offset: "-2", name: "Atlantic/South_Georgia", label: "Fernando de Noronha", regions: "Ilhas oceânicas", icon: "🏝️" },
];

const INTERNATIONAL_TIMEZONES = [
  { offset: "-5", name: "America/New_York", label: "Nova York", icon: "🗽" },
  { offset: "0", name: "UTC", label: "UTC/Londres", icon: "🇬🇧" },
  { offset: "1", name: "Europe/Paris", label: "Paris", icon: "🇫🇷" },
  { offset: "2", name: "Europe/Athens", label: "Atenas", icon: "🇬🇷" },
];

const TimezoneSettings = ({
  timezoneOffset,
  setTimezoneOffset,
  timezoneName,
  setTimezoneName,
  eventGraceHours,
  setEventGraceHours,
  linksShowEventDate,
  setLinksShowEventDate,
}: TimezoneSettingsProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-amber-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-lg sm:text-xl">Configurações de Horário</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Configure timezone e regras de visibilidade de eventos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-4 sm:px-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Timezone Global</Label>
            
            {/* Timezones brasileiros destacados */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">🇧🇷 Brasil</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BRAZIL_TIMEZONES.map((tz) => (
                  <button
                    key={tz.offset}
                    type="button"
                    onClick={() => {
                      setTimezoneOffset(tz.offset);
                      setTimezoneName(tz.name);
                    }}
                    className={`relative flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      timezoneOffset === tz.offset
                        ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
                        : 'border-border hover:border-amber-500/50 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-2xl">{tz.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{tz.label}</span>
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">UTC{tz.offset}</span>
                        {tz.recommended && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 font-medium">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{tz.regions}</p>
                    </div>
                    {timezoneOffset === tz.offset && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Outros timezones internacionais */}
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">🌍 Internacional</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {INTERNATIONAL_TIMEZONES.map((tz) => (
                  <button
                    key={`int-${tz.offset}`}
                    type="button"
                    onClick={() => {
                      setTimezoneOffset(tz.offset);
                      setTimezoneName(tz.name);
                    }}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      timezoneOffset === tz.offset && ![-2, -3, -4, -5].includes(parseInt(tz.offset)) 
                        ? 'border-amber-500 bg-amber-500/10'
                        : timezoneOffset === tz.offset && tz.name === "America/New_York"
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-border hover:border-amber-500/50 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-lg">{tz.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium block truncate">{tz.label}</span>
                      <span className="text-[10px] text-muted-foreground">UTC{parseInt(tz.offset) >= 0 ? '+' : ''}{tz.offset}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              Timezone usado para calcular visibilidade de eventos. A maioria dos eventos no Brasil usa <strong>UTC-3 (Horário de Brasília)</strong>.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Horas de Tolerância Após Término</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={0}
                max={48}
                value={eventGraceHours}
                onChange={(e) => setEventGraceHours(parseInt(e.target.value) || 6)}
                className="w-24 h-12"
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quantas horas após o término do evento ele continuará visível no site (0-48 horas).
              Ex: evento termina às 06:00, com tolerância de 6h ficará visível até 12:00.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
            <p className="text-sm font-medium">Como funciona a regra de visibilidade:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Evento usa horário de <strong>início</strong> e <strong>término</strong> (opcional)</li>
              <li>Se término for menor que início (ex: 22:00 → 06:00), assume dia seguinte</li>
              <li>Evento fica visível até: <strong>término + tolerância</strong></li>
              <li>Sem horário de término: visível até <strong>início + 8h + tolerância</strong></li>
            </ul>
          </div>
          
          <div className="flex items-center justify-between space-x-4 pt-4 border-t">
            <div className="flex-1 space-y-1">
              <Label htmlFor="links-show-date">Exibir data nos cards de /links</Label>
              <p className="text-xs text-muted-foreground">
                Mostra a data e horário do evento nos cards da página de links
              </p>
            </div>
            <Switch
              id="links-show-date"
              checked={linksShowEventDate}
              onCheckedChange={setLinksShowEventDate}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimezoneSettings;
