# Plano 02 — Correções rápidas (bugs verificados)

## Status (25/out, cópia local `~/nb/realiza.vc`, sem commit)

| Item | Status | Verificação no navegador (build local, 390px) |
|---|---|---|
| Q1 | ✅ feito (`registro-inline.tsx`) | home → "Registrar como foi" e link frio: card no topo (115px), foco no 1º campo do form |
| Q2 | ✅ feito (`fila-espera.tsx`) | `/pessoas` sem rolagem horizontal a 320/360/390px (coordenação e supervisor) |
| Q3 | ✅ feito (`jovem-avaliacoes.tsx`, `avaliacao-encontro-form.tsx` prop `embutido`) | diálogo: 1 título, 1 "1 minuto", pergunta 1 logo abaixo. `/avaliar/[token]` não testado (sem token na demo) |
| Q4 | ⚠️ **já estava no `main`** | os achados vieram das auditorias mobile e já tinham sido corrigidos (commits w2-val); os 9 arquivos são idênticos ao remoto. Item mantido abaixo só como registro |
| Q5 | ⏸ aguardando aprovação | mexe no Jira (visível a outras pessoas) |
| Q6 | ✅ feito (`app-shell.tsx`) | coordenação e supervisor: Início, Duplas, Pessoas, Agenda, Mais; ponto no "Mais" quando há chamados na fila (com contagem no `aria-label`). Mentor sem mudança. D3 segue aberta |
| Q7 | ✅ feito na parte de interface; separar urgência do motivo **descartado pelo Thiago (25/out)** (`novo-chamado-dialog.tsx`, `jovem/page.tsx`) | aviso "Seu mentor não vê este pedido" e prazo unificado ("recebe na hora e responde em até 1 dia útil"). **Separar a urgência do motivo exige servidor**: hoje `urgencia` é valor de `chamados.categoria` (CHECK em `0084_chamados.sql:40-41`; RPC `abrir_chamado` em `0090_hibrido_restante.sql:279`; action `src/lib/actions-chamados.ts:54`). Precisa de migration (`urgente boolean`), novo parâmetro na RPC e na action |

Gates: `npx tsc --noEmit` e `npx eslint src/` limpos; `next build` ok.

> Independe do plano 01. Pode entrar já: cada item é pequeno, isolado e
> foi medido no navegador (build do `main` `b5684a8`, modo demo, 390×844).

## Q1. "Registrar como foi" leva o mentor para o topo da ficha

**Evidência.** Na home do mentor, "Registrar como foi" navega para
`/duplas/<id>#registrar-<encontro>`. O formulário abre (o hash casa), mas a
página fica em `scrollY = 0`. O formulário está a **9.675px** do topo, numa
página de **12.482px**. O mentor vê a ficha, não o formulário, e precisa
saber que deve rolar 10 telas.

**Causa.** `src/components/registro-inline.tsx:35-50`: o provider sincroniza
`hashBate` com `location.hash`, mas nada rola até o alvo depois que o card
abre. O scroll nativo do navegador acontece antes da hidratação, quando o
formulário ainda está fechado. Origem do link:
`src/components/trilha-jornada.tsx:263`.

**Correção.** Quando `aberto` passar a `true` por causa do hash (não por
clique local), rolar até o card com `scrollIntoView({ block: "start" })` e
focar o primeiro campo do formulário. O comportamento de scroll deve seguir o
guard global de movimento reduzido (`behavior: "auto"` quando
`prefers-reduced-motion`). Considerar o cabeçalho fixo com `scroll-margin-top`
no card.

O plano 05 (ficha da dupla) propõe abrir o registro em uma *sheet* a partir
da própria home, sem navegação. Q1 é a correção mínima até lá.

**Aceite.** Abrir o link frio em 390px mostra o formulário no topo da
viewport, com foco no primeiro campo. Spec e2e: navegar pela home do mentor,
clicar "Registrar como foi" e verificar `toBeInViewport()` no formulário.

## Q2. `/pessoas` (coordenação) vaza 220px para a direita no celular

**Evidência.** `scrollWidth` 610px num viewport de 390px. O elemento que
vaza é a coluna "Mentorados" do bloco "Aguardando par" (`div.space-y-1`,
578px de largura).

**Causa provável.** `src/components/fila-espera.tsx:86`: `grid gap-4
sm:grid-cols-2`. Itens de grid têm `min-width: auto`, então o conteúdo da
linha (nome + "há 22 dias · Cidadão Pró-Mundo" + ações) força a largura
da trilha.

**Correção.** `min-w-0` na raiz de `FilaColuna`, ou
`grid-cols-[minmax(0,1fr)]` no mobile. Confirmar que o metadado da linha
trunca e preserva o texto em `title`/`sr-only`, conforme a regra de truncate
do `AGENTS.md`.

**Aceite.** `scrollWidth === clientWidth` em `/pessoas` a 320px, 360px e
390px, para coordenação e supervisor.

## Q3. Avaliação do jovem com título e aviso de privacidade duplicados

**Evidência.** O diálogo mostra o título "1º encontro — como foi?" com a
descrição "1 minuto. Suas respostas ficam entre você e a equipe…". Logo
abaixo, dentro do formulário, vêm "Olá, Bia!", "Como foi o encontro?",
"1 minuto · só a nota é obrigatória" e "Seu mentor vê só as estrelas…". São
dois títulos, dois "1 minuto" e duas explicações de privacidade antes da
primeira pergunta.

