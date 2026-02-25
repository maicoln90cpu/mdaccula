import { Button } from "@/components/ui/button";
import { Calendar, Users } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-club.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] sm:min-h-[75vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto animate-slide-in-up">
          {/* Main Logo/Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 sm:mb-6 logo-gradient animate-pulse-neon leading-tight">MDAccula</h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-3 sm:mb-4 text-foreground/90 max-w-2xl mx-auto leading-relaxed px-4">
            A maior agência de divulgação de música eletrônica do Brasil!
          </p>

          {/* Description */}
          <p className="text-sm sm:text-base md:text-lg mb-6 sm:mb-8 text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4">
            Conectamos artistas, promoters e a cena eletrônica de São Paulo. Descubra os melhores eventos, DJs e festas
            da capital paulista.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="btn-neon text-lg px-8 py-4" asChild>
              <Link to="/eventos">
                <span className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Ver Eventos</span>
                </span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-4 border-primary/50 hover:border-primary"
              asChild
            >
              <Link to="/quem-somos">
                <Users className="w-5 h-5 mr-2" />
                Quem Somos
              </Link>
            </Button>
          </div>

          {/* Social Proof */}
          <div className="mt-4 sm:mt-10 grid grid-cols-3 gap-2 sm:gap-6 text-center px-4">
            <div className="animate-float">
              <div className="text-2xl sm:text-3xl font-bold text-primary">500+</div>
              <div className="text-sm sm:text-base text-muted-foreground">Eventos Promovidos</div>
            </div>
            <div className="animate-float" style={{ animationDelay: "1s" }}>
              <div className="text-2xl sm:text-3xl font-bold text-secondary">200+</div>
              <div className="text-sm sm:text-base text-muted-foreground">DJs Parceiros</div>
            </div>
            <div className="animate-float" style={{ animationDelay: "2s" }}>
              <div className="text-2xl sm:text-3xl font-bold text-accent">50k+</div>
              <div className="text-sm sm:text-base text-muted-foreground">Seguidores</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <button 
        onClick={() => {
          const nextSection = document.getElementById('proximos-eventos');
          nextSection?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-bounce cursor-pointer hover:scale-110 transition-transform"
        aria-label="Rolar para próximos eventos"
      >
        <div className="w-6 h-10 border-2 border-primary rounded-full flex justify-center">
          <div className="w-1 h-3 bg-primary rounded-full mt-2 animate-pulse"></div>
        </div>
      </button>
    </section>
  );
};

export default Hero;
