"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  NOMES_DIAS_SEMANA,
  type Barbearia,
  type Servico,
  type Profissional,
  type HorarioBarbearia,
  type DiaSemana,
} from "@barzzo/tipos";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Scissors,
  User,
  Star,
  Calendar,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";

export default function PaginaPerfilPublicoBarbearia() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [servicos, setServicos] = React.useState<Servico[]>([]);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [horarios, setHorarios] = React.useState<HorarioBarbearia[]>([]);

  React.useEffect(() => {
    carregarPerfil();
  }, [slug]);

  async function carregarPerfil() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      // 1. Barbearia por slug
      const { data: bDb, error: erroB } = await supabase
        .from("barbearias")
        .select("*")
        .eq("slug", slug)
        .eq("ativa", true)
        .single();

      if (erroB || !bDb) {
        setBarbearia(null);
        return;
      }

      const barb = bDb as Barbearia;
      setBarbearia(barb);

      // 2. Serviços ativos da barbearia
      const { data: sDb } = await supabase
        .from("servicos")
        .select("*")
        .eq("barbearia_id", barb.id)
        .eq("ativo", true)
        .order("preco", { ascending: true });

      setServicos((sDb || []) as Servico[]);

      // 3. Profissionais da barbearia
      const { data: pDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", barb.id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      setProfissionais((pDb || []) as Profissional[]);

      // 4. Horários de funcionamento
      const { data: hDb } = await supabase
        .from("horarios_barbearia")
        .select("*")
        .eq("barbearia_id", barb.id)
        .order("dia_semana", { ascending: true });

      setHorarios((hDb || []) as HorarioBarbearia[]);
    } catch {
      // Silencioso
    } finally {
      setCarregando(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando perfil da barbearia...</p>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center flex flex-col items-center gap-4">
        <Scissors className="h-12 w-12 text-[#B45A2B] opacity-40" />
        <h2 className="text-2xl font-bold">Barbearia não encontrada</h2>
        <p className="text-sm opacity-70">
          O estabelecimento que você está procurando não existe ou não está mais ativo no Barzzo.
        </p>
        <Link href="/barbearias">
          <Button variante="secundario">Explorar outras barbearias</Button>
        </Link>
      </div>
    );
  }

  const hojeIndex = new Date().getDay() as DiaSemana;
  const horarioHoje = horarios.find((h) => h.dia_semana === hojeIndex);

  return (
    <div className="flex flex-col gap-8 py-4">
      <Link
        href="/barbearias"
        className="text-sm font-semibold opacity-70 hover:opacity-100 flex items-center gap-1.5 self-start transition-opacity"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Barbearias
      </Link>

      {/* Banner / Header da Barbearia */}
      <div className="relative rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 overflow-hidden p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-start md:items-center gap-5">
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-[#B45A2B]/10 border border-[#B45A2B]/20 flex items-center justify-center text-[#B45A2B] shrink-0 overflow-hidden font-bold text-2xl">
            {barbearia.logo_url ? (
              <img src={barbearia.logo_url} alt={barbearia.nome} className="w-full h-full object-cover" />
            ) : (
              barbearia.nome.slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-extrabold">{barbearia.nome}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-semibold border border-[#16A34A]/20">
                Ativa no Barzzo
              </span>
            </div>

            <p className="text-sm opacity-75 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#B45A2B] shrink-0" />
              {barbearia.endereco ? `${barbearia.endereco}, ` : ""}
              {barbearia.bairro ? `${barbearia.bairro} — ` : ""}
              {barbearia.cidade}/{barbearia.estado}
            </p>

            {barbearia.telefone && (
              <p className="text-xs opacity-70 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#B45A2B]" /> {barbearia.telefone}
              </p>
            )}
          </div>
        </div>

        {/* CTA Principal de Agendamento */}
        <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-2.5 shrink-0">
          <Link href={`/reservar/${barbearia.slug}`}>
            <Button variante="principal" tamanho="lg" className="w-full text-base font-bold shadow-md">
              <Calendar className="h-5 w-5 mr-2" /> Agendar Horário Agora
            </Button>
          </Link>
          {horarioHoje ? (
            <span className="text-xs text-center opacity-75 flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#16A34A]" />
              Hoje: {horarioHoje.ativo ? `${horarioHoje.hora_abertura.slice(0, 5)} às ${horarioHoje.hora_fechamento.slice(0, 5)}` : "Fechado"}
            </span>
          ) : (
            <span className="text-xs text-center opacity-50">Consulte horários da semana</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Catálogo de Serviços (Coluna Principal) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Serviços Disponíveis</h2>
              <p className="text-sm opacity-70">
                Escolha o serviço desejado para agendar diretamente com a equipe.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800">
              {servicos.length} {servicos.length === 1 ? "serviço" : "serviços"}
            </span>
          </div>

          {servicos.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed text-center text-sm opacity-70">
              Nenhum serviço disponível no momento.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {servicos.map((servico) => (
                <Card
                  key={servico.id}
                  camada="primaria"
                  className="hover:border-[#B45A2B]/40 transition-colors"
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] shrink-0">
                        <Scissors className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-bold text-base">{servico.nome}</h3>
                        {servico.descricao && (
                          <p className="text-xs opacity-70 mt-0.5 line-clamp-2">
                            {servico.descricao}
                          </p>
                        )}
                        <span className="text-xs opacity-60 mt-1 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[#B45A2B]" />
                          Duração: {servico.duracao_minutos} minutos
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-200 dark:border-neutral-800">
                      <span className="text-lg font-extrabold text-[#B45A2B]">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(servico.preco))}
                      </span>

                      <Link href={`/reservar/${barbearia.slug}?servico_id=${servico.id}`}>
                        <Button variante="principal" tamanho="sm">
                          Escolher
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Equipe de Profissionais */}
          <div className="flex flex-col gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h2 className="text-xl font-bold">Equipe de Barbeiros</h2>
            {profissionais.length === 0 ? (
              <p className="text-sm opacity-60">Nenhum barbeiro listado.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {profissionais.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs shrink-0">
                      {p.foto_url ? (
                        <img src={p.foto_url} alt={p.nome} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        p.nome.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-sm font-bold truncate">{p.nome}</span>
                      <span className="text-[11px] opacity-60">Barbeiro Oficial</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grade de Horários e Localização (Coluna Lateral) */}
        <div className="flex flex-col gap-6">
          <Card camada="primaria">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#B45A2B]" /> Horários de Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60 text-xs">
              {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                const h = horarios.find((item) => item.dia_semana === dia);
                const nomeDia = NOMES_DIAS_SEMANA[dia as DiaSemana];
                const ehHoje = dia === hojeIndex;

                return (
                  <div
                    key={dia}
                    className={`py-2 flex items-center justify-between ${
                      ehHoje ? "font-bold text-[#B45A2B]" : "opacity-80"
                    }`}
                  >
                    <span>{nomeDia} {ehHoje && "(Hoje)"}</span>
                    {h && h.ativo ? (
                      <span>{h.hora_abertura.slice(0, 5)} - {h.hora_fechamento.slice(0, 5)}</span>
                    ) : (
                      <span className="opacity-50">Fechado</span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Card de Agendamento Rápido */}
          <Card camada="primaria" className="border-l-4 border-l-[#B45A2B]">
            <CardContent className="p-5 flex flex-col gap-3">
              <h4 className="font-bold text-sm">Reserva sem Fricção</h4>
              <p className="text-xs opacity-75">
                Você pode selecionar os serviços e horários livremente. A autenticação é solicitada apenas antes da confirmação final.
              </p>
              <Link href={`/reservar/${barbearia.slug}`}>
                <Button variante="principal" tamanho="sm" className="w-full mt-1">
                  Agendar Online <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
