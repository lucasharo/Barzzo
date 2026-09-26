import Link from "next/link";
import { Scissors, CalendarCheck, Star } from "lucide-react";

export default function PaginaInicial() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-[#FBF5F1] to-[#F3E3D8] dark:from-[#0A0A0B] dark:via-[#141416] dark:to-[#1C1C1F] py-24 md:py-36">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="inline-block mb-4 px-3 py-1 rounded-full text-xs font-semibold bg-[#B45A2B]/10 text-[#B45A2B] uppercase tracking-wider">
            Agendamento Online
          </span>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-neutral-900 dark:text-white mb-6">
            Encontre e Agende a{" "}
            <span className="text-[#B45A2B]">Melhor Barbearia</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto mb-10">
            Descubra barbearias top da sua cidade, veja serviços e agende em
            segundos — sem ligação, sem espera.
          </p>
          <Link
            href="/barbearias"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#B45A2B] hover:bg-[#C46632] active:bg-[#984820] text-white text-lg font-bold shadow-lg shadow-[#B45A2B]/30 transition-all"
          >
            <Scissors className="w-5 h-5" />
            Buscar Barbearias
          </Link>
        </div>

        {/* Decoração de fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#B45A2B]/5 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-[#B45A2B]/5 blur-3xl"
        />
      </section>

      {/* ── Como funciona ── */}
      <section className="py-20 bg-white dark:bg-[#0A0A0B]">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-neutral-900 dark:text-white mb-4">
            Como funciona
          </h2>
          <p className="text-center text-neutral-500 dark:text-neutral-400 mb-14 max-w-xl mx-auto">
            Três passos simples para sair impecável da barbearia.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Passo 1 */}
            <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200/60 dark:border-neutral-800/60">
              <div className="w-16 h-16 rounded-full bg-[#B45A2B]/10 flex items-center justify-center mb-6">
                <Scissors className="w-8 h-8 text-[#B45A2B]" />
              </div>
              <span className="text-xs font-bold text-[#B45A2B] uppercase tracking-widest mb-2">
                Passo 1
              </span>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                Encontre
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                Pesquise barbearias por bairro ou cidade. Veja avaliações,
                serviços e preços antes de decidir.
              </p>
            </div>

            {/* Passo 2 */}
            <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200/60 dark:border-neutral-800/60">
              <div className="w-16 h-16 rounded-full bg-[#B45A2B]/10 flex items-center justify-center mb-6">
                <CalendarCheck className="w-8 h-8 text-[#B45A2B]" />
              </div>
              <span className="text-xs font-bold text-[#B45A2B] uppercase tracking-widest mb-2">
                Passo 2
              </span>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                Agende
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                Escolha o serviço, o profissional e o horário que melhor se
                encaixa na sua rotina. Tudo online, sem ligação.
              </p>
            </div>

            {/* Passo 3 */}
            <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200/60 dark:border-neutral-800/60">
              <div className="w-16 h-16 rounded-full bg-[#B45A2B]/10 flex items-center justify-center mb-6">
                <Star className="w-8 h-8 text-[#B45A2B]" />
              </div>
              <span className="text-xs font-bold text-[#B45A2B] uppercase tracking-widest mb-2">
                Passo 3
              </span>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                Aproveite
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
                Apareça no horário e saia com um visual incrível. Depois,
                avalie o serviço e ajude outros clientes a encontrar o melhor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Para Barbearias ── */}
      <section className="py-20 bg-[#F6F6F7] dark:bg-[#141416]">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white mb-4">
            Você tem uma barbearia?
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto mb-10 text-lg">
            Cadastre sua barbearia no Barzzo e atraia novos clientes, gerencie
            sua agenda e cresça o seu negócio de forma simples e digital.
          </p>
          <a
            href="https://parceiro.barzzo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-[#B45A2B] text-[#B45A2B] hover:bg-[#B45A2B] hover:text-white text-lg font-bold transition-all"
          >
            Cadastrar minha barbearia
          </a>
        </div>
      </section>
    </>
  );
}
