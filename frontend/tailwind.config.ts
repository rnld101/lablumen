import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

// Bento design tokens from BLUEPRINT.md section 3 (clinical light-mode, overrides dark themes).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#008080",
        background: "#FFFFFF",
        surface: "#F8FAFC",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        "text-dark": "#0F172A",
        "text-muted": "#64748B",
      },
      borderRadius: {
        bento: "1rem",
      },
      boxShadow: {
        "bento-diffused":
          "0 10px 25px -5px rgba(0, 128, 128, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