**Causa.** `src/components/jovem-avaliacoes.tsx:77-84` (cabeçalho do
diálogo) e `src/components/avaliacao-encontro-form.tsx:154-166` (cabeçalho
do formulário). O formulário traz o próprio cabeçalho porque também é usado
na página pública `/avaliar/[token]`, onde não existe diálogo.

**Correção.** Adicionar ao `AvaliacaoEncontroForm` uma prop (por exemplo
`embutido`) que omite o cabeçalho interno quando o form está dentro do
diálogo. O diálogo mantém o título com o número do encontro e **uma**
frase de privacidade.

**Aceite.** No diálogo, a primeira coisa depois do título é a pergunta 1.
Em `/avaliar/[token]`, o cabeçalho continua igual.

## Q4. Alvos de toque abaixo de 44px (já auditados, não corrigidos)

Achados das auditorias mobile (`docs/planos/mobile/*.md`), classificados
como "Importante", que seguem no código. Aplicar o padrão da casa
`min-h-11 sm:min-h-*`:

| Local | Hoje | Fonte |
|---|---|---|
| Abas de `/agenda` (mentor: "Minha agenda · Por mentorado · Calendário") | `px-3 py-1.5` ≈30px; estoura em 320px | `agenda-ops.md` (`agenda/page.tsx`, `agenda-auxiliar.tsx:283`) |
| "Ver ficha ›" na fila de acompanhamento | `min-h-9` (36px) | `fila-acompanhar.tsx:256-261` |
| "Ver ficha ›" na agenda do auxiliar | `min-h-9` | `agenda-auxiliar.tsx:403`, `:601` |
| Link da dupla em "Sem o Nº encontro marcado" | ~24px | `agenda-calendario.tsx:3806-3809` |
| "Remarcar na ficha" no estado limbo | link inline ~20px | `agenda-por-mentorado.tsx:640-647` |
| Busca de links de formulário | `h-8 text-xs` (zoom no iOS) | `formulario-links.tsx:727-734` |
| Inputs da prévia de cronograma | `h-9` | `cronograma-builder.tsx:225` |
| Inputs inline do relatório | `text-[13px]` (zoom no iOS) | `relatorio-canvas.tsx:372`, `:565-569` |
| Chips das perguntas 2 e 4 da avaliação | `h-10` | `publicas-auth.md` |
| `/chamados` sem `loading.tsx` | sem feedback no toque | `coord-core.md` |

**Aceite.** Rodar o script de métricas (ver `README.md` → "Como medir")
filtrando campos ocultos 1×1: nenhum alvo interativo visível abaixo de 44px
nas rotas listadas, a 390px.

## Q6. Barra inferior mobile da coordenação esconde Agenda e Pessoas

**Evidência.** No celular, a coordenação vê: Chamados, Turmas, Início,
Duplas, Mais. O comentário do próprio código (`app-shell.tsx:75`) diz que as
primárias deveriam ser Início, Duplas, Pessoas e Agenda. No supervisor, a
Agenda também vai para o "Mais".

**Causa.** `src/components/app-shell.tsx:79-96`: `MOBILE_PRIMEIRO` não lista
`/chamados` nem `/turmas`, que foram adicionadas à nav depois. O
`indexOf` devolve -1 e esses itens vão para o início da ordenação.

**Correção.** Ordenar com fallback no fim (`indexOf === -1 → Infinity`) e
listar todas as rotas explicitamente. **Decisão (D3):** Chamados tem badge
de pendência. Entra entre as 4 primárias no lugar de Pessoas? A
recomendação é Início, Duplas, Agenda, Chamados; Pessoas vai para o "Mais".
O plano 06 trata a navegação como um todo; esta correção é independente.

**Aceite.** Spec e2e mobile por papel conferindo a ordem dos 4 itens
visíveis da barra inferior.

## Q7. "É urgente" exclui o motivo do pedido de ajuda do jovem

**Evidência.** `src/components/novo-chamado-dialog.tsx:80-85`: "É urgente" é
uma quarta opção no mesmo grupo exclusivo de "Com meu mentor", "Com a
plataforma" e "Outra coisa". Um problema urgente com o mentor não pode ser
marcado como os dois.

**Correção.** O motivo continua com 3 opções exclusivas. A urgência vira um
interruptor separado ("Preciso de ajuda agora"). A urgência já tem roteamento
próprio (`urgencia: "Coordenação e supervisão são avisadas na hora."`), então
é preciso conferir no servidor como o tipo `urgente` é gravado antes de
separar os campos (pode exigir ajuste na action ou na RPC do chamado).

Na mesma tela:

- Com "Com meu mentor" selecionado, dizer explicitamente "Seu mentor não vê
  este pedido". A regra hoje só existe num comentário,
  `jovem-pedir-ajuda.tsx:8`.
- Unificar a promessa de prazo: o card da home diz "A equipe é avisada na
  hora" (`jovem/page.tsx:326`) e o modal diz "respondem em até 1 dia útil"
  (`novo-chamado-dialog.tsx:176`).

**Aceite.** É possível enviar um pedido sobre o mentor marcado como urgente,
e a coordenação recebe com as duas informações.

## Q5. Jira desatualizado

REALIZA-194 a 202 estão como "Tarefas pendentes", mas os commits estão no
`main`: `3177cd3` (materiais v5c), `2d48c85` (agenda v8b), `f1c2220`
(chamados), `74c43df` (duplas v6a), `89c599f` (registros v2), `321be21`
(formulários), `d7abc6a` (turmas), `7a0f53c` (relatórios). REALIZA-203
também está entregue (`daff264`).

**Ação.** Mover para "in test" (teste humano, conforme a convenção do
Thiago). **Só com aprovação**: é uma mudança visível para outras pessoas.
