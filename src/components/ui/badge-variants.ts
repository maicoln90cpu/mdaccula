import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Default variants
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',

        // Status variants
        success: 'border-green-500/30 bg-green-500/20 text-green-400',
        warning: 'border-yellow-500/30 bg-yellow-500/20 text-yellow-400',
        info: 'border-blue-500/30 bg-blue-500/20 text-blue-400',

        // Priority variants
        'priority-high': 'border-red-500/30 bg-red-500/20 text-red-400',
        'priority-medium': 'border-orange-500/30 bg-orange-500/20 text-orange-400',
        'priority-low': 'border-green-500/30 bg-green-500/20 text-green-400',

        // Accent variants
        accent: 'border-transparent bg-accent text-accent-foreground hover:bg-accent/80',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
