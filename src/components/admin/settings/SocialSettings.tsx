import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SocialSettingsProps {
  instagramLink: string;
  setInstagramLink: (value: string) => void;
  soundcloudLink: string;
  setSoundcloudLink: (value: string) => void;
  whatsappNumber: string;
  setWhatsappNumber: (value: string) => void;
  whatsappLink: string;
  setWhatsappLink: (value: string) => void;
  contactEmail: string;
  setContactEmail: (value: string) => void;
}

const SocialSettings = ({
  instagramLink,
  setInstagramLink,
  soundcloudLink,
  setSoundcloudLink,
  whatsappNumber,
  setWhatsappNumber,
  whatsappLink,
  setWhatsappLink,
  contactEmail,
  setContactEmail,
}: SocialSettingsProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Redes Sociais</CardTitle>
          <CardDescription className="text-sm">
            Configure os links das redes sociais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="instagram-link" className="text-sm">
              Instagram URL
            </Label>
            <Input
              id="instagram-link"
              placeholder="https://instagram.com/mdaccula"
              value={instagramLink}
              onChange={(e) => setInstagramLink(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="soundcloud-link" className="text-sm">
              Soundcloud URL
            </Label>
            <Input
              id="soundcloud-link"
              placeholder="https://soundcloud.com/mdaccula"
              value={soundcloudLink}
              onChange={(e) => setSoundcloudLink(e.target.value)}
              className="h-12"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Contato</CardTitle>
          <CardDescription className="text-sm">Configure as informações de contato</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-number" className="text-sm">
              WhatsApp (Número)
            </Label>
            <Input
              id="whatsapp-number"
              placeholder="+55 11 99999-9999"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp-link" className="text-sm">
              WhatsApp (Link)
            </Label>
            <Input
              id="whatsapp-link"
              placeholder="https://wa.me/5511999999999"
              value={whatsappLink}
              onChange={(e) => setWhatsappLink(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-sm">
              Email de Contato
            </Label>
            <Input
              id="contact-email"
              type="email"
              placeholder="contato@mdaccula.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-12"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialSettings;
