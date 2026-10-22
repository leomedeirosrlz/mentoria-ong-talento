# REALIZA-37 — ViaCEP no cadastro de endereço (dados civis)

**Jira:** REALIZA-37 · **Tier:** B · **Status:** aberta — planejada

## Contexto

O cadastro de pessoas (coord) e os termos de assinatura (jovem/responsável)
digitam endereço completo em `dados_civis` — 7 campos
(`logradouro/numero/complemento/bairro/cep/cidade/uf`,
`src/lib/types.ts:896-915`). CEP preenchido deveria autocompletar
logradouro/bairro/cidade/uf via ViaCEP — conveniência client-side; a
validação server-side continua soberana (`parseCivis`,
`src/lib/actions.ts:288-340`, já normaliza CEP pra 8 dígitos e rejeita
tamanho errado).

## Estado atual (verificado)

- Componente único `DadosCivisFields` (`src/components/assinatura-form.tsx:31-135`)
  renderiza o bloco de endereço com `maskCep` (`src/lib/utils.ts`) —
  reusado em: `AssinaturaForm` (termos logados e `/assinar/[token]`
  público), `pessoas-dialogs.tsx:258-265` (`prefix="civis_" opcional
  compacto`), `pessoa-actions.tsx`, `mentorado-actions.tsx`.
- Modo `compacto` esconde cidade/uf (vêm dos campos simples da ficha);
  o autofill deve respeitar isso: preencher os campos do bloco que
  **existem na tela**, sem criar modelo paralelo.
- Campos hoje são não-controlados (`defaultValue` via `defaults`) —
  autofill exige controlar o bloco de endereço.

## Proposta

- **Server action** `buscarCep(cep)` em arquivo novo
  `src/lib/actions-endereco.ts` [NOVO]: fetch server-side pra
  `https://viacep.com.br/ws/<cep8>/json/` com `AbortSignal.timeout(5s)` e
  `next: { revalidate: 86400 }` (CEP é quase estático). Retorna
  `{ ok: true, endereco: {logradouro, bairro, cidade, uf} }` |
  `{ kind: 'nao_encontrado' }` | `{ kind: 'erro' }` (union discrimínada,
  padrão `FormularioTokenResult` em `forms/queries.ts:361-364`).
  - Server-side (não fetch no browser): o CEP sai do nosso servidor, não
    do IP do usuário — menos exposição pra terceiro (LGPD), e funciona no
    token público `/assinar/[token]` sem CORS/CSP extra.
- **Client** dentro de `DadosCivisFields`: bloco de endereço vira
  controlado; ao completar 8 dígitos (ou blur com 8 dígitos), dispara a
  action; estados: buscando (spinner no campo CEP + `aria-live`),
  preenchido (inputs populam, **sempre editáveis**), não encontrado
  (hint discreto "CEP não encontrado — preencha manualmente", não é
  erro), falha (silenciosa com hint "Não foi possível buscar — preencha
  manualmente"). Nunca trava o form: autofill é só conveniência.
- **Sem mudança server-side de persistência**: `parseCivis` continua
  validando; o valor salvo é o que está nos inputs no submit.

## Decisões

- Sem ViaCEP em tempo real por dígito — só no CEP completo (1 request por
  CEP, cacheada 24h).
- `numero`/`complemento` nunca vêm do ViaCEP — campos manuais.
- Demo: `demoRole()` → retorna endereço sintético fixo ("Rua das Flores,
  Jardim Brasil, São Paulo/SP") pra CEP válido — o fluxo fica
  demonstrável offline e o e2e demo é determinístico (sem rede externa).

## Superfícies tocadas

`assinatura-form.tsx` (`DadosCivisFields`) + novo `actions-endereco.ts` +
`src/lib/viacep.ts` [NOVO] (parser puro da resposta — testável Vitest).
Herdado de graça: pessoas/pessoa/mentorado dialogs + assinaturas.

## Esforço

**S-M** — 1 action + 1 lib pura + controlar 1 bloco de campos compartilhado.
