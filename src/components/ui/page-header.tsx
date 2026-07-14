import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface PageHeaderBreadcrumbItem {
  label: string;
  /** Omit for the current page (renders as BreadcrumbPage, not a link). */
  href?: string;
}

export interface PageHeaderProps {
  /** Required unless `children` supplies its own heading. */
  title?: string;
  subtitle?: string;
  breadcrumb?: PageHeaderBreadcrumbItem[];
  /** Background treatment. Defaults to "gradient". */
  variant?: "gradient" | "photo" | "radial" | "plain";
  /** Only used when variant="photo". */
  backgroundImage?: string;
  align?: "left" | "center";
  icon?: LucideIcon;
  /** Rendered next to the title (align="left" only), e.g. an admin-only action button. */
  actions?: ReactNode;
  /** Rendered below the subtitle, e.g. a secondary button like an RSS feed link. */
  extra?: ReactNode;
  /** When provided, replaces the title/subtitle/icon block entirely — the section chrome (breadcrumb + background variant) is kept. */
  children?: ReactNode;
}

const sectionClassByVariant: Record<NonNullable<PageHeaderProps["variant"]>, string> = {
  gradient: "relative py-20 overflow-hidden bg-background",
  radial: "relative py-16 md:py-24 overflow-hidden bg-background",
  photo: "relative h-[30vh] md:h-[40vh] flex items-center justify-center overflow-hidden",
  plain: "relative py-12 overflow-hidden bg-background",
};

/** Linha de gradiente neon na borda inferior — mesma assinatura visual do `SectionHeading` da home. */
const NeonBottomDivider = () => (
  <span
    className="absolute left-0 right-0 bottom-0 h-0.5"
    style={{
      background: "linear-gradient(90deg, transparent, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--secondary)), transparent)",
      boxShadow: "0 0 16px hsl(var(--primary) / 0.5)",
    }}
  />
);

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  variant = "gradient",
  backgroundImage,
  align = "left",
  icon: Icon,
  actions,
  extra,
  children,
}: PageHeaderProps) {
  return (
    <section
      className={sectionClassByVariant[variant]}
      style={
        variant === "photo" && backgroundImage
          ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      {variant === "gradient" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 70% at 15% 20%, hsl(var(--primary) / 0.16), transparent 60%), radial-gradient(ellipse 60% 60% at 85% 60%, hsl(var(--accent) / 0.12), transparent 60%)",
          }}
        />
      )}
      {variant === "radial" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(var(--accent)/0.15),transparent_50%)]" />
        </>
      )}
      {variant === "photo" && (
        <>
          <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-black/45 to-black/20" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 60% 60% at 20% 15%, hsl(var(--primary) / 0.12), transparent 60%)",
            }}
          />
        </>
      )}
      {variant === "plain" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.08), transparent 60%)",
          }}
        />
      )}

      <div className="relative z-10 container mx-auto px-4">
        {breadcrumb && breadcrumb.length > 0 && (
          <Breadcrumb className="mb-4 md:mb-6">
            <BreadcrumbList className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
              {breadcrumb.map((item, index) => (
                <Fragment key={`${item.label}-${index}`}>
                  <BreadcrumbItem>
                    {item.href ? (
                      <BreadcrumbLink asChild className="hover:text-primary-glow">
                        <Link to={item.href}>{item.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-foreground/80">{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumb.length - 1 && <BreadcrumbSeparator />}
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {children ? (
          children
        ) : (
          <div
            className={cn(
              align === "left" && actions ? "flex items-center justify-between gap-4 flex-wrap" : undefined,
              align === "center" && "text-center max-w-3xl mx-auto",
            )}
          >
            <div>
              {Icon && (
                <div className="glass-card inline-flex items-center justify-center w-16 h-16 rounded-full mb-6">
                  <Icon className="w-8 h-8 text-primary-glow" />
                </div>
              )}
              <h1
                className={cn(
                  "font-bold hero-text mb-4 md:mb-6",
                  variant === "photo" ? "text-4xl md:text-5xl lg:text-7xl" : "text-4xl md:text-5xl lg:text-6xl",
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p
                  className={cn(
                    "text-muted-foreground",
                    variant === "photo" ? "text-lg md:text-xl lg:text-2xl max-w-3xl" : "text-xl max-w-2xl",
                    align === "center" && "mx-auto",
                  )}
                >
                  {subtitle}
                </p>
              )}
              {extra}
            </div>
            {actions && <div>{actions}</div>}
          </div>
        )}
      </div>

      <NeonBottomDivider />
    </section>
  );
}
