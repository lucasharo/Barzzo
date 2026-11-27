import { Link } from "react-router-dom";
import { Card, CardContent } from "@barzzo/ui";
import { Bell, ChevronRight, Settings, Store } from "lucide-react";

export default function PaginaConfiguracoes() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4 pb-12">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <Settings className="h-6 w-6 text-[#B45A2B]" aria-hidden="true" />
          Configurações
        </h1>
        <p className="mt-2 text-sm opacity-70">
          Gerencie as informações e os avisos do seu painel.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Card camada="primaria">
          <CardContent className="p-0">
            <Link
              to="/configuracoes/perfil"
              className="flex min-h-20 items-center gap-4 rounded-xl p-4 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45A2B] focus-visible:ring-inset dark:hover:bg-white/5"
            >
              <Store className="h-6 w-6 shrink-0 text-[#B45A2B]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Dados da Barbearia</span>
                <span className="mt-1 block text-sm opacity-70">
                  Atualize as informações e os contatos do estabelecimento.
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardContent className="p-0">
            <Link
              to="/configuracoes/notificacoes"
              className="flex min-h-20 items-center gap-4 rounded-xl p-4 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45A2B] focus-visible:ring-inset dark:hover:bg-white/5"
            >
              <Bell className="h-6 w-6 shrink-0 text-[#B45A2B]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Notificações</span>
                <span className="mt-1 block text-sm opacity-70">
                  Ative ou desative avisos neste navegador.
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
