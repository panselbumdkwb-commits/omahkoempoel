/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#B5651D",
        secondary: "#2F4B3C",
        success: "#3A7D44",
        warning: "#E0A526",
        danger: "#C0392B",
        background: "#FBF7F2",
        surface: "#FFFFFF",
        text: "#2B2420",
        "text-muted": "#7A6F65",
        border: "#E6DDD3",
        "primary-dark": "#D98A46",
        "secondary-dark": "#8FBF9F",
        "background-dark": "#1B1613",
        "surface-dark": "#251F1B",
        "text-dark": "#F3ECE4",
      },
      fontFamily: {
        heading: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "20px",
      },
    },
  },
  plugins: [],
};
