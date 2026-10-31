"use client";

import * as React from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  LoadingSpinner,
  Modal,
  Seletor,
  Switch,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import { Award, Check, Pencil, X } from "lucide-react";

type StatusAprovacao = "pendente" | "aprovado" | "rejeitado";

interface InfluenciadorGlobal {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  chave_pix: string | null;
  tipo_comissao: "percentual" | "valor_fixo";
  valor_comissao: number;
  ativo: boolean;
  cupom_id: string | null;
  codigo: string | null;
  status_aprovacao: StatusAprovacao | null;
  desconto_primeiro: number;
  desconto_demais: number;
}

const ROTULO_STATUS: Record<StatusAprovacao, string> = {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Recusado",
};

const CLASSE_STATUS: Record<StatusAprovacao, string> = {
  pendente: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  aprovado: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20",
  rejeitado: "bg-red-500/10 text-red-600 border-red-500/20",
};

function formatarComissao(tipo: string, valor: number) {
  return tipo === "percentual" ? `${valor}%` : `R$ ${Number(valor).toFixed(2)}`;
}

export default function PaginaInfluenciadoresAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [influenciadores, setInfluenciadores] = React.useState<any[]>([]);
  const [globais, setGlobais] = React.useState<InfluenciadorGlobal[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [decidindo, setDecidindo] = React.useState<string | null>(null);

  const [emEdicao, setEmEdicao] = React.useState<InfluenciadorGlobal | null>(null);
  const [tipoComissao, setTipoComissao] = React.useState<"percentual" | "valor_fixo">("percentual");
  const [valorComissao, setValorComissao] = React.useState("");
  const [descontoPrimeiro, setDescontoPrimeiro] = React.useState("");
  const [descontoDemais, setDescontoDemais] = React.useState("");
  const [ativo, setAtivo] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [erroModal, setErroModal] = React.useState<string | null>(null);

  const carregar = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser("admin");

      const { data: infDb, error: erroDb } = await (supabase.from("influenciadores") as any)
        .select("*, barbearias(nome)")
        .order("created_at", { ascending: false });
      if (erroDb) throw erroDb;

      const todos = infDb || [];
      const locais = todos.filter((i: any) => i.barbearia_id);
      const globaisDb = todos.filter((i: any) => !i.barbearia_id);
      setInfluenciadores(locais);

      if (globaisDb.length === 0) {
        setGlobais([]);
        return;
      }

      const ids = globaisDb.map((i: any) => i.id);
      const { data: cuponsDb, error: erroCupons } = await (supabase.from("cupons") as any)
        .select("id, codigo, status_aprovacao, influenciador_id, created_at")
        .eq("origem", "BARZZO_GLOBAL")
        .in("influenciador_id", ids)
        .order("created_at", { ascending: true });
      if (erroCupons) throw erroCupons;

      const cupomPorInfluenciador = new Map<string, any>();
      for (const c of cuponsDb || []) {
        if (!cupomPorInfluenciador.has(c.influenciador_id)) cupomPorInfluenciador.set(c.influenciador_id, c);
      }

      const cupomIds = Array.from(cupomPorInfluenciador.values()).map((c) => c.id);
      const { data: regrasDb, error: erroRegras } = cupomIds.length
        ? await (supabase.from("cupons_regras") as any)
            .select("cupom_id, atendimentos_minimos, atendimentos_maximos, valor_desconto")
            .in("cupom_id", cupomIds)
        : { data: [], error: null };
      if (erroRegras) throw erroRegras;

      const descontoDaFaixa = (cupomId: string, minimo: number, maximo: number | null, padrao: number) => {
        const regra = (regrasDb || []).find(
          (r: any) =>
            r.cupom_id === cupomId && r.atendimentos_minimos === minimo && (r.atendimentos_maximos ?? null) === maximo
        );
        return regra ? Number(regra.valor_desconto) : padrao;
      };

      setGlobais(
        globaisDb.map((i: any) => {
          const cupom = cupomPorInfluenciador.get(i.id);
          return {
            id: i.id,
            nome: i.nome,
            email: i.email,
            telefone: i.telefone,
            chave_pix: i.chave_pix,
            tipo_comissao: i.tipo_comissao,
            valor_comissao: Number(i.valor_comissao),
            ativo: i.ativo,
            cupom_id: cupom?.id ?? null,
            codigo: cupom?.codigo ?? null,
            status_aprovacao: cupom?.status_aprovacao ?? null,
            desconto_primeiro: cupom ? descontoDaFaixa(cupom.id, 0, 0, 15) : 15,
            desconto_demais: cupom ? descontoDaFaixa(cupom.id, 1, null, 5) : 5,
          } as InfluenciadorGlobal;
        })
      );
    } catch {
      setErro("Não foi possível carregar os influenciadores parceiros.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(inf: InfluenciadorGlobal, aprovar: boolean) {
    if (!inf.cupom_id) return;
    try {
      setDecidindo(inf.id);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser("admin");
      const { error } = await (supabase.rpc as any)("admin_decidir_cupom_global", {
        p_cupom_id: inf.cupom_id,
        p_aprovar: aprovar,
      });
      if (error) {
        setErro(traduzirErro(error, "Não foi possível registrar a decisão."));
        return;
      }
      setSucesso(aprovar ? `Cupom ${inf.codigo} aprovado.` : `Cupom ${inf.codigo} recusado.`);
      await carregar();
    } catch {
      setErro("Erro de conexão ao registrar a decisão.");
    } finally {
      setDecidindo(null);
    }
  }

  function abrirEdicao(inf: InfluenciadorGlobal) {
    setEmEdicao(inf);
    setTipoComissao(inf.tipo_comissao);
    setValorComissao(String(inf.valor_comissao));
    setDescontoPrimeiro(String(inf.desconto_primeiro));
    setDescontoDemais(String(inf.desconto_demais));
    setAtivo(inf.ativo);
    setErroModal(null);
  }

  async function salvarEdicao(evento: React.FormEvent) {
    evento.preventDefault();
    if (!emEdicao) return;

    const numero = (valor: string) => parseFloat(valor.replace(",", "."));
    const comissao = numero(valorComissao);
    const primeiro = numero(descontoPrimeiro);
    const demais = numero(descontoDemais);

    if (Number.isNaN(comissao) || comissao < 0 || (tipoComissao === "percentual" && comissao > 100)) {
      setErroModal("Informe uma comissão válida.");
      return;
    }
    if ([primeiro, demais].some((d) => Number.isNaN(d) || d <= 0 || d > 100)) {
      setErroModal("Os descontos devem ficar entre 0,01% e 100%.");
      return;
    }

    try {
      setSalvando(true);
      setErroModal(null);
      const supabase = criarClienteSupabaseBrowser("admin");
      const { error } = await (supabase.rpc as any)("admin_atualizar_influenciador_global", {
        p_influenciador_id: emEdicao.id,
        p_tipo_comissao: tipoComissao,
        p_valor_comissao: comissao,
        p_desconto_primeiro: primeiro,
        p_desconto_demais: demais,
        p_ativo: ativo,
      });
      if (error) {
        setErroModal(traduzirErro(error, "Não foi possível salvar as alterações."));
        return;
      }
      setSucesso(`Influenciador ${emEdicao.nome} atualizado.`);
      setEmEdicao(null);
      await carregar();
    } catch {
      setErroModal("Erro de conexão ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const pendentes = globais.filter((g) => g.status_aprovacao === "pendente").length;

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      {sucesso && (
        <Alert variante="sucesso">
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Rede de Influenciadores</h1>
        <p className="text-sm opacity-70 mt-1">
          Influenciadores do Barzzo (aceitos pelas barbearias) e promotores cadastrados pelas barbearias.
        </p>
      </div>

      {/* Influenciadores do Barzzo */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-[#B45A2B]" />
          <h2 className="text-lg font-bold">Influenciadores do Barzzo</h2>
          {pendentes > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 border-amber-500/20">
              {pendentes} aguardando aprovação
            </span>
          )}
        </div>
        <p className="text-xs opacity-60">
          Cada um cria o próprio cupom, que nasce com 5% de comissão e só vale depois de aprovado. O cliente ganha 15% no
          primeiro atendimento e 5% nos demais, e a comissão é paga pela barbearia que aceitou os influenciadores do Barzzo.
          Você pode alterar a comissão, os descontos e a situação de cada um.
        </p>

        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                  <tr>
                    <th className="p-4">Influenciador</th>
                    <th className="p-4">Cupom</th>
                    <th className="p-4">Situação</th>
                    <th className="p-4">Comissão</th>
                    <th className="p-4">Desconto (1º / demais)</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {carregando ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                        <span className="text-xs opacity-60">Carregando influenciadores...</span>
                      </td>
                    </tr>
                  ) : globais.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center opacity-60">
                        Nenhum influenciador do Barzzo cadastrado ainda.
                      </td>
                    </tr>
                  ) : (
                    globais.map((inf) => (
                      <tr key={inf.id} className="hover:bg-neutral-500/5">
                        <td className="p-4">
                          <span className="font-bold block">{inf.nome}</span>
                          <span className="text-[11px] opacity-60">{inf.email || inf.telefone || "Sem contato"}</span>
                          <span className="text-[11px] opacity-60 block">Pix: {inf.chave_pix || "Não informada"}</span>
                        </td>
                        <td className="p-4 font-mono font-bold text-[#B45A2B]">{inf.codigo || "Sem cupom"}</td>
                        <td className="p-4">
                          {inf.status_aprovacao ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${CLASSE_STATUS[inf.status_aprovacao]}`}
                            >
                              {ROTULO_STATUS[inf.status_aprovacao]}
                            </span>
                          ) : (
                            <span className="opacity-60">-</span>
                          )}
                          {!inf.ativo && <span className="block text-[11px] opacity-60 mt-1">Desativado</span>}
                        </td>
                        <td className="p-4 font-medium">{formatarComissao(inf.tipo_comissao, inf.valor_comissao)}</td>
                        <td className="p-4">
                          {inf.desconto_primeiro}% / {inf.desconto_demais}%
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {inf.cupom_id && inf.status_aprovacao !== "aprovado" && (
                              <Button
                                type="button"
                                tamanho="sm"
                                variante="principal"
                                className="gap-1"
                                disabled={decidindo === inf.id}
                                onClick={() => decidir(inf, true)}
                              >
                                <Check className="w-3.5 h-3.5" />
                                Aprovar
                              </Button>
                            )}
                            {inf.cupom_id && inf.status_aprovacao === "pendente" && (
                              <Button
                                type="button"
                                tamanho="sm"
                                variante="secundario"
                                className="gap-1"
                                disabled={decidindo === inf.id}
                                onClick={() => decidir(inf, false)}
                              >
                                <X className="w-3.5 h-3.5" />
                                Recusar
                              </Button>
                            )}
                            <Button
                              type="button"
                              tamanho="sm"
                              variante="fantasma"
                              className="gap-1 border border-[#B45A2B]/30"
                              onClick={() => abrirEdicao(inf)}
                              aria-label={`Editar ${inf.nome}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Promotores das barbearias */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Promotores das barbearias</h2>
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                  <tr>
                    <th className="p-4">Parceiro</th>
                    <th className="p-4">Barbearia</th>
                    <th className="p-4">Comissão</th>
                    <th className="p-4">Cliques</th>
                    <th className="p-4">Chave Pix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {carregando ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                        <span className="text-xs opacity-60">Carregando parceiros...</span>
                      </td>
                    </tr>
                  ) : influenciadores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center opacity-60">
                        Nenhum promotor cadastrado pelas barbearias.
                      </td>
                    </tr>
                  ) : (
                    influenciadores.map((inf) => (
                      <tr key={inf.id} className="hover:bg-neutral-500/5">
                        <td className="p-4 font-bold">{inf.nome}</td>
                        <td className="p-4 opacity-75">{inf.barbearias?.nome || "Barbearia"}</td>
                        <td className="p-4 font-medium">{formatarComissao(inf.tipo_comissao, inf.valor_comissao)}</td>
                        <td className="p-4 font-bold">{inf.cliques_rastreados || 0}</td>
                        <td className="p-4 opacity-75">{inf.chave_pix || "Não informada"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Modal
        aberto={!!emEdicao}
        aoFechar={() => (salvando ? undefined : setEmEdicao(null))}
        titulo={emEdicao ? `Editar ${emEdicao.nome}` : undefined}
        descricao="As alterações valem para os próximos atendimentos; os já agendados mantêm as condições da reserva."
        posicao="centralizado"
      >
        <form onSubmit={salvarEdicao} className="flex flex-col gap-4">
          {erroModal && (
            <Alert variante="erro">
              <AlertDescription>{erroModal}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo-comissao">Tipo de comissão</Label>
              <Seletor
                id="tipo-comissao"
                valor={tipoComissao}
                aoMudar={(valor) => setTipoComissao(valor as typeof tipoComissao)}
                opcoes={[
                  { valor: "percentual", rotulo: "Percentual (%)" },
                  { valor: "valor_fixo", rotulo: "Valor fixo (R$)" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-comissao">Comissão ({tipoComissao === "percentual" ? "%" : "R$"})</Label>
              <Input
                id="valor-comissao"
                inputMode="decimal"
                value={valorComissao}
                onChange={(e) => setValorComissao(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desconto-primeiro">Desconto no 1º atendimento (%)</Label>
              <Input
                id="desconto-primeiro"
                inputMode="decimal"
                value={descontoPrimeiro}
                onChange={(e) => setDescontoPrimeiro(e.target.value)}
                disabled={salvando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desconto-demais">Desconto nos demais (%)</Label>
              <Input
                id="desconto-demais"
                inputMode="decimal"
                value={descontoDemais}
                onChange={(e) => setDescontoDemais(e.target.value)}
                disabled={salvando}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5 min-h-[44px]">
            <Switch marcado={ativo} aoMudar={setAtivo} disabled={salvando} aria-label="Influenciador ativo" />
            <div>
              <span className="text-sm font-bold block">Ativo</span>
              <span className="text-xs opacity-60">
                {ativo ? "O cupom pode ser usado nas barbearias que aceitaram" : "O cupom fica bloqueado em todas as barbearias"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button type="button" variante="fantasma" className="gap-1.5" onClick={() => setEmEdicao(null)} disabled={salvando}>
              <X className="w-4 h-4" />
              Cancelar
            </Button>
            <Button type="submit" variante="principal" className="gap-1.5" disabled={salvando}>
              {salvando ? (
                <>
                  <LoadingSpinner tamanho="sm" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
