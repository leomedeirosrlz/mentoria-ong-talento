# REALIZA-36 — plan.md

Implementação dos 4 tipos/capacidades faltantes da forms engine.
Ordem recomendada de PRs: **A** schema+sanitizer+upload infra → **B**
renderer público → **C** builder → **D** demo/testes. (Pode ser 1 PR grande
se revisado por duas pessoas — ver regra de review.)

## Passo 0 — contrato de campo (fundação de tudo)

`src/lib/forms/schema.ts`:

```ts
// novos tipos (união CampoTipo)
| "arquivo"
| "grid_disponibilidade"

// novas chaves opcionais em FormularioCampo:
visible_if?: { campo: string; em: RespostaValor[] };   // mostra só se respostas[campo] ∈ em
permite_outro?: boolean;                               // só em select/multi_select
// arquivo: accept?: string[] (allowlist MIME), max_mb?: number (default 10)
// grid_disponibilidade: sem opções — grade fixa do programa
```

- `validaCampos()` (builder, espelho client) passa a validar:
  `visible_if.campo` referencia id existente e **anterior** na ordem
  (senão impossível de avaliar); `permite_outro` só com `select`/
  `multi_select`; `arquivo` com `max_mb` ∈ {5,10,20} e `accept` ⊆ allowlist.
