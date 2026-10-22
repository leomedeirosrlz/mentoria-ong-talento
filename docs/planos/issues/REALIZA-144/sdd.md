# REALIZA-144 — sdd.md (leve — sem schema)

## Decisão central: wizard é derivação, não coluna

| Opção | Veredito |
|---|---|
| `formularios.modo text` / flag `wizard` | ❌ coluna nova pra dizer o que `secao` já diz; divergência builder↔render |
| **Wizard ligado pela presença de `secao`** | ✅ autor já expressou "isso é um capítulo"; comportamento GForms; zero migração |

Regra: `len(etapas(campos)) > 1` → wizard. Sem `secao` → página única
(regressão zero).

## Alternativa para estado entre etapas

| Opção | Veredito |
|---|---|
| `AnimatePresence` desmonta etapa | ❌ perde valores/FormData |
| **Etapas montadas com `hidden`** | ✅ precedente `RegistroForm` (BACKLOG: "etapas montadas com hidden — FormData/rascunho intactos") |

## Rascunho/refresh — decisão explícita

- Link = uso único, submit atômico → **sem rascunho server-side** (não
  existe resposta parcial; criar `respostas_parciais` seria schema novo
  pra um problema que o `beforeunload` já cobre).
- **Sem localStorage** (privacidade — decisão BACKLOG forms v1 mantida).
- `beforeunload` com dirty = aviso nativo do browser.

## Invariantes

1. Toda pergunta renderiza em **exatamente uma** etapa; `secao` nunca é
   pergunta.
2. Validação de Avançar = campos visíveis da etapa; submit final =
   todos os visíveis (inclui revisitar etapas puladas via "voltar").
3. Enter só submete no último passo.
4. `use-resposta` API preservada (`api.onSubmit`, `api.valores`,
   `api.erros`) — wizard consome, não reescreve o hook.
5. Instrumentos sob-medida **não** entram no wizard genérico nesta
   entrega (BLOCKER aberto no plan.md).

## Performance

- Render por etapa já é o mesmo array — `hidden` só esconde; sem custo
  extra de mount. `etapas()` é `useMemo` sobre `campos`.
- Nenhuma query/RPC nova; payload de submit idêntico (`respostas` jsonb).
