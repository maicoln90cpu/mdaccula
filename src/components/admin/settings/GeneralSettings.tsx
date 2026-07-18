import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";

interface GeneralSettingsProps {
  gtmId: string;
  setGtmId: (value: string) => void;
  newsletterPopupEnabled: boolean;
  setNewsletterPopupEnabled: (value: boolean) => void;
  timezoneOffset: string;
  setTimezoneOffset: (value: string) => void;
  timezoneName: string;
  setTimezoneName: (value: string) => void;
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

const GeneralSettings = ({
  gtmId,
  setGtmId,
  newsletterPopupEnabled,
  setNewsletterPopupEnabled,
  timezoneOffset,
  setTimezoneOffset,
  timezoneName,
  setTimezoneName,
}: GeneralSettingsProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Analytics</CardTitle>
          <CardDescription className="text-sm">
            Configure o rastreamento e analytics do site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="gtm-id" className="text-sm">Google Tag Manager ID</Label>
            <Input
              id="gtm-id"
              placeholder="GTM-XXXXXXX"
              value={gtmId}
              onChange={(e) => setGtmId(e.target.value)}
              className="h-12"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Newsletter</CardTitle>
          <CardDescription>
            Configure o comportamento do popup de captura de emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="newsletter-popup">Habilitar popup de newsletter</Label>
              <p className="text-xs text-muted-foreground">
                O popup aparecerá após 30 segundos ou 50% de scroll
              </p>
            </div>
            <Switch
              id="newsletter-popup"
              checked={newsletterPopupEnabled}
              onCheckedChange={setNewsletterPopupEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-lg sm:text-xl">Timezone Global</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Usado para calcular visibilidade de eventos e horários exibidos no site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default GeneralSettings;
