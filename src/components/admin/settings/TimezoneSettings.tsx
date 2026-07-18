import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface TimezoneSettingsProps {
  linksShowEventDate: boolean;
  setLinksShowEventDate: (value: boolean) => void;
}

const TimezoneSettings = ({
  linksShowEventDate,
  setLinksShowEventDate,
}: TimezoneSettingsProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-amber-500/20">
        <CardHeader className="px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <CardTitle className="text-lg sm:text-xl">Regras de Exibição de Links</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Timezone global fica em Geral. Regras de visibilidade de eventos ficam em Eventos → aba Configurações.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex items-center justify-between space-x-4">
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
