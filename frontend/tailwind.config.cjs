// frontend/tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F172A", // Slate 900 - Deep Navy
          light: "#334155", // Slate 700
          dark: "#020617", // Slate 950
        },
        secondary: {
          DEFAULT: "#3B82F6", // Blue 500 - Vibrant Blue
          light: "#60A5FA", // Blue 400
          dark: "#2563EB", // Blue 600
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
          DEFAULT: "#F8FAFC", // Slate 50
          paper: "#FFFFFF",
          dark: "#1E293B", // Slate 800
        },
        text: {
          primary: "#1E293B", // Slate 800
          secondary: "#64748B", // Slate 500
          light: "#94A3B8", // Slate 400
          inverted: "#FFFFFF",
        },
        border: "#E2E8F0", // Slate 200
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        card: "0 0 0 1px rgba(0, 0, 0, 0.03), 0 2px 8px rgba(0, 0, 0, 0.04)",
        glow: "0 0 15px rgba(59, 130, 246, 0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
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
