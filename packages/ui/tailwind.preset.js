/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", "sans-serif"],
      },
      colors: {
        primaria: {
          DEFAULT: "#B45A2B",
          hover: "#C46632",
          pressionada: "#984820",
        },
        info: "#2563EB",
        sucesso: "#16A34A",
        alerta: "#EAB308",
        erro: "#DC2626",
      },
    },
  },
  plugins: [],
};
