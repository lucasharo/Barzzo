import { Link } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@barzzo/ui";
import { Store, Users, Calendar, ArrowRight, LogIn, CheckCircle2 } from "lucide-react";

export default function PaginaInicialParceiro() {
  return (
    <div className="flex flex-col gap-10 py-4">
      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-4 py-8 max-w-2xl mx-auto">
        <Store className="h-16 w-16 text-[#B45A2B]" />
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Gestão Profissional para sua Barbearia
        </h1>
        <p className="text-base opacity-75 max-w-lg">
          Controle sua agenda em tempo real, automatize agendamentos dos clientes, gerencie comissões da equipe e aumente seu faturamento.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center pt-3">
          <Link to="/onboarding" className="w-full sm:w-auto">
            <Button variante="principal" tamanho="lg" className="w-full gap-2 min-h-[48px]">
              Cadastrar Minha Barbearia <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/entrar" className="w-full sm:w-auto">
            <Button variante="secundario" tamanho="lg" className="w-full gap-2 min-h-[48px]">
              <LogIn className="h-5 w-5" /> Acessar Minha Conta
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#16A34A] pt-1">
          <CheckCircle2 className="h-4 w-4" />
          <span>30 dias de trial gratuito sem necessidade de cartão</span>
        </div>
      </section>

      {/* Papéis e Recursos */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card camada="primaria">
          <CardHeader>
            <Store className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Dono de Barbearia</CardTitle>
            <CardDescription>
              Gestão de equipe, catálogo de serviços, produtos no balcão, métricas de faturamento e cupons.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-[#B45A2B]/10 text-[#B45A2B] font-semibold">
              Painel Completo
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader>
            <Calendar className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Profissional / Barbeiro</CardTitle>
            <CardDescription>
              Agenda simplificada, gestão de atendimentos do dia, início/término de cortes e bloqueios de intervalo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-[#B45A2B]/10 text-[#B45A2B] font-semibold">
              Agenda do Profissional
            </span>
          </CardContent>
        </Card>

        <Card camada="primaria">
          <CardHeader>
            <Users className="h-6 w-6 text-[#B45A2B] mb-2" />
            <CardTitle className="text-lg">Gerente e Recepção</CardTitle>
            <CardDescription>
              Operações diárias, encaixe de clientes presenciais, confirmação de fila e organização do espaço.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs px-2.5 py-1 rounded bg-[#B45A2B]/10 text-[#B45A2B] font-semibold">
              Controle Operacional
            </span>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
