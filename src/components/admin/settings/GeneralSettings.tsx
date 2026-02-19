import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GeneralSettingsProps {
  gtmId: string;
  setGtmId: (value: string) => void;
  newsletterPopupEnabled: boolean;
  setNewsletterPopupEnabled: (value: boolean) => void;
}

const GeneralSettings = ({
  gtmId,
  setGtmId,
  newsletterPopupEnabled,
  setNewsletterPopupEnabled,
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
    </div>
  );
};

export default GeneralSettings;
