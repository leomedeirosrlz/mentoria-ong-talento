# REALIZA-159 — design.md (UI)

## Superfícies

1. **`/pessoas` → "Fora do programa"** (`pessoas-listas.tsx:623-660`):
   cada linha renderiza `MentoradoActions` (`:1248`). Adicionar item
   "Promover a mentor" no menu da linha **somente quando**
   `m.situacao === "concluido"` (desistentes: item ausente — a decisão
   default do plano). Coord-only na prática (a seção inteira só tem
   sentido pra coord; o RPC revalida).
2. **`PromoverMentorDialog`** [NOVO] `src/components/promover-mentor-dialog.tsx`
   — padrão `saida-mentorado-dialog.tsx` / `remanejar-dupla-dialog.tsx`:
   - `DialogContent className="sm:max-w-md"`;
   - Título: "Promover {nome} a mentor"; descrição: uma linha explicando
     que a pessoa sai da identidade de jovem e vira staff ("O histórico de
     mentorado fica preservado; o acesso de jovem é encerrado.").
   - Radio papel: "Mentor de jornada (DPP)" / "Mentor especialista";
     select de turma aparece só com DPP (fonte: turmas dos `cronogramas`
     — mesma lista usada em `NovaDuplaDialog`; prop `turmas` recebida da
     listagem pai, que já carrega? — se `/pessoas` não carrega turmas,
     o dialog busca `getTurmasAtivas` equivalente existente — **conferir
     qual query serve e reusar; não inventar**).
   - Textarea opcional "Observação" (vai pra nota).
   - Submit → `promoverMentorado` → sucesso: toast + link "Abrir ficha da
     pessoa" (`/pessoas/<profile_id>` retornado) + microcopy: "Gere o
     termo de voluntário na ficha — a assinatura não é automática."
   - Erro: `toast.error(err)` com a mensagem vinda do RPC (elegibilidade,
     e-mail ausente, etc.).
3. **Estados**: desabilitar submit durante transition
   (`useTransition`); fechar dialog só em sucesso (padrão dos dialogs de
   escrita); botão com `CircleNotch` girando (padrão do codebase).
4. **Demo**: item e dialog funcionam; submit retorna `DEMO_MSG` via
   toast informativo (padrão de writes em `/demo`).

## Microcopy pt-BR

- Item de menu: "Promover a mentor"
- Confirmação: "Promover" / cancelar "Voltar"
- Sucesso: "{nome} agora é mentor {de jornada|especialista}."
- Elegibilidade (se item visível mas clicado com ação negada pelo RPC):
  mensagem do backend verbatim.

## Acessibilidade / mobile

- Radio group com `role="radiogroup"` + labels (Base UI Radio/RadioGroup
  se já usado — senão os botões-radio estilo dos dialogs existentes);
  select de turma com label associado; foco devolvido ao trigger ao
  fechar (padrão Base UI Dialog).
- Largura `sm:max-w-md` rola em mobile dentro do sheet/dialog padrão — o
  form cabe sem scroll (3 campos).

## Fora de escopo

- Banner/fluxo "ex-aluno" na ficha da pessoa (a nota cobre a narrativa).
- Reversão da promoção (não existe "despromover" hoje pra nenhum papel —
  coordenador corrige via `setPessoaRole` se errar).
