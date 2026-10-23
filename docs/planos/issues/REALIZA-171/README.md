# REALIZA-171 — Rematch em trilha esp não gera `devolutiva_pdm`

**Status: IMPLEMENTADA** — `supabase/migrations/0117_rematch_devolutiva.sql` +
wiring na action/dialog. Aceite em `acceptance.md`.

## O buraco (confirmado no código)

`rematch_dupla` (0105:392+) encerra a dupla esp atual e cria a sucessora, e já
carimba `encerrada_em` + motivo sistêmico e emite a avaliação geral do
especialista (§13, via `emitir_avaliacao_esp`). Mas **não coleta/grava
`duplas.devolutiva_pdm`** — o campo que o rito de encerramento esp exige.
E depois do rematch nenhuma via grava: `encerrar_trilha_especialista` exige
dupla viva (`status in ('ativa','pausada')`, 0105:374) e `postar_devolutiva`
recusa trilha encerrada ("a devolutiva final vai no encerramento", 0086:364).

Resultado: a devolutiva "ficava operacional" (Jira) — o especialista mandava
por WhatsApp e não havia onde gravar. O CHECK `duplas_encerramento_esp`
(0037) exige `trilha='especialista' OR (encerrada_em, motivo, devolutiva all
null)` — e a jornada do rito espera a devolutiva pro PDM na ficha DPP, onde
ela chega pela view `solicitacoes_mural` (`ed.devolutiva_pdm`, 0037:268).

## Decisão (registrada — não precisa de Thiago)

**A devolutiva entra como campo exigido do rematch esp** — `p_devolutiva`
na RPC, validada 10–4.000 (mesma régua de `encerrar_trilha_especialista` e
do `duplas_devolutiva_pdm_cap`), gravada no mesmo UPDATE que fecha a trilha.
A coordenação transcreve a entrega do especialista que sai — é o que já
acontece operacionalmente; agora tem onde morar e fecha na mesma transação.

Alternativa considerada e descartada: **link pós-rematch pro especialista
que sai escrever** (paralelo ao §13). Sai da mesma leitura do Jira ("emitir
link §13 + devolutiva pro especialista que sai"), mas: (a) o motivo nº 1 de
rematch é desistência — depender do especialista desligado voltar pra
escrever deixa o rito aberto de novo, que é exatamente o bug; (b) exigiria
via de escrita pós-encerramento nova (RPC próprio ou wiring no
`submeter_resposta_formulario`, já reescrito por 3 planos — _reviews/dba.md
§3); (c) o rito de encerrar já admite a coordenação como autora do submit —
`encerrar_trilha_especialista` aceita `my_role()='coordenacao'`. Se um dia
se quiser a coleta autoral, é follow-up: o campo, a view e a ficha não
mudam.

Em trilha DPP o parâmetro é recusado com erro (`duplas_encerramento_esp`
proíbe o campo) — descarte silencioso faria o chamador achar que gravou.

## O que mudou

- **Migration `0117_rematch_devolutiva.sql` [NOVO]**: `drop` da assinatura
  5-args (com default no 6º parâmetro os dois corpos ficariam ambíguos pra
  chamadas antigas, e a versão velha seria porta que pula o rito) +
  `create or replace` verbatim do corpo 0105 com os deltas:
  - `p_devolutiva text default null` (6º parâmetro);
  - validação **depois** dos guards de escopo/papel e **antes** do primeiro
    write — rematch esp sem devolutiva aborta inteiro, e a ordem dos erros
    legados se preserva (o `_valida_0101.sql` 5c segue recebendo o guard
    "DPP", não o erro de devolutiva);
  - `devolutiva_pdm = btrim(p_devolutiva)` no UPDATE de fechamento esp;
  - revoke/grant na assinatura nova (`authenticated`, coord-only no corpo).
- **`src/lib/actions.ts`**: `remanejarDupla` ganha `devolutiva?`, lê
  `trilha` no select prévio e valida a faixa antes da ida (erro amigável);
  repassa o texto em `p_devolutiva` — em DPP o RPC é quem recusa com erro
  claro.
- **`remanejar-dupla-dialog.tsx`**: campo "Devolutiva pro PDM" só em trilha
  esp (required, 10–4.000, contador no padrão do EncerrarTrilhaDialog);
  validação inline via `setErro`; cobre os dois lados — remanejo de jovem
  também encerra a trilha e o especialista devolve a do jovem que sai.
- **`database.types.ts`**: `p_devolutiva?: string` nos Args (ordem
  alfabética do gerador).
- **`tests/e2e/app/solicitacao-esp.spec.ts`**: o rematch cross-turma manda
  `p_devolutiva` e agora confere `encerrada_em` + `devolutiva_pdm` na dupla
  fechada.
- **`scripts/_valida_0105_rest.mjs`**: seção 4 testa o gate negativo (sem
  devolutiva aborta, dupla segue viva) antes do rematch feliz, que agora
  confere a coluna gravada.
- **`scripts/_valida_0101.sql`**: o rematch esp de 5a ganha o 6º argumento
  (5b/5c testam guards que disparam antes da validação — sem mudança).

## Ordem de merge e gates

- **Coordenação com a 98** (`duplas.dupla_dpp_id`): as duas reescrevem
  `rematch_dupla`. Ordem documentada: **98 antes de 171** (INDEX.md); quem
  mergear por segundo re-lê `pg_get_functiondef` e carrega os dois deltas
  no mesmo corpo.
- **Migration → staging → prod ANTES do merge** (regra do repo): o
  schema-contract compara `database.types.ts` com o PostgREST de prod —
  `p_devolutiva` precisa existir lá. `db push --db-url` no staging antes do
  push da branch, senão o e2e-preview quebra (o spec manda o parâmetro).
- Visibilidade inalterada: a devolutiva segue saindo pela
  `solicitacoes_mural` (mentor DPP/solicitante/jovem autor) e pela ficha da
  dupla encerrada (especialista + coord) — nota de segurança da review
  (`_reviews/seguranca.md` §171) coberta sem mudança de policy.

## Reviews

reviews/{seguranca,dba,produto-coord}.md da rodada anterior — seguranca/dba
reprovaram por ausência de plano (este doc agora é o plano + implementação;
re-review pela persona quando rodar a próxima rodada).
