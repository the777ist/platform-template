/**
 * Shared design tokens for ALL products and packages/ui.
 * Every product's tailwind.config.js consumes this via `presets`.
 * Change tokens here once; every platform (iOS/Android/web/desktop) picks them up.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6366f1",
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f4f4f5",
          inverted: "#18181b",
        },
        content: {
          DEFAULT: "#18181b",
          muted: "#71717a",
          inverted: "#fafafa",
        },
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
    },
  },
};
