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
  gradient: "py-20 bg-gradient-to-r from-primary/20 to-accent/20",
  radial: "relative py-16 md:py-24 overflow-hidden",
  photo: "relative h-[30vh] md:h-[40vh] flex items-center justify-center",
  plain: "py-12",
};

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
  const hasOverlayLayers = variant === "photo" || variant === "radial";

  return (
    <>
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="container mx-auto px-4 pt-4">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumb.map((item, index) => (
                <Fragment key={`${item.label}-${index}`}>
                  <BreadcrumbItem>
                    {item.href ? (
                      <BreadcrumbLink asChild>
                        <Link to={item.href}>{item.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumb.length - 1 && <BreadcrumbSeparator />}
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}

      <section
        className={sectionClassByVariant[variant]}
        style={
          variant === "photo" && backgroundImage
            ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {variant === "photo" && <div className="absolute inset-0 bg-black/60" />}
        {variant === "radial" && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,hsl(var(--accent)/0.15),transparent_50%)]" />
          </>
        )}

        <div className={cn("container mx-auto px-4", hasOverlayLayers && "relative z-10")}>
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
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                    <Icon className="w-8 h-8 text-primary" />
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
      </section>
    </>
  );
}
