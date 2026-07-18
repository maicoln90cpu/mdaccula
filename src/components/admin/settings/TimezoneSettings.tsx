import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TimezoneSettingsProps {
  eventHoursAfterStart: number;
  setEventHoursAfterStart: (value: number) => void;
  eventHoursWithoutTime: number;
  setEventHoursWithoutTime: (value: number) => void;
  linksShowEventDate: boolean;
  setLinksShowEventDate: (value: boolean) => void;
}

const TimezoneSettings = ({
  eventHoursAfterStart,
  setEventHoursAfterStart,
  eventHoursWithoutTime,
  setEventHoursWithoutTime,
  linksShowEventDate,
  setLinksShowEventDate,
}: TimezoneSettingsProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-amber-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-lg sm:text-xl">Regras de Exibição de Eventos e Links</CardTitle>
          </div>
          <CardDescription className="text-sm">
            O timezone global agora vive na aba Geral. Aqui ficam as regras de quando um evento some do site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-4 sm:px-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Horas até inativar (com horário definido)</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={72}
                value={eventHoursAfterStart}
                onChange={(e) => setEventHoursAfterStart(parseInt(e.target.value) || 12)}
                className="w-24 h-12"
              />
              <span className="text-sm text-muted-foreground">horas após o início</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quanto tempo após o horário de início o evento continua ativo (1-72h, padrão 12h).
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Horas até inativar (sem horário definido)</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={1}
                max={72}
                value={eventHoursWithoutTime}
                onChange={(e) => setEventHoursWithoutTime(parseInt(e.target.value) || 24)}
                className="w-24 h-12"
              />
              <span className="text-sm text-muted-foreground">horas após 00:00 do dia</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quando não houver horário definido, conta a partir da meia-noite do dia do evento (1-72h, padrão 24h).
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
            <p className="text-sm font-medium">Como funciona a regra de visibilidade:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Evento usa apenas <strong>data</strong> e <strong>horário de início</strong></li>
              <li>Com horário: visível até <strong>início + horas configuradas</strong></li>
              <li>Sem horário: visível até <strong>meia-noite do dia + horas configuradas</strong></li>
              <li>Comparação respeita o <strong>timezone</strong> selecionado acima</li>
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
