if (
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production" &&
  (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ===
      "https://gdgeokfwkbusemayqucb.supabase.co" ||
    !(process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
) {
  throw new Error(
    "Configure as variáveis públicas do Supabase PRD antes de compilar a Landing."
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
