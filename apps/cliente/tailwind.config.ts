import type { Config } from "tailwindcss";
import presetBarzzo from "../../packages/ui/tailwind.preset.js";

const config: Config = {
  presets: [presetBarzzo],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
