# REALIZA-37 — design.md (UI)

## Componente

`DadosCivisFields` (`assinatura-form.tsx`) — o bloco de endereço inteiro
(CEP, logradouro, número, complemento, bairro, cidade, uf) vira
controlado; props públicas inalteradas. Componentes UI existentes
(`src/components/ui/`: Input, Label, Field padrão dos dialogs) — nada novo.

## Estados do campo CEP

| Estado | Visual |
|---|---|
| idle | input normal com `maskCep` |
| buscando | `CircleNotch` animado no canto do input CEP + `aria-live="polite"` "Buscando CEP…"; inputs livres |
| ok | campos populados; sem badge (o preenchimento fala); foco sugerido → `numero` (próximo campo manual) |
| nao_encontrado | hint muted sob o CEP: "CEP não encontrado — confira ou preencha manualmente." |
| falha | hint: "Não foi possível buscar o CEP — preencha manualmente." |

Hints usam o padrão de `text-sm text-muted-foreground` do codebase (sem
vermelho — não é erro de validação; a validação real acontece no submit).

## Edição pós-autofill

Todos os campos permanecem editáveis; valor digitado vence (state comum).
O autofill nunca trava o formulário nem altera `required` (em modo
`opcional`, CEP preenchido parcialmente segue a regra atual de parse).

## Modo `compacto`

Autofill só escreve campos renderizados (logradouro, bairro — cidade/uf
estão fora desse modo). Nenhum campo oculto é criado.

## Microcopy pt-BR

- "Buscando CEP…"
- "CEP não encontrado — confira ou preencha manualmente."
- "Não foi possível buscar o CEP — preencha manualmente."

## Acessibilidade

- `aria-live="polite"` no container de status; spinner `aria-hidden` com
  texto sr-only "carregando".
- `inputMode="numeric"` no CEP (maskCep já existe); labels `htmlFor` ok.
- Autofill não move foco à força — exceto sugestão leve de focar `numero`
  após sucesso (decisão: **não mover** — pessoas digitam CEP por último
  às vezes; manter foco onde está, padrão conservador).
- Teclado: Tab natural; sem atalhos novos.

## Mobile

Layout atual do bloco (grid 2 colunas cidade/uf, cep full ou meio) se
mantém — os campos controlados não mudam markup, só `value`.

## Superfícies herdadas (sem trabalho extra)

- `/pessoas` Novo → pessoa (compacto) — `pessoas-dialogs.tsx:258-265`
- Editar pessoa / editar mentorado — `pessoa-actions.tsx`, `mentorado-actions.tsx`
- Assinatura de termos logada — `AssinaturaForm`
- `/assinar/[token]` público — mesmo componente, action pública

## Fora de escopo

- ViaCEP nos campos simples `cidade`/`uf` da ficha (não são CEP-driven).
- Autopreencher outros países (BR-only).
- Validação de CEP como obrigatório (regra atual: opcional mas, se
  presente, 8 dígitos — `parseCivis`).
