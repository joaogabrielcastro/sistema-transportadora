// frontend/tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identidade ATrack: "ink" (navy profundo) + "signal" (ciano operacional).
        primary: {
          DEFAULT: "#0B1324", // Ink 900 — ações primárias e texto forte
          light: "#1F2A3D", // Ink 700 — hover
          dark: "#060B16", // Ink 950
        },
        ink: {
          950: "#070C17",
          900: "#0B1324",
          850: "#101A2E",
          800: "#16223A",
          700: "#1F2A3D",
          600: "#2B3A55",
          500: "#4A5B7A",
          400: "#7C8BA6",
          300: "#A9B5CA",
        },
        secondary: {
          DEFAULT: "#0891B2", // Cyan 600 - operational accent
          light: "#22D3EE", // Cyan 400
          dark: "#0E7490", // Cyan 700
        },
        success: {
          DEFAULT: "#10B981", // Emerald 500
          light: "#34D399",
          dark: "#059669",
        },
        danger: {
          DEFAULT: "#EF4444", // Red 500
          light: "#F87171",
          dark: "#DC2626",
        },
        warning: {
          DEFAULT: "#F59E0B", // Amber 500
          light: "#FBBF24",
          dark: "#D97706",
        },
        background: {
          DEFAULT: "#F5F7FA",
          paper: "#FFFFFF",
          dark: "#1E293B", // Slate 800
        },
        text: {
          primary: "#0F172A", // Slate 900 — contraste AA+ em fundo claro
          secondary: "#5B6779", // entre Slate 500/600 — legível em textos de apoio
          light: "#8A96A8",
          inverted: "#FFFFFF",
        },
        border: {
          DEFAULT: "#E3E8EF",
          strong: "#CBD3DE",
        },
      },
      // Tailwind 3.3 não gera min-h/min-w na escala de espaçamento; o código usa
      // min-h-10 / min-w-10 para alvos de toque de 40px.
      minHeight: {
        5: "1.25rem",
        8: "2rem",
        9: "2.25rem",
        10: "2.5rem",
        11: "2.75rem",
        12: "3rem",
      },
      minWidth: {
        5: "1.25rem",
        8: "2rem",
        9: "2.25rem",
        10: "2.5rem",
        11: "2.75rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        soft: "0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03)",
        pop: "0 12px 32px -8px rgba(15, 23, 42, 0.22), 0 4px 8px -4px rgba(15, 23, 42, 0.08)",
        glow: "0 0 15px rgba(59, 130, 246, 0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pop-in": "popIn 0.16s ease-out",
        "drawer-in": "drawerIn 0.2s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shake: "shake 0.4s ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        popIn: {
          "0%": { transform: "translateY(4px) scale(0.98)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        drawerIn: {
          "0%": { transform: "translateX(-16px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
        },
      },
    },
  },
  plugins: [],
};
