import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const NewsletterPopup = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { settings, isLoading: settingsLoading } = useSiteSettings();

  useEffect(() => {
    // Aguardar settings carregarem
    if (settingsLoading) return;

    // Se desabilitado, não dispara
    if (settings.newsletter_popup_enabled !== "true") return;
    
    // Verificar se já foi mostrado
    const hasSeenPopup = localStorage.getItem("newsletter_popup_seen");
    const hasSubscribed = localStorage.getItem("newsletter_subscribed");

    if (hasSeenPopup || hasSubscribed) return;

    // Mostrar após 30 segundos
    const timer = setTimeout(() => {
      setOpen(true);
      localStorage.setItem("newsletter_popup_seen", "true");
    }, 30000);

    // Ou após scroll de 50%
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent > 50 && !hasSeenPopup) {
        setOpen(true);
        localStorage.setItem("newsletter_popup_seen", "true");
        window.removeEventListener("scroll", handleScroll);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [settings.newsletter_popup_enabled, settingsLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Por favor, insira um email válido");
      return;
    }

    if (!consent) {
      toast.error("Você precisa concordar com a política de privacidade");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert({
          email,
          source: "popup",
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("Este email já está cadastrado!");
        } else {
          throw error;
        }
      } else {
        toast.success("🎉 Inscrição realizada com sucesso!");
        localStorage.setItem("newsletter_subscribed", "true");
        setOpen(false);
      }
    } catch (error) {
      console.error("Newsletter error:", error);
      toast.error("Erro ao processar inscrição. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>

        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            🎵 Fique por dentro!
          </DialogTitle>
          <DialogDescription className="text-center">
            Receba as últimas notícias sobre eventos de música eletrônica, 
            novos posts no blog e muito mais diretamente no seu email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <Input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="text-center"
          />
          
          <div className="flex items-start space-x-3">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              disabled={loading}
              className="mt-1"
            />
            <label htmlFor="consent" className="text-xs text-muted-foreground cursor-pointer leading-tight">
              Li e concordo com a{" "}
              <Link to="/privacidade" className="text-primary hover:underline" onClick={() => setOpen(false)}>
                Política de Privacidade
              </Link>
              . Autorizo o uso do meu email para receber novidades conforme a LGPD.
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !consent}
          >
            {loading ? "Inscrevendo..." : "Inscrever-se"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Sem spam. Cancele a qualquer momento.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};
