# Separação das aplicações Barzzo

## Decisão arquitetural oficial

O Barzzo usa **um único repositório**, porém com **três aplicações independentes**:

1. **App Cliente**
2. **App Parceiro**
3. **Admin Web**

As aplicações compartilham backend, banco, autenticação, tipos, regras de domínio e componentes reutilizáveis, mas **não compartilham shell, navegação, middleware de autenticação nem experiência principal**.

A separação deve existir fisicamente no código, e não apenas como grupos de rotas dentro de um único app Next.js.

## Estrutura obrigatória

```text
barzzo/
├── apps/
│   ├── cliente/
│   ├── parceiro/
│   └── admin/
├── packages/
│   ├── ui/
│   ├── dominio/
│   ├── supabase/
│   ├── tipos/
│   ├── validacoes/
│   ├── imagens/
│   └── utilitarios/
└── supabase/
    ├── migrations/
    └── functions/
```

O projeto deve ser organizado como monorepo.

## App Cliente

`apps/cliente` é uma aplicação própria voltada ao cliente final.

Deve futuramente gerar:
- Barzzo Cliente Android;
- Barzzo Cliente iOS.

Identificador sugerido: `com.barzzo.cliente`.

### Regra crítica

A descoberta e a consulta de agenda são públicas.

O usuário **não precisa estar autenticado** para:
- acessar início;
- pesquisar barbearias;
- abrir o perfil público;
- consultar serviços;
- consultar profissionais;
- consultar disponibilidade;
- escolher data e horário;
- chegar ao resumo da reserva.

Fluxo obrigatório:

```text
Pesquisar barbearia
→ Abrir perfil
→ Escolher serviço
→ Escolher profissional ou "qualquer profissional"
→ Escolher data
→ Consultar horários
→ Escolher horário
→ Ver resumo
→ Login/Cadastro
→ Restaurar seleção
→ Revalidar disponibilidade
→ Confirmar agendamento
```

O login é obrigatório somente antes da confirmação definitiva.

O App Cliente contém marketplace, reservas, favoritos, avaliações, perfil, notificações, cupons e jornada do cliente.

O App Cliente não contém painel operacional da barbearia, gestão de equipe, relatórios administrativos, assinatura SaaS nem Admin Barzzo.

## App Parceiro

`apps/parceiro` é uma aplicação própria para:
- dono;
- gerente;
- profissional.

Deve futuramente gerar:
- Barzzo Parceiro Android;
- Barzzo Parceiro iOS.

Identificador sugerido: `com.barzzo.parceiro`.

O App Parceiro exige autenticação.

### Dono

Pode acessar, conforme permissões:
- painel;
- agenda;
- clientes;
- equipe;
- profissionais;
- serviços;
- horários;
- bloqueios;
- produtos;
- galeria;
- campanhas;
- cupons;
- influenciadores;
- relatórios;
- avaliações;
- assinatura;
- configurações.

### Gerente

Acessa apenas funções operacionais autorizadas. Não recebe automaticamente permissões críticas de assinatura, propriedade ou administração.

### Profissional

Deve ter experiência própria e simplificada, incluindo:
- minha agenda;
- meus atendimentos;
- meus clientes permitidos;
- minha disponibilidade;
- bloqueio de horário;
- iniciar atendimento;
- finalizar atendimento;
- marcar não comparecimento;
- perfil;
- indicadores permitidos;
- notificações.

Não basta mostrar o painel completo escondendo menus. A experiência deve ser adequada ao papel.

## Admin Web

`apps/admin` é uma aplicação separada e permanece web no MVP.

Funções:
- dashboard da plataforma;
- barbearias;
- usuários;
- trials;
- assinaturas;
- planos;
- agendamentos;
- influenciadores;
- avaliações;
- suporte;
- auditoria;
- logs.

Admin não utiliza o shell do App Parceiro.

## Backend compartilhado

As três aplicações usam o mesmo backend:

- Supabase Auth;
- PostgreSQL;
- Storage;
- RPC/funções;
- Edge Functions quando necessário;
- RLS;
- Firebase Cloud Messaging para push;
- Mercado Pago para assinatura da barbearia.

Não criar três bancos nem três sistemas de autenticação.

## Código compartilhado

Regras comuns devem viver em `packages/*`.

Exemplos:
- domínio de agendamentos;
- disponibilidade;
- validações;
- tipos;
- cliente Supabase;
- componentes genéricos;
- processamento de imagens.

Uma regra crítica não deve existir duplicada em Cliente e Parceiro.

## Dependências entre apps

É proibido:

```text
apps/cliente -> importar apps/parceiro
apps/parceiro -> importar apps/cliente
apps/admin -> importar telas dos outros apps
```

Compartilhamento deve ocorrer através de `packages/*`.

Isso permite desenvolver, testar, implantar e empacotar cada aplicação independentemente.

## Web

Estratégia desejada:

```text
barzzo.com
→ App Cliente / marketplace

parceiro.barzzo.com
→ App Parceiro

admin.barzzo.com
→ Admin Web
```

Todos podem permanecer no mesmo monorepo e usar o mesmo backend.

## Mobile com Capacitor

A separação existe para permitir dois apps mobile independentes:

```text
apps/cliente
→ Capacitor
→ Android/iOS
→ com.barzzo.cliente

apps/parceiro
→ Capacitor
→ Android/iOS
→ com.barzzo.parceiro
```

Cada aplicativo deve poder possuir configuração própria de:
- bundle/application id;
- ícones;
- splash;
- push;
- deep links;
- permissões nativas.

## Autenticação compartilhada

A mesma pessoa pode usar Cliente e Parceiro com a mesma conta Supabase Auth.

O que muda é:
- aplicação;
- contexto;
- vínculo com barbearia;
- função;
- permissões.

Autorização nunca deve depender apenas da interface.

## Push

O cadastro de dispositivos deve permitir distinguir no mínimo:
- `usuario_id`;
- aplicativo: `cliente` ou `parceiro`;
- plataforma;
- token push.

Assim o backend consegue enviar a notificação ao aplicativo correto.

## Deep links

Links públicos de barbearias, campanhas, cupons e influenciadores devem abrir o App Cliente quando instalado e a web quando não estiver.

## Segurança

A separação dos apps não substitui RLS.

Cliente, Parceiro e Admin devem continuar sujeitos às regras de autorização no backend/banco.

## Regra definitiva

```text
1 repositório
3 aplicações independentes
2 aplicativos mobile futuros
1 backend compartilhado
```

**Um repositório não significa um aplicativo.**

Cliente, Parceiro e Admin devem poder ser executados, testados, implantados e evoluídos de forma independente.
