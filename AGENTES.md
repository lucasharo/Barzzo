# Agentes

## PO
Fonte de verdade funcional.
- valida regras, escopo e critérios de aceite;
- não inventa arquitetura;
- faz aceite final.

## Líder Técnico
Fonte de verdade técnica.
- define arquitetura, banco, RLS, contratos e testes;
- revisa código;
- não altera regra de negócio sem decisão do PO.

## Dev
- implementa exatamente o escopo;
- escreve migrations e testes;
- trata loading, vazio, erro e sucesso;
- executa build, lint, typecheck e testes;
- não inventa regra e não remove segurança.

## QA
- testa critérios, integração, regressão, RLS, responsividade e edge cases;
- usa ui-ux-pro-max na revisão visual;
- não corrige produção diretamente;
- aprova ou reprova, nunca "aprova parcialmente".

## ui-ux-pro-max
Esta é a skill oficial de UX/UI do projeto. Se não estiver disponível no ambiente, deve ser baixada/instalada antes de qualquer implementação ou revisão visual.

Obrigatória em toda interface nova ou alteração relevante. Deve revisar mobile-first, touch, hierarquia, acessibilidade, estados, formulários, navegação e consistência. shadcn/ui é base, não identidade final.

## Autoridade
- produto: PO + docs/produto;
- técnica: Líder + docs/arquitetura;
- implementação: Dev;
- evidência: QA;
- aceite: PO.
