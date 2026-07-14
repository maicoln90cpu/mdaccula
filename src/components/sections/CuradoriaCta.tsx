import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const DraftSetCard = () => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const card = cardRef.current;
    if (!canHover || prefersReducedMotion || !card) return;

    const handleMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--ry", `${(relX * 16).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(relY * -16).toFixed(2)}deg`);
    };
    const handleLeave = () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    };

    card.addEventListener("pointermove", handleMove);
    card.addEventListener("pointerleave", handleLeave);
    return () => {
      card.removeEventListener("pointermove", handleMove);
      card.removeEventListener("pointerleave", handleLeave);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="glass-card-dashed w-64 shrink-0"
      style={{
        transform: "perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className="relative h-36"
        style={{
          background:
            "repeating-linear-gradient(135deg, hsl(var(--muted)) 0 2px, hsl(var(--muted) / 0.6) 2px 14px)",
        }}
      >
        <span className="absolute top-2.5 left-2.5 text-[0.65rem] font-mono uppercase tracking-wide font-bold bg-accent/20 border border-accent/50 text-accent-glow px-2 py-0.5 rounded-full animate-pulse">
          Em análise
        </span>
      </div>
      <div className="p-4">
        <span className="inline-block text-[0.65rem] font-mono uppercase tracking-wide bg-muted text-muted-foreground px-2 py-0.5 rounded-full mb-2">
          Seu gênero aqui
        </span>
        <h3 className="font-display font-bold uppercase text-base leading-tight mb-1 text-foreground/60">
          Seu set aqui
        </h3>
        <div className="flex justify-between text-[0.7rem] font-mono text-muted-foreground">
          <span>Em breve</span>
          <span>Sua cidade</span>
        </div>
      </div>
    </div>
  );
};

const CuradoriaCta = () => {
  return (
    <section className="relative overflow-hidden border-t border-border py-16 sm:py-20">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 80% 40%, hsl(var(--accent) / 0.16), transparent 60%), radial-gradient(ellipse 45% 55% at 10% 70%, hsl(var(--primary) / 0.16), transparent 60%)",
        }}
      />

      <div className="relative container mx-auto px-4 grid lg:grid-cols-[1fr_auto] items-center gap-12 text-center lg:text-left">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent-glow bg-accent/10 border border-accent/40 px-3 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-glow shadow-[0_0_8px_hsl(var(--accent-glow))]" />
            MDAccula Radio · curadoria aberta
          </span>

          <h2 className="text-3xl sm:text-4xl font-display font-bold uppercase leading-tight mb-4">
            Seu set pode ser o próximo gravado pela MDAccula Radio
          </h2>

          <p className="text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed mb-7">
            Envie seu material pro MDAccula Radio. A análise é 100% gratuita — nossa equipe ouve,
            avalia e, se aprovado, seu set é gravado com a gente e divulgado em todos os nossos
            canais.
          </p>

          <Button size="lg" className="btn-neon text-base px-8 py-4" asChild>
            <Link to="/MDAcculaRadio#inscricao">Enviar material para análise</Link>
          </Button>
        </div>

        <div className="mx-auto lg:mx-0">
          <DraftSetCard />
        </div>
      </div>
    </section>
  );
};

export default CuradoriaCta;
