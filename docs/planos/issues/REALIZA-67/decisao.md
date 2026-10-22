# REALIZA-67 — Decisão: devolução do mentor entra no MVP do editor de PDF?

## Contexto

O fluxo do editor (`docs/planos/editor-pdf.md`) é: mentor upa PDF → vira
atividade → mentorado recebe `/a/[token]` → edita no browser com autosave
(`rascunho` persiste no servidor, link é **multi-sessão**) → entrega →
mentor revisa. A pergunta: quando o mentor olha o entregue e quer ajuste,
**como a devolução acontece — dentro da plataforma ou por fora — e entra no
MVP?**

O plano já carrega a resposta candidata no desenho:

- `atividades.status` inclui `'devolvida'` no enum (`editor-pdf.md:112`);
- passo 6 do fluxo: mentor tem a ação "**devolver pra ajuste** (reabre o
  link com o rascunho intacto — o WhatsApp de aviso é dele)" (`:173`);
- RPC `devolver_atividade` esboçada como interna (`:147`);
- e a pergunta 1 das Perguntas Abertas é exatamente esta: *"Devolução entra
  no MVP? Sem ela, 'ficou ruim' vira conversa no WhatsApp e nova atividade —
  aceitável? (Recomendo fase 1.5 rápida, não cortar o conceito.)"* (`:236`).

"Devolução" tem três sabores crescentes de escopo:

| Sabor | O que é | Custo |
|---|---|---|
| **a) Reabrir pra ajuste** | `status='devolvida'` → o mesmo link volta a servir edição **com o rascunho intacto**; jovem retoma de onde parou; aviso via WhatsApp do mentor | RPC + botão + banner/chip — ~1–2 dias sobre a 55 |
| **b) Devolver com comentário** | (a) + motivo estruturado que vira banner no link | +campo/UI — fase 2 do plano |
| **c) PDF devolvido anotado** | o mentor **edita/anota** o PDF e devolve (co-edição) | superfície de edição logada ou 2º link com papel — "visão" do plano, outro produto |

Sem devolução nenhuma, `entregue` é terminal: ajuste = conversa no WhatsApp
+ **nova atividade** — re-upload do PDF, link novo, e o rascunho morre na
atividade antiga (o jovem refaz do zero). Isso também deixaria o valor
`'devolvida'` do enum morto no schema.

## Opções

### A — MVP com devolução "reabrir pra ajuste" (sabor a) — recomendada

O botão "Devolver pra ajuste" na ficha chama `devolver_atividade`: status
volta, link reabre em modo edição com o rascunho intacto; banner discreto
no link ("Devolvida pra ajuste"); o aviso vai no WhatsApp do mentor — que é
dele, coerente com a regra "a dupla agenda; a plataforma monitora" (a
plataforma não tem canal push pro jovem, o canal dele é o link).

- **Prós:** fecha o loop mentor↔jovem dentro da plataforma; custo marginal
  pequeno porque a infra já está paga (enum, RPC esboçada, rascunho
  multi-sessão — reuso é o que justifica o link ser multi-sessão);
  preserva o ativo principal: o trabalho já feito.
- **Contras:** +~1–2 dias num MVP que já é L (o editor é ~60% do custo).

### B — MVP sem devolução (fase 1.5 depois)

`entregue` é terminal; devolução entra na primeira revisão pós-MVP.

- **Prós:** MVP menor; "ficou ruim" tem workaround (WhatsApp + nova
  atividade).
- **Contras:** workaround é caro em UX real — jovem refaz do zero (perde o
  rascunho), mentor re-upa e re-envia; e o schema nasce com valor de status
  morto. É o corte que o próprio plano marca como "cortável **se apertar**",
  não como desenho ideal.

### C — MVP com devolução completa (sabores b ou c)

Comentário estruturado (banner com motivo) ou PDF anotado pelo mentor.

- **Prós:** loop mais rico, feedback contextual.
- **Contras:** escopo real — (b) adiciona campo+UX de motivo e histórico de
  devoluções; (c) exige co-edição ou upload de devolução, que o plano já
  classifica como fase 2/visão. Desequilibra o MVP.

## Recomendação

**A** — "reabrir pra ajuste" entra no MVP; comentário estruturado (b) e PDF
anotado pelo mentor (c) ficam pra fase 2/visão, exatamente como o plano já
separa. Racional: o custo é marginal porque tudo que é caro já existe
(enum, rascunho persistente, link multi-sessão, RPC esboçada) e o corte
cria o pior UX possível justo no caso mais comum (primeira entrega
imperfeita). Se o prazo apertar, a ordem de corte do plano (`editor-pdf.md`
§8) já marca devolução e "ver o que enviei" como os itens cortáveis — a
decisão B fica como fallback explícito, não como escolha.

**Alinhamento com a REALIZA-20:** o plano dela (`REALIZA-20/plan.md`) já
inclui "devolver pra correção" no chassis de instrumentos — resposta volta
de `enviada` pra `devolvida` e o mesmo link fica respondível de novo — e
registra um BLOCKER com a mesma pergunta ("reabre a mesma resposta ou exige
ciclo novo?"), já com a recomendação "mesma resposta reabre". A decisão
desta issue responde **o mesmo sim** pro editor de PDF: as duas superfícies
convergem no mesmo ciclo `entregue → devolvida → entregue` — coerente, sem
dois conceitos pro mentor aprender. Nota de chassis: a 20 decidiu evoluir
`formulario_links`/`formulario_respostas` em vez de criar
`atividades`/`atividade_links` novas; se a 55 herdar esse chassis, a
devolução do editor reusa a mesma RPC/ciclo — a decisão aqui não muda.

## Decisão que falta o Thiago assinar

**Confirma devolução no MVP no sabor "reabrir pra ajuste" — o mentor devolve
pela plataforma, o link reabre com o rascunho intacto pro jovem continuar, e
o aviso sai no WhatsApp do mentor (fora da plataforma) — com comentário
estruturado e PDF anotado pelo mentor fora do MVP (fase 2)?**