- `TIPO_LABEL`/opções do builder atualizadas (pt-BR: "Arquivo", "Grade de
  disponibilidade").
- Helpers puros novos em `src/lib/forms/` (testáveis com Vitest):
  - `visivel(campo, respostas)` — avalia `visible_if` (ausente → true).
  - `respostaParaDisponibilidade(v)` — converte o valor do grid pro formato
    canônico `{"celulas":[{dia,periodo}],...}` de `profiles.disponibilidade`
    (checks `disponibilidade_ok`, `0034`/`0100` — **a verificar**: shape
    exata das células na definição de `disponibilidade_ok` antes de fixar).

## Passo 1 — migration `0106_form_arquivo_grade_condicional.sql`

Estilo 010x: header comment, idempotente, definer explícito, grants, RLS via
`my_role()`.

1. **Bucket** `form-anexos` [NOVO]: privado, `allowed_mime_types`
   (pdf/png/jpeg/webp — mesma allowlist de `anexos-registro.tsx`), sem size
   limit no bucket (cap fica na action). Policy de storage **só** service
   role (anon/authenticated não tocam — a leitura sai por route handler).
2. **`formularios_limpa_respostas`** (UPDATE da function em 0080, diff via
   `CREATE OR REPLACE`): branches novos no CASE de tipos —
   - `arquivo`: valor deve ser objeto `{path text, nome text, tamanho int}`
     com `path ~ '^form-anexos/'` e prefixo do `link_id` (o cliente nunca
     inventa path); demais chaves dropadas.
   - `grid_disponibilidade`: objeto `{celulas jsonb}` validado pela mesma
     regra de `disponibilidade_ok` (dia ∈ enum, período ∈ faixas) —
     implementar inline ou via helper `disponibilidade_valida(jsonb)`
     extraído do check existente.
   - `visible_if`: **antes** da checagem de obrigatório — recalcular
     visibilidade no servidor (mesma regra do client): campo invisível
     → resposta dropada e obrigatoriedade ignorada. Função auxiliar
     `campo_visivel(campo jsonb, respostas jsonb)` na migration.
   - `permite_outro`: em `select`/`multi_select`, aceitar valor
     `"Outro: <texto>"` / elemento `"Outro: <texto>"` (regex
     `^Outro: .{1,120}$` após trim) além das `opcoes`.
3. **RPC `form_anexo_put`** [NOVO, definer, grant `anon`]: assinatura
   `(p_token text, p_campo_id text, p_nome text, p_mime text, p_tamanho int)`
   → valida token ativo (`formulario_links` não usado/expirado), campo é
   `arquivo`, mime/tamanho dentro do allowlist do campo → cria row
   `formulario_anexos` [NOVO] `(id, link_id, campo_id, path, nome, mime,
   tamanho, created_at)` e devolve `path` + `upload_token` (o path é o
   alvo do upload subsequente via service client na action — ver passo 2).
   Rate: rejeitar se `> 20` anexos por link.
   - Alternativa sem tabela nova avaliada no sdd.md — a tabela é o meio
     honesto de listar/limpar órfãos e ancorar a policy de leitura.
4. **Leitura**: RLS de `formulario_anexos` — select só `my_role() =
   'coordenacao'` (mesmo régua de `formulario_respostas`). Route
   `/api/form-anexo/[id]` [NOVO] → signed URL 300s, padrão `/api/anexo/[id]`.
5. Órfãos (anexo subido, resposta nunca enviada): documentado, sem cron —
   path carrega `link_id` e a limpeza manual é `delete` pelo id. LGPD:
   arquivo de respondente público é dado pessoal → retenção segue a
   resposta.

## Passo 2 — server action de upload

`src/lib/forms/actions.ts` (ou `src/lib/actions.ts`, seção forms):

```ts
export async function subirAnexoFormulario(
  token: string, campoId: string, formData: FormData
): Promise<{ path?: string; error?: string }>
```

Fluxo: `file = formData.get("file")` → chama `form_anexo_put` (valida
token+campo+mime+size) → service client `.storage.from("form-anexos")
.upload(path, file)` → devolve `{path}`. **Sem sessão**: chamar
`createClient()` anônimo + RPC definer pra checagem, service client só pro
upload. Mesmo padrão de `subirFoto` (upload dentro da action, falha de
upload não derruba o resto). Retornar `{error}` pt-BR.

## Passo 3 — renderer público

`src/app/f/[token]/formulario-publico.tsx` + `use-resposta.ts`:

- Estado `visiveis` derivado: recomputar `visivel(campo, valores)` a cada
  mudança; campo que esconde limpa seu valor (evita resposta fantasma).
  `api.total`/progresso contam **só visíveis** (barra não regredir: contar
  respondidos visíveis / total visível — decisão registrada no design).
- `arquivo`: botão upload → `subirAnexoFormulario` ao escolher (imediato,
  com `CircleNotch` + nome/tamanho depois); `aceita` = `accept` do campo;
  erro = inline no padrão do mapa de erros existente.
- `grid_disponibilidade`: componente [NOVO]
  `src/components/forms/grid-disponibilidade.tsx` — grade **Seg–Sex ×
  09h–20h (5×11 faixas, verbatim do form oficial)**. **a verificar**:
  existe editor canônico de `disponibilidade` em `src/components/` (perfil
  cadastra a própria — procurar `disponibilidade` no código; se existir,
  reusar a mesma célula/range; se o canônico cobre sáb/dom e o form oficial
  não, o campo aceita `dias`/`periodos` de configuração com default
  Seg–Sex/09–20h). `role="checkbox"` por célula, aria-label
  "Terça às 19h". Valor: `{celulas:[{dia,periodo}]}` no shape canônico.
- `visible_if`: sem UI própria — só filtra o array renderizado.
- `permite_outro`: em radio/checkbox, opção extra "Outro" que abre `Input`
  inline; valor serializado `"Outro: <texto>"`.
- Validação client (`validaResposta`): pular campos invisíveis;
  `arquivo` obrigatório exige `path` já subido (upload pendente no submit →
  erro "Aguarde o upload terminar").

## Passo 4 — builder

`src/app/(app)/formularios/formulario-builder.tsx` + preview:

- Novos tipos no seletor de tipo (mock inerte dentro do card, padrão
  v2): arquivo → dropzone fake; grid → mini grade fake.
- Editor de `visible_if`: `Select` de campo anterior (só perguntas com
  resposta: select/multi/sim_nao/checkbox) + `Select` de valor. UI:
  "Só mostrar se…" atrás de um toggle no rodapé do card.
- `permite_outro`: `Switch` "Aceitar 'Outro' com texto" em
  select/multi_select.
- `arquivo`: `Select` de tamanho máx (5/10/20MB) — accept fixo na
  allowlist (não expor texto livre).
- `validaCampos` espelhado (mesma regra do passo 0) com scroll+focus no
  card com erro.
- **Bloqueio honesto**: `visible_if`/`permite_outro`/`arquivo`/`grid` ficam
  desabilitados em `sistema=true` (imutáveis) — já é a regra do builder.

## Passo 5 — respostas/summary/export

- `respostas-section.tsx`: `arquivo` → link "Abrir anexo" (route do passo
  1.4); `grid` → chip "N faixas" + detalhe; `"Outro: x"` agrega como
  valor próprio ("Outros" já existe no agregador — `a verificar` em
  respostas-section.tsx se `Outro: …` cai no bucket certo sem trabalho;
  se não, normalizar para `Outro` na agregação).
- `/api/export?tipo=respostas`: `grid` exporta como
  `seg 09h;seg 10h;…` (join `;`); `arquivo` exporta nome do arquivo (não
  URL — link expira); "Outro" já cai na coluna.

## Passo 6 — demo + testes

- `src/lib/demo/`: formulário demo com os 4 recursos (adicionar um form de
  intake fake no dataset) + `subirAnexoFormulario` retorna `{error:
  DEMO_MSG}` padrão.
- Vitest: `visivel`, `respostaParaDisponibilidade`, validaCampos com
  visible_if cíclico/forward-ref rejeitado, serialização "Outro".
- e2e app: spec novo respondendo form público com os 4 tipos (upload de
  PNG real pequeno no staging).
- Gates: `tsc`, `eslint`, `pnpm test`, schema-contract, e2e-preview.

## Rollback

Migration é aditiva (novos tipos são dados em `campos` jsonb — sem
ALTER). Rollback = revert de código; forms que já usarem os tipos novos
renderizam tipo desconhecido → tratar no renderer: tipo desconhecido
mostra card "Tipo não suportado nesta versão" (já existe fallback? —
`a verificar`; se não, adicionar no passo 3).
