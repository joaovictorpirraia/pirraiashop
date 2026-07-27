import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // acento framboesa — marca, selo de desconto e CTA
        pirraia: {
          DEFAULT: "#E5126A",
          dark: "#C20E5A",
          tint: "#FCE3EE",
        },
        areia: "#FBF9F8", // fundo branco quente (não creme)
        tinta: "#1B1512", // near-black quente pro texto
        fumo: "#8B827C", // cinza quente secundário
      },
      boxShadow: {
        carta: "0 6px 24px -10px rgba(27,21,18,0.20)",
        cartaHover: "0 12px 32px -12px rgba(229,18,106,0.28)",
      },
      borderRadius: {
        "2xl": "1.1rem",
      },
    },
  },
  plugins: [],
};

export default config;
