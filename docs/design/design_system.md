# Design System — Barzzo

Este documento define a base visual oficial do Barzzo. Toda interface deve seguir estes tokens e regras. Alterações exigem decisão explícita de produto/design.

## Tipografia

Fonte oficial: **Roboto**.

Pesos permitidos:
- 400 Regular
- 500 Medium
- 600 SemiBold, quando disponível
- 700 Bold

A hierarquia textual deve ser criada por **tamanho e peso**, não por diferentes cores de texto.

## Regra de cor de texto

Existe apenas uma cor-base de texto por tema:

- Tema claro: texto preto `#000000`
- Tema escuro: texto branco `#FFFFFF`

Não criar uma paleta própria de cinzas para textos.

Quando necessário diferenciar hierarquia, usar tamanho, peso e, somente quando justificado, opacidade da mesma cor-base.

## Tema claro

| Token | Uso | Cor |
|---|---|---|
| `--fundo` | fundo geral | `#FFFFFF` |
| `--card-primario` | cards principais | `#F6F6F7` |
| `--card-secundario` | cards internos/secundários | `#EEEEF0` |
| `--card-terciario` | inputs, blocos internos e áreas elevadas | `#E5E5E8` |
| `--texto` | todo texto | `#000000` |

## Tema escuro

| Token | Uso | Cor |
|---|---|---|
| `--fundo` | fundo geral | `#0A0A0B` |
| `--card-primario` | cards principais | `#141416` |
| `--card-secundario` | cards internos/secundários | `#1C1C1F` |
| `--card-terciario` | inputs, blocos internos e áreas elevadas | `#252529` |
| `--texto` | todo texto | `#FFFFFF` |

## Cor principal

Cor principal temporária da marca:

- `--primaria: #B45A2B`
- `--primaria-hover: #C46632`
- `--primaria-pressionada: #984820`

Uso:
- CTA principal;
- botão Agendar;
- confirmar;
- ação principal da tela;
- seleção ativa;
- elementos de identidade.

Texto do botão principal: `#FFFFFF`.

## Cores de alerta

Existem quatro cores funcionais:

| Tipo | Token | Cor |
|---|---|---|
| Informação | `--info` | `#2563EB` |
| Sucesso | `--sucesso` | `#16A34A` |
| Atenção | `--alerta` | `#EAB308` |
| Erro/perigo | `--erro` | `#DC2626` |

Essas cores podem ser usadas em alertas, badges, estados, ícones e feedbacks funcionais.

## Botões

### Principal

- fundo: `#B45A2B`
- texto: `#FFFFFF`
- hover: `#C46632`
- pressionado: `#984820`

### Secundário

Tema escuro:
- fundo: `#FFFFFF`
- texto: `#000000`

Tema claro:
- fundo: `#000000`
- texto: `#FFFFFF`

### Cancelar simples

Usado antes da confirmação destrutiva:
- fundo: transparente
- borda: `#DC2626`
- texto: `#DC2626`

### Cancelar final/destrutivo

Usado na confirmação definitiva:
- fundo: `#DC2626`
- borda: `#DC2626`
- texto: `#FFFFFF`

Exemplo:
- primeira ação: **Cancelar agendamento** com botão contornado;
- confirmação final: **Confirmar cancelamento** com botão vermelho sólido.

## Tokens de referência

```css
/* tema claro */
--fundo: #FFFFFF;
--card-primario: #F6F6F7;
--card-secundario: #EEEEF0;
--card-terciario: #E5E5E8;
--texto: #000000;

/* tema escuro */
--fundo: #0A0A0B;
--card-primario: #141416;
--card-secundario: #1C1C1F;
--card-terciario: #252529;
--texto: #FFFFFF;

/* marca */
--primaria: #B45A2B;
--primaria-hover: #C46632;
--primaria-pressionada: #984820;

/* estados */
--info: #2563EB;
--sucesso: #16A34A;
--alerta: #EAB308;
--erro: #DC2626;
```

## Regras para ux-pro-max, Dev e QA

1. Não introduzir novas cores de superfície sem decisão documentada.
2. Não introduzir novas cores de texto.
3. Não usar cinza como texto secundário; hierarquia é tipográfica.
4. Não alterar a cor principal por tela.
5. Cores funcionais não substituem a cor principal em CTAs comuns.
6. Ações destrutivas seguem exatamente os dois padrões de cancelar definidos acima.
7. Toda tela deve funcionar nos temas claro e escuro.
8. QA deve validar contraste, legibilidade e consistência nos dois temas.
9. Componentes shadcn/ui devem ser adaptados a estes tokens, não usar a paleta padrão como identidade final.
