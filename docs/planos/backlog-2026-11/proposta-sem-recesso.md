# Proposta de plano sem a decisão do recesso

## Contexto

Hoje a coordenação (ou o mentor) não consegue propor o plano "Pra ficar em dia"
enquanto a dupla não decidiu o recesso. Três camadas bloqueiam:

1. `plano_propor` (RPC, 0225) recusa quando um recesso que cruza a janela não
   tem decisão: `falta a dupla confirmar o recesso`.
2. `combinarPlano` devolve o mesmo erro antes da RPC e, para gravar a decisão,
   chama `declarar_recesso`, que só mentor/mentorado podem executar (0225).
3. O wizard (`combinar-plano.tsx`) não fecha a etapa do recesso enquanto a
   resposta estiver em aberto.

O pedido: **propor não é decidir pela dupla**. A equipe propõe com uma
suposição explícita; a dupla recebe a notificação, aceita com aquela suposição
(ou troca) e o plano passa a valer. Nenhuma decisão de recesso é escrita em nome
da dupla na proposta.

## Decisões

1. **A suposição viaja no escopo**: `decisoes.recessos[]` ganha
   `origem: "proposta"` e `usa` (default `true` = pausar, que é o
   comportamento padrão do calendário). Nada é escrito em `dupla_recessos` na
   proposta; a autoria continua da dupla.
2. **`plano_propor` aceita recesso pendente** quando existe suposição para
   cada recesso da janela; valida janela e passos sob a suposição, como hoje.
3. **`combinarPlano`**: quando quem propõe é staff, não chama
   `declarar_recesso`; envia a suposição. Quando é a dupla, mantém o caminho
   atual (grava a decisão escolhida).
4. **Aceite grava a decisão**: `plano_responder` com `aceitar` passa a
   persistir `dupla_recessos` com autoria de quem aceitou (`usa` = suposição,
   ou a escolha feita no aceite) e revalida as datas. Se a escolha mudar as
   datas, a proposta precisa ser contestada/recalculada — usar a régua de
   `mesmaDatas`.
5. **UI**: card e wizard ganham "propor mesmo sem a decisão — considera pausa
   no recesso"; o card da dupla mostra "a proposta considera pausa no recesso;
   confirme ou troque antes de aceitar".
6. **Notificação**: e-mail (`avisoPlanoEmail`) e notificação in-app do
   `plano_propor`/`plano_responder` já existem; acrescentar a frase da
   suposição e o CTA de revisar.

## Escopo técnico

- **Migration nova** `0245_plano_proposta_suposicao.sql`:
  - `plano_propor`: aceitar `decisoes.recessos[].origem='proposta'` como
    resposta válida do bloqueio de recesso (sem gravar `dupla_recessos`).
  - `plano_responder`: no aceite, gravar a decisão de recesso (autoria de quem
    aceitou) quando ela ainda estiver pendente e revalidar a janela/passos.
  - Sem DDL de coluna: tudo no jsonb do escopo (padrão da 0218/0225).
- **`src/lib/actions-plano.ts`**:
  - `combinarPlano`: `DecisaoRecesso` ganha `origem?: "dupla" | "proposta"`;
    staff não declara; valida a suposição antes de chamar a RPC.
  - `responderPlanoComRecesso`: passa a decisão do aceite adiante.
- **UI**: `src/components/combinar-plano.tsx`,
  `src/components/assistente-cards.tsx` (card do caminho),
  `src/components/plano-em-dia-card.tsx`.
- **Liza**: `src/lib/ia/tools.ts` (`plano_propor` aceita a suposição) e
  `src/lib/ia/prompts.ts` (pode propor com "considera pausa" e explicar que a
  dupla decide no aceite).
- **Notificações**: `avisoPlanoEmail` e a notificação in-app da 0219.

## Critérios de aceite

- Staff propõe com recesso pendente: a RPC grava a proposta com
  `assumido: true`; **nenhuma** linha nova em `dupla_recessos`; e-mail e
  notificação in-app avisam com a suposição.
- A dupla vê "considera pausa no recesso"; aceitar grava a decisão dela e o
  plano passa a valer.
- Trocar para "seguir no recesso" no aceite recalcula as datas; se mudarem, o
  aceite vira contestação/reproposta em vez de gravar datas divergentes.
- Dupla que já decidiu continua no fluxo atual, sem regressão.
- Continua valendo um plano aberto por dupla; proposta duplicada é recusada.
- Sem regressão no aceite único (0225) e no aviso de prática da fusão (018).

## Gates

- `npx eslint src/`
- `pnpm test`
- `pnpm guard`
- `pnpm build`
- e2e de app se tocar o fluxo do wizard (`pnpm e2e:app` conforme o repo).

**Proibido**: push, merge e deploy. Trabalhar só no worktree e reportar.

## Skills a carregar

- `supabase-postgres-best-practices` (migration, RPC security definer, RLS).
- `better-writing` + `antislop-copywriting` (copy do card e das notificações).
- `typescript-clean-code` (server action).
