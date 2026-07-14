import { Instagram, MessageCircle, Music, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";

const Footer = () => {
  const { settings, isLoading } = useSiteSettings();

  if (isLoading) {
    return null; // or a loading skeleton
  }

  return (
    <footer className="bg-darker-surface border-t border-border">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Brand */}
          <div className="col-span-1 sm:col-span-2">
            <div className="text-2xl md:text-3xl font-bold hero-text neon-glow mb-3 md:mb-4">MDAccula</div>
            <p className="text-sm md:text-base text-muted-foreground max-w-md">
              A maior agência de divulgação de música eletrônica do Brasil! Conectando artistas, eventos e a cena
              eletrônica de São Paulo.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-primary">Navegação</h3>
            <ul className="space-y-2 text-sm md:text-base">
              <li>
                <Link to="/eventos" className="text-muted-foreground hover:text-primary transition-colors">
                  Eventos
                </Link>
              </li>
              <li>
                <Link to="/quem-somos" className="text-muted-foreground hover:text-primary transition-colors">
                  Quem Somos
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/contato" className="text-muted-foreground hover:text-primary transition-colors">
                  Contato
                </Link>
              </li>
              <li>
                <Link
                  to="/links"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  Links
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-primary">Redes Sociais</h3>
            <div className="flex space-x-3 md:space-x-4">
              <Button variant="ghost" size="icon" asChild className="min-w-[44px] min-h-[44px]">
                <a
                  href={settings.instagram_link || "https://instagram.com/mdaccula"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Seguir MDAccula no Instagram"
                  className="hover:text-accent"
                >
                  <Instagram className="w-5 h-5 md:w-6 md:h-6" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild className="min-w-[44px] min-h-[44px]">
                <a
                  href={settings.whatsapp_link || "https://wa.me/5511999999999"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Contato via WhatsApp"
                  className="hover:text-secondary"
                >
                  <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild className="min-w-[44px] min-h-[44px]">
                <a
                  href={settings.soundcloud_link || "https://soundcloud.com/mdaccula"}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ouvir MDAccula no SoundCloud"
                  className="hover:text-primary"
                >
                  <Music className="w-5 h-5 md:w-6 md:h-6" />
                </a>
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {settings.whatsapp_number && (
                <a
                  href={settings.whatsapp_link || `https://wa.me/55${settings.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block"
                >
                  WhatsApp: {settings.whatsapp_number}
                </a>
              )}
              <a 
                href={`mailto:${settings.contact_email || "contato@mdaccula.com"}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors block"
              >
                Email: {settings.contact_email || "contato@mdaccula.com"}
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-muted-foreground">
            © 2017 MDAccula. Todos os direitos reservados. Agência especializada em música eletrônica em São Paulo.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
