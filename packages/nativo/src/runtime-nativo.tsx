import * as React from "react";
import { useNavigate } from "react-router-dom";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { ehAppNativo } from "@barzzo/utilitarios";
import { iniciarRuntimeNativo } from "./runtime";
import { registrarPush } from "./push";

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
    let removerPush: (() => void) | undefined;
    let cancelado = false;

    const iniciarPush = (usuarioId: string) => {
      if (usuarioRegistrado === usuarioId) return;
      removerPush?.();
      usuarioRegistrado = usuarioId;
      registrarPush({
        salvarToken: async (token, plataforma) => {
          await supabase.from("dispositivos").upsert(
            {
              usuario_id: usuarioId,
              fcm_token: token,
              plataforma,
              ativo: true,
              ultimo_acesso_em: new Date().toISOString(),
            } as never,
            { onConflict: "usuario_id,fcm_token" }
          );
        },
        aoAbrirNotificacao: (link) => {
          if (link && link.startsWith("/")) navegarRef.current(link);
        },
      }).then((funcao) => {
        if (cancelado) funcao();
        else removerPush = funcao;
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) iniciarPush(data.session.user.id);
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao) iniciarPush(sessao.user.id);
      else {
        removerPush?.();
        removerPush = undefined;
        usuarioRegistrado = null;
      }
    });

    return () => {
      cancelado = true;
      assinatura.subscription.unsubscribe();
      removerPush?.();
    };
  }, []);

  return null;
}
