import Link from "next/link";
import { Button, Card, CardContent } from "@barzzo/ui";
import { Search, MapPin, Scissors, Star, Calendar } from "lucide-react";

export default function PaginaInicialCliente() {
  return (
    <div className="flex flex-col gap-10 py-6">
      {/* Hero de Busca Pública */}
      <section className="text-center flex flex-col items-center gap-4 py-8">
        <span className="text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full bg-[#B45A2B]/10 text-[#B45A2B]">
          Marketplace Público & SaaS
        </span>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight max-w-2xl">
          Encontre os melhores barbeiros da sua região
        </h1>
        <p className="text-base md:text-lg opacity-80 max-w-xl">
          Navegue pelas barbearias, consulte disponibilidade em tempo real e faça seu agendamento em poucos toques.
        </p>

        {/* Barra de Pesquisa Pública */}
        <div className="w-full max-w-xl mt-4 flex flex-col sm:flex-row gap-2 p-2 rounded-xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-300 dark:border-neutral-700 shadow-sm">
          <div className="flex-1 flex items-center px-3 gap-2">
            <Search className="h-5 w-5 text-[#B45A2B] shrink-0" />
            <input
              type="text"
              placeholder="Buscar barbearia ou serviço..."
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </div>
          <div className="h-8 w-[1px] bg-neutral-300 dark:bg-neutral-700 hidden sm:block self-center" />
          <div className="flex items-center px-3 gap-2">
            <MapPin className="h-5 w-5 opacity-60 shrink-0" />
            <span className="text-sm opacity-70">São Paulo, SP</span>
          </div>
          <Button variante="principal" tamanho="md" className="shrink-0">
            Pesquisar
          </Button>
        </div>
      </section>

      {/* Destaques das barbearias (Demonstração pública de marketplace) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Barbearias em destaque</h2>
            <p className="text-sm opacity-70">
              Disponibilidade imediata para você escolher sem complicação
            </p>
          </div>
          <Link
            href="/cadastro"
            className="text-sm font-medium text-[#B45A2B] hover:underline"
          >
            Criar conta
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              nome: "Barbearia Dom Lucas",
              avaliacao: 4.9,
              bairro: "Pinheiros",
              distancia: "1.2 km",
            },
            {
              nome: "Viking Barber Club",
              avaliacao: 4.8,
              bairro: "Vila Mariana",
              distancia: "2.5 km",
            },
            {
              nome: "The Classic Cut",
              avaliacao: 5.0,
              bairro: "Itaim Bibi",
              distancia: "3.1 km",
            },
          ].map((barbearia, i) => (
            <Card key={i} camada="primaria" className="hover:border-[#B45A2B]/50 transition-colors">
              <div className="h-40 bg-[#EEEEF0] dark:bg-[#1C1C1F] rounded-t-xl flex items-center justify-center relative">
                <Scissors className="h-10 w-10 opacity-30 text-[#B45A2B]" />
                <span className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 font-semibold">
                  <Star className="h-3.5 w-3.5 text-[#EAB308] fill-[#EAB308]" />
                  {barbearia.avaliacao}
                </span>
              </div>
              <CardContent className="p-5 flex flex-col gap-3">
                <div>
                  <h3 className="text-lg font-bold">{barbearia.nome}</h3>
                  <p className="text-xs opacity-70 flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {barbearia.bairro} • {barbearia.distancia}
                  </p>
                </div>
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#16A34A] flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Hoje às 15:00
                  </span>
                  <Button variante="principal" tamanho="sm">
                    Ver horários
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
