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
        copper: {
          50: "#FDF8F5",
          100: "#F9ECE4",
          200: "#F2D5C4",
          300: "#E8B79B",
          400: "#DB946E",
          500: "#C46632",
          600: "#B45A2B",
          700: "#984820",
          800: "#7C3A1A",
          900: "#652F17",
          950: "#361609",
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
