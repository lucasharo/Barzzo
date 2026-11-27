import * as React from "react";
import { useNavigate } from "react-router-dom";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { ehAppNativo } from "@barzzo/utilitarios";
import { iniciarRuntimeNativo } from "./runtime";
import {
  eventoPushNativoAlterado,
  pushNativoAtivo,
  registrarPush,
  salvarTokenPushNativo,
} from "./push";

export interface RuntimeNativoProps {
  /** Host do link profundo: barzzo://<host>/caminho. */
  esquemaHost: string;
  /** Rotas em que o botão voltar fecha o app. */
  rotasRaiz: string[];
}

/**
 * Monte uma vez dentro do <BrowserRouter>. No app Android liga barra de status, tela de abertura, botão voltar,
 * links profundos e o registro de push do usuário logado (tabela `dispositivos`). No navegador não renderiza nada.
 */
export function RuntimeNativo({ esquemaHost, rotasRaiz }: RuntimeNativoProps) {
  const navigate = useNavigate();
  const navegarRef = React.useRef(navigate);
  navegarRef.current = navigate;
  const chaveRotasRaiz = rotasRaiz.join("|");

  React.useEffect(() => {
    if (!ehAppNativo()) return;
    let desfazer: (() => void) | undefined;
    let cancelado = false;
    iniciarRuntimeNativo({
      esquemaHost,
      rotasRaiz: chaveRotasRaiz.split("|"),
      navegar: (caminho) => navegarRef.current(caminho),
    }).then((funcao) => {
      if (cancelado) funcao();
      else desfazer = funcao;
    });
    return () => {
      cancelado = true;
      desfazer?.();
    };
  }, [esquemaHost, chaveRotasRaiz]);

  React.useEffect(() => {
    if (!ehAppNativo()) return;
    const supabase = criarClienteSupabaseBrowser();
    let usuarioRegistrado: string | null = null;
    let usuarioAtual: string | null = null;
    let removerPush: (() => void) | undefined;
    let cancelado = false;

    const iniciarPush = (usuarioId: string) => {
      if (!pushNativoAtivo()) return;
      if (usuarioRegistrado === usuarioId) return;
      removerPush?.();
      usuarioRegistrado = usuarioId;
      registrarPush({
        salvarToken: async (token, plataforma) => {
          salvarTokenPushNativo(token);
          const { error } = await supabase.from("dispositivos").upsert(
            {
              usuario_id: usuarioId,
              fcm_token: token,
              plataforma,
              ativo: true,
              ultimo_acesso_em: new Date().toISOString(),
            } as never,
            { onConflict: "usuario_id,fcm_token" }
          );
          if (error) throw error;
        },
        aoAbrirNotificacao: (link) => {
          if (link && link.startsWith("/")) navegarRef.current(link);
        },
      }).then((funcao) => {
        if (cancelado) funcao();
        else removerPush = funcao;
      }).catch((erro: unknown) => {
        usuarioRegistrado = null;
        const codigo = erro && typeof erro === "object" && "code" in erro ? String(erro.code) : "sem código";
        console.error("Falha ao configurar as notificações push", codigo);
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        usuarioAtual = data.session.user.id;
        iniciarPush(data.session.user.id);
      }
    });
    const aoAlterarPush = (evento: Event) => {
      const ativo = (evento as CustomEvent<{ ativo: boolean }>).detail?.ativo;
      if (ativo && usuarioAtual) {
        usuarioRegistrado = null;
        iniciarPush(usuarioAtual);
      } else if (!ativo) {
        removerPush?.();
        removerPush = undefined;
        usuarioRegistrado = null;
      }
    };
    window.addEventListener(eventoPushNativoAlterado, aoAlterarPush);
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao) {
        usuarioAtual = sessao.user.id;
        iniciarPush(sessao.user.id);
      }
      else {
        usuarioAtual = null;
        removerPush?.();
        removerPush = undefined;
        usuarioRegistrado = null;
      }
    });

    return () => {
      cancelado = true;
      window.removeEventListener(eventoPushNativoAlterado, aoAlterarPush);
      assinatura.subscription.unsubscribe();
      removerPush?.();
    };
  }, []);

  return null;
}
