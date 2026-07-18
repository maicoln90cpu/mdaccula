import { cva } from "class-variance-authority";

export const cardVariants = cva(
  "rounded-lg border text-card-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-card",
        // Metric card - for KPIs and statistics
        metric: "bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30",
        // Alert card - for warnings and errors
        alert: "bg-destructive/10 border-destructive/30",
        // Note card - for informational content
        note: "bg-muted/50 border-border",
        // Success card - for positive feedback
        success: "bg-green-500/10 border-green-500/30",
        // Warning card - for caution messages
        warning: "bg-yellow-500/10 border-yellow-500/30",
        // Info card - for neutral information
        info: "bg-blue-500/10 border-blue-500/30",
        // Featured card - for highlighted content
        featured: "bg-gradient-to-br from-primary/20 via-accent/10 to-secondary/20 border-primary/50 shadow-lg",
        // Ghost card - minimal styling
        ghost: "bg-transparent border-transparent shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
