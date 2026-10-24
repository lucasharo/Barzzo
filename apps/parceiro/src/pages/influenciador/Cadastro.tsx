import * as React from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  InputMascarado,
  Label,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { formatarTelefone, limparTelefone, traduzirErro } from "@barzzo/utilitarios";
import { Award } from "lucide-react";

const RETORNO = encodeURIComponent("/influenciador/cadastro");

/** Cadastro próprio do influenciador do Barzzo: cria o perfil e pede o cupom, que o Admin precisa aprovar. */
export default function PaginaCadastroInfluenciador() {
  const navigate = useNavigate();
  const [situacao, setSituacao] = React.useState<"verificando" | "visitante" | "formulario" | "cadastrado">("verificando");
  const [nome, setNome] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [chavePix, setChavePix] = React.useState("");
  const [cupom, setCupom] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const supabase = criarClienteSupabaseBrowser();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (ativo) setSituacao("visitante");
          return;
        }
        const { data: existente } = await (supabase.from("influenciadores") as any)
          .select("id")
          .eq("usuario_id", data.session.user.id)
          .is("barbearia_id", null)
          .maybeSingle();
        if (ativo) setSituacao(existente ? "cadastrado" : "formulario");
      } catch {
        if (ativo) setSituacao("visitante");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    const codigo = cupom.replace(/\s/g, "").toUpperCase();
    if (nome.trim().length < 2) {
      setErro("Informe seu nome.");
      return;
    }
    if (!/^[A-Z0-9]{4,20}$/.test(codigo)) {
      setErro("O cupom deve ter de 4 a 20 letras ou números, sem espaços ou símbolos.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await (supabase.rpc as any)("cadastrar_influenciador_barzzo", {
        p_nome: nome.trim(),
        p_telefone: limparTelefone(telefone) || null,
        p_chave_pix: chavePix.trim() || null,
        p_codigo: codigo,
      });
      if (error) {
        setErro(traduzirErro(error, "Não foi possível concluir o cadastro. Tente novamente."));
        return;
      }
      navigate("/influenciador/painel");
    } catch {
      setErro("Ocorreu um erro ao concluir o cadastro. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  if (situacao === "verificando") {
    return (
      <div className="py-24 flex justify-center">
        <LoadingSpinner tamanho="lg" />
      </div>
    );
  }

  if (situacao === "cadastrado") return <Navigate to="/influenciador/painel" replace />;

  return (
    <div className="flex-1 flex items-center justify-center py-10 px-4">
      <Card camada="primaria" className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Award className="h-10 w-10 text-[#B45A2B]" />
          </div>
          <CardTitle className="text-2xl">Seja influenciador do Barzzo</CardTitle>
          <CardDescription>
            Divulgue seu cupom e ganhe 5% de comissão sobre cada atendimento concluído nas barbearias parceiras. Seus
            seguidores ganham 15% no primeiro atendimento e 5% nos demais.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {situacao === "visitante" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm opacity-75 text-center">Para continuar, entre ou crie sua conta.</p>
              <Link to={`/cadastro?retorno=${RETORNO}`}>
                <Button variante="principal" className="w-full min-h-[44px]">
                  Criar minha conta
                </Button>
              </Link>
              <Link to={`/entrar?retorno=${RETORNO}`}>
                <Button variante="secundario" className="w-full min-h-[44px]">
                  Já tenho conta
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-4">
              {erro && (
                <Alert variante="erro">
                  <AlertDescription>{erro}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nome-influenciador">Nome</Label>
                <Input
                  id="nome-influenciador"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como você é conhecido"
                  disabled={salvando}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefone-influenciador">WhatsApp</Label>
                <InputMascarado
                  id="telefone-influenciador"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={telefone}
                  mascara={formatarTelefone}
                  onChangeValor={setTelefone}
                  disabled={salvando}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pix-influenciador">Chave Pix para receber</Label>
                <Input
                  id="pix-influenciador"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  disabled={salvando}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cupom-influenciador">Seu cupom</Label>
                <Input
                  id="cupom-influenciador"
                  value={cupom}
                  onChange={(e) => setCupom(e.target.value.toUpperCase())}
                  placeholder="EX: JOAO10"
                  maxLength={20}
                  className="font-mono uppercase"
                  disabled={salvando}
                  required
                />
                <p className="text-xs opacity-60">
                  De 4 a 20 letras ou números. O cupom só passa a valer depois da aprovação do Barzzo.
                </p>
              </div>

              <Button type="submit" variante="principal" className="w-full min-h-[44px]" disabled={salvando}>
                {salvando ? "Enviando..." : "Enviar para aprovação"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
