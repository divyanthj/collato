module.exports = {
  content: [
    "./app/**/*.{js,jsx,mdx}",
    "./components/**/*.{js,jsx,mdx}",
    "./lib/**/*.{js,jsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 28px 90px rgba(12, 36, 61, 0.12)",
      },
      backgroundImage: {
        "mesh-glow":
          "radial-gradient(circle at 12% 10%, rgba(21, 162, 180, 0.18), transparent 28%), radial-gradient(circle at 88% 8%, rgba(46, 101, 215, 0.2), transparent 32%), radial-gradient(circle at 58% 78%, rgba(57, 210, 171, 0.16), transparent 24%), linear-gradient(135deg, #f7fbff 0%, #eef6ff 48%, #f5fcfb 100%)",
        "brand-sheen":
          "linear-gradient(120deg, rgba(21,162,180,0.92) 0%, rgba(41,118,223,0.95) 52%, rgba(57,210,171,0.92) 100%)",
      },
      animation: {
        shimmer: "shimmer 7s ease-in-out infinite alternate",
        drift: "drift 18s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "15% 50%" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -10px, 0)" },
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        collato: {
          primary: "#169cb0",
          "primary-content": "#f8feff",
          secondary: "#39d2ab",
          "secondary-content": "#072822",
          accent: "#2976df",
          "accent-content": "#f6f9ff",
          neutral: "#18324a",
          "neutral-content": "#eef6fb",
          "base-100": "#f7fbff",
          "base-200": "#edf4fb",
          "base-300": "#d6e4ef",
          "base-content": "#21384e",
          info: "#3a8cff",
          success: "#169b74",
          warning: "#c8891b",
          error: "#bf4f46",
        },
      },
    ],
  },
};
