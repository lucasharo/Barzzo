import * as React from "react";
import {
  ouvirPushWebEmPrimeiroPlano,
  type ConfiguracaoFirebaseWeb,
} from "./push-web";

interface PropsOuvintePushWeb {
  config: ConfiguracaoFirebaseWeb;
}

export function OuvintePushWeb({ config }: PropsOuvintePushWeb) {
  React.useEffect(() => {
    let desmontado = false;
    let geracao = 0;
    let removerOuvinte: (() => void) | null = null;

    const iniciarOuvinte = () => {
      const tentativa = ++geracao;
      void ouvirPushWebEmPrimeiroPlano(config)
        .then((remover) => {
          if (desmontado || tentativa !== geracao) {
            remover();
            return;
          }
          removerOuvinte?.();
          removerOuvinte = remover;
        })
        .catch((erro: unknown) => {
          const codigo =
            erro && typeof erro === "object" && "code" in erro && typeof erro.code === "string"
              ? erro.code
              : "erro desconhecido";
          console.error("Não foi possível iniciar o recebimento de notificações em primeiro plano", codigo);
        });
    };

    iniciarOuvinte();
    window.addEventListener("barzzo:push-web-ativado", iniciarOuvinte);

    return () => {
      desmontado = true;
      geracao += 1;
      removerOuvinte?.();
      window.removeEventListener("barzzo:push-web-ativado", iniciarOuvinte);
    };
  }, [config.apiKey, config.authDomain, config.projectId, config.messagingSenderId, config.appId]);

  return null;
}
