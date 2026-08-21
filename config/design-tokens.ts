// Omah Koempoel — Design Tokens
// Nuansa: hangat, modern, cozy-premium, mudah digunakan.
// Mendukung light & dark mode sejak awal (preferensi Gen Z/Alpha).

export const designTokens = {
  color: {
    light: {
      primary: "#B5651D",       // warm terracotta — identitas "koempoel"
      secondary: "#2F4B3C",     // deep sage green — cozy, natural
      success: "#3A7D44",
      warning: "#E0A526",
      danger: "#C0392B",
      background: "#FBF7F2",    // warm off-white
      surface: "#FFFFFF",
      text: "#2B2420",
      textMuted: "#7A6F65",
      border: "#E6DDD3",
    },
    dark: {
      primary: "#D98A46",
      secondary: "#8FBF9F",
      success: "#5FAE6C",
      warning: "#F0C34D",
      danger: "#E06456",
      background: "#1B1613",
      surface: "#251F1B",
      text: "#F3ECE4",
      textMuted: "#B3A599",
      border: "#3A3129",
    },
  },
  typography: {
    fontFamily: {
      heading: '"Fraunces", serif',   // hangat, sedikit editorial
      body: '"Inter", sans-serif',    // sangat mudah dibaca di layar kecil
    },
    scale: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "22px",
      "2xl": "28px",
      "3xl": "36px",
    },
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "20px",
    full: "999px",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  motion: {
    fast: "120ms ease-out",
    base: "200ms ease-out",
    // Gen Z/Alpha: micro-interaction halus, bukan reload halaman penuh
  },
} as const;

export type DesignTokens = typeof designTokens;
