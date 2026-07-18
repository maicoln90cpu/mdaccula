import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          glow: "hsl(var(--secondary-glow))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          glow: "hsl(var(--accent-glow))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        'section': 'var(--space-section)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      boxShadow: {
        'neon': 'var(--shadow-neon)',
        'glow': 'var(--shadow-glow)',
        'card': 'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'smooth': '300ms',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "pulse-neon": {
          "0%, 100%": {
            opacity: "1",
            filter: "drop-shadow(0 0 10px hsl(var(--neon-purple) / 0.7))",
          },
          "50%": {
            opacity: "0.8",
            filter: "drop-shadow(0 0 20px hsl(var(--neon-purple) / 1))",
          },
        },
        "logo-pulse": {
          "0%, 100%": {
            opacity: "1",
            filter:
              "drop-shadow(0 2px 4px hsl(var(--neon-purple) / 0.25)) drop-shadow(0 4px 8px hsl(var(--neon-purple) / 0.2)) drop-shadow(0 6px 12px hsl(var(--neon-purple) / 0.15)) drop-shadow(0 8px 16px hsl(var(--neon-purple) / 0.1)) drop-shadow(0 0 10px hsl(var(--neon-purple) / 0.7))",
          },
          "50%": {
            opacity: "0.9",
            filter:
              "drop-shadow(0 2px 4px hsl(var(--neon-purple) / 0.25)) drop-shadow(0 4px 8px hsl(var(--neon-purple) / 0.2)) drop-shadow(0 6px 12px hsl(var(--neon-purple) / 0.15)) drop-shadow(0 8px 16px hsl(var(--neon-purple) / 0.1)) drop-shadow(0 0 22px hsl(var(--neon-purple) / 1))",
          },
        },
        "float": {
          "0%, 100%": {
            transform: "translateY(0px)",
          },
          "50%": {
            transform: "translateY(-10px)",
          },
        },
        "glow": {
          "0%, 100%": {
            boxShadow: "0 0 20px hsl(var(--neon-purple) / 0.3)",
          },
          "50%": {
            boxShadow: "0 0 40px hsl(var(--neon-purple) / 0.8)",
          },
        },
        "slide-in-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "ticket-glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 16px hsl(var(--primary) / 0.4)",
          },
          "50%": {
            boxShadow: "0 0 32px hsl(var(--primary) / 0.7), 0 0 20px hsl(var(--accent) / 0.4)",
          },
        },
        "ticket-glow-shift": {
          "0%": {
            backgroundPosition: "0% 50%",
          },
          "100%": {
            backgroundPosition: "200% 50%",
          },
        },
        "featured-glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px hsl(var(--neon-purple) / 0.5)",
          },
          "50%": {
            boxShadow: "0 0 36px hsl(var(--neon-purple) / 0.85)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-neon": "pulse-neon 2s ease-in-out infinite",
        "logo-pulse": "logo-pulse 2.5s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
        "slide-in-up": "slide-in-up 0.5s ease-out",
        "ticket-glow-pulse": "ticket-glow-pulse 2.5s ease-in-out infinite",
        "ticket-glow-shift": "ticket-glow-shift 6s linear infinite",
        "featured-glow-pulse": "featured-glow-pulse 2.5s ease-in-out infinite",
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
