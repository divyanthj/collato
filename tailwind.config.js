module.exports = {
  content: [
    "./app/**/*.{js,jsx,mdx}",
    "./components/**/*.{js,jsx,mdx}",
    "./lib/**/*.{js,jsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 30px 90px rgba(2, 6, 23, 0.48)",
      },
      backgroundImage: {
        "mesh-glow":
          "radial-gradient(circle at 12% 10%, rgba(79, 70, 229, 0.24), transparent 26%), radial-gradient(circle at 88% 8%, rgba(59, 130, 246, 0.18), transparent 28%), radial-gradient(circle at 58% 78%, rgba(20, 184, 166, 0.16), transparent 22%), linear-gradient(135deg, #060814 0%, #0a1020 48%, #0b1324 100%)",
        "brand-sheen":
          "linear-gradient(120deg, rgba(109,40,217,0.95) 0%, rgba(59,130,246,0.95) 54%, rgba(20,184,166,0.9) 100%)",
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
          primary: "#5b5ef7",
          "primary-content": "#f8f9ff",
          secondary: "#10b7a5",
          "secondary-content": "#041411",
          accent: "#8b5cf6",
          "accent-content": "#f8f5ff",
          neutral: "#f5f7ff",
          "neutral-content": "#09111f",
          "base-100": "#060814",
          "base-200": "#0c1220",
          "base-300": "#1b2334",
          "base-content": "#d6def4",
          info: "#53a8ff",
          success: "#1ed39b",
          warning: "#f0b54a",
          error: "#ff6b81",
        },
      },
    ],
  },
};
