# REALIZA-71 — Micro-avaliação por encontro: consolidação e agregação no ciclo

Issue: `avaliacao`, `jornada`, `dpp`. Fonte: backlog 2026-11. Status: a fazer.

## O que exige vs. o que existe

A issue pede micro-avaliação **dos dois lados** a cada encontro (2–3
perguntas máx., jovem por link tokenizado) agregando no 360º de fim de
ciclo. Recon: **a coleta já existe nos dois lados** — o trabalho desta
spec é consolidar o vocabulário, fechar a agregação e travar as regras de
visibilidade.

Lado do jovem — **pronto desde a 0071**:

- `avaliacoes_encontro` (`types.ts:402-420`): `estrelas` 1–5 (obrigatória),
  `sentimento` (chips `SENTIMENTO_AVALIACAO`), `avancei`
  (`sim|um_pouco|nao`), `temas[]`, `comentario`, `pedir_apoio`,
  `avaliacao_visivel_mentor`, `respondido_por_profile_id` (null = token
  anônimo).
- `avaliacao_links` mintado por **trigger** quando `encontros.status →
  realizado` (`0071_avaliacao_encontro.sql:122` — cobre `salvarRegistro`,
  retroativo e backfill); expiração lazy; status
  `pendente|respondido|expirado`.
- Dois canais: `/avaliar/[token]` público e `/jovem` logado — mesmo form
  `AvaliacaoEncontroForm` (`avaliacao-encontro-form.tsx`), mesma RPC
  `submeterAvaliacao` (`actions-avaliacao.ts:87`).
- Modelo de privacidade implementado e testado: coord/sup leem tudo;
  jovem as próprias (`getJovemAvaliacoes`); mentor DPP só a **média
  quantizada em lotes ≥3** (`avaliacao_media_dpp`,
  `queries-avaliacao.ts:176-203`) ou avaliação pontual quando o jovem
  marca `visivel_mentor`; especialista só as próprias estrelas
  (`especialista_avaliacoes` view); `pedir_apoio` notifica coord/sup e
  entra no `saudadeDaDupla`/`avaliacao_pendente` (`ciclo.ts:1412-1423`).

Lado do mentor — **existe dentro do registro**: `registros.avaliacao`
(escala 1–4 `AvaliacaoJovem`), `dificuldade`, `proximo_passo` no form
semanal (`types.ts:371-389`; trajetória visível em
`trajetoria-avaliacoes.tsx`).

Gaps reais:

1. Nenhuma superfície **agrega** as duas séries no fim do ciclo — o 360º
   (`avaliacao_final_mentor`/`_mentorado`, 0130) chega "seco", sem o
   contexto da trajetória; a retrospectiva (-359) ainda não existe.
2. A escala dos dois lados diverge (5 estrelas × 4 pontos) — intencional,
   mas nunca foi documentada como decisão.
3. Nenhum teste de contrato garante que a agregação respeita a mesma
   privacidade do dado bruto.

## Decisões

1. **Conjunto de perguntas — o schema vigente É a micro-avaliação.**
   Jovem: `estrelas` (1 obrigatória) + `avancei` + `sentimento` como
   bloco de fechamento rápido (≤3 decisões); `temas`, `comentario`,
   `pedir_apoio` e `visivel_mentor` são **opcionais/canal de segurança** —
   não contam no teto de 2–3 perguntas, porque não exigem resposta.
   Mentor: `avaliacao` + `dificuldade` + `proximo_passo` dentro do
   registro semanal — já é a micro-avaliação dele; **não criar form
   paralelo** (duplicar o gesto do mentor seria fricção sem ganho).
2. **Agregação derivada, não copiada.** Nenhuma coluna/tabela nova de
   "nota final" — a agregação é computada por query/RPC na leitura:
   `media_estrelas`, `% avancei=sim`, distribuição de sentimentos, temas
   mais citados (lado jovem); `mediaAvaliacao` 1–4 + histograma de
   dificuldades (lado mentor, função já existente em
   `encerramento.ts:145-150`).
3. **Duas superfícies de fim de ciclo:**
   - **Contexto dentro do 360º** — ao abrir `/f/<token>` de
     `avaliacao_final_mentor` ou `avaliacao_final_mentorado`, o header do
     form mostra um card "Sua trajetória": ao **mentor**, a própria série
     1–4 + a média quantizada do jovem (somente se
     `avaliacao_media_dpp.liberado` — mesma régua da ficha); ao
     **mentorado**, a própria série de estrelas/avancei. Via
     `formulario_por_token` (security definer, `0080:209`) — o payload
     ganha `contexto_avaliacao` só para esses dois sistemas; `anon`
     recebe o mesmo corte (o link é a identidade).
   - **Retrospectiva (-359)** — bloco "Avaliações ao longo do ciclo" com
     as duas séries lado a lado (já especificado lá; esta spec entrega o
     tipo derivado `AgregadoAvaliacoes`).
4. **Privacidade herda a régua da 0071 — sem exceção nova.** O agregado
   nunca expõe ao mentor DPP o que a RLS esconde: média só liberada em
   lote ≥3 (quantizada em 0,5); `comentario`/`sentimento` individuais só
   quando `avaliacao_visivel_mentor`; especialista fora do agregado
   (a view dele continua só estrelas); `pedir_apoio` nunca aparece no
   360º nem na retrospectiva.
5. **Sem alerta novo de "avaliação pendente"** — `avaliacao_pendente`
   já é sinal do `saudadeDaDupla`/`PainelChave`; a issue não pede
   cobrança extra e o guia não prescreve.

## Schema

**Migration `0191_agregado_avaliacao_360.sql`** (reservada do lote):

- `formulario_por_token(text)` re-emitida: quando `sistema IN
  ('avaliacao_final_mentor','avaliacao_final_mentorado')` e o link
  resolve uma dupla, incluir `contexto_avaliacao` no jsonb —
  mentor: `{registros:[{numero,avaliacao}], media_jovem:<quantizada ou
  null>}`; mentorado: `{estrelas:[{numero,estrelas,avancei}]}`. Reusar a
  lógica de `avaliacao_media_dpp` para a quantização (extrair pra função
  interna se o código duplicar).
- Nenhuma tabela/coluna/RLS nova — leitura definer com o mesmo corte de
  identidade (`anon | outra_pessoa | ok`) já existente.

## Domínio (src/lib/)

- `src/lib/avaliacao-agregado.ts` (novo) ou em `queries-avaliacao.ts`:
  `type AgregadoAvaliacoes` + `agregaAvaliacoes(avaliacoes, registros)` —
  pura: média estrelas, % avancei, sentimentos, temas, média 1–4; usada
  pela ficha, retrospectiva e testes.
- `src/lib/forms/queries.ts`: `formularioPorToken` tipa
  `info.contexto_avaliacao` (opcional) para os dois sistemas 360.
- `src/lib/ciclo.ts`: nada a mudar — `avaliacao_pendente`/apoio já
  alimentam o semáforo.

## UI

- `src/app/f/[token]/formulario-publico.tsx`: quando
  `info.contexto_avaliacao` presente, card "Sua trajetória neste ciclo"
  entre header e primeira pergunta — barras/estrelas compactas + 1 linha
  de resumo ("você avaliou 14 encontros · média 4,2 · avançou em 12").
  Somente leitura, sem campo novo no form.
- `src/components/trajetoria-avaliacoes.tsx`: reusa o padrão visual já
  existente pra série do mentor.
- Ficha da dupla / retrospectiva: consomem `AgregadoAvaliacoes` (detalhe
  na -359).

## Seed + demo

- `src/lib/demo/data.ts` + `demo/queries.ts`: série completa de
  `avaliacoes_encontro` na dupla demo do fim de ciclo (16 encontros,
  notas variadas, 1 `pedir_apoio` antigo resolvido) e espelhar
  `contexto_avaliacao` no demo do `/f` se a demo renderizar o form.
- fixtures e2e: links dos dois sistemas 360 respondidos sobre a série.

## Testes

- vitest `avaliacao-agregado.test.ts`: médias, % avancei, temas
  frequentes, quantização (lote <3 → `liberado=false`), série com
  lacunas (encontro sem avaliação não conta).
- e2e:
  - `/f` de `avaliacao_final_mentor` → card trajetória com média
    quantizada quando `liberado`; ausente quando <3 avaliações;
  - `/f` de `avaliacao_final_mentorado` → série da própria jovem;
  - token de `outra_pessoa`/expirado → nenhum dado vaza (regressão da
    0080);
  - mentor DPP logado nunca vê `comentario`/`sentimento` de avaliação
    sem `visivel_mentor` (contrato RLS, já coberto — estender ao novo
    payload).

## Critérios de aceite

- [ ] Os dois lados avaliam cada encontro realizado: jovem por link
  mintado no `realizado` (existente) e mentor no registro (existente) —
  sem form paralelo novo.
- [ ] O 360º de fim de ciclo abre com a trajetória agregada do lado que
  responde, respeitando a quantização/privacidade da 0071.
- [ ] `AgregadoAvaliacoes` é derivado por função pura + RPC — nenhuma
  coluna denormalizada.
- [ ] `pedir_apoio` e avaliações não liberadas nunca aparecem no card,
  na retrospectiva ou no payload público.
- [ ] Idempotência preservada: 1 avaliação por encontro por lado
  (unique/guard da 0071 + unique de `registros.encontro_id`).
- [ ] `npx tsc --noEmit`, `npx eslint src/` limpos; migration aplicada
  no staging antes do push.

## Fora de escopo

- Form de micro-avaliação separado para o mentor (o registro já cobre).
- Notificações push/WhatsApp automáticas de cobrança por avaliação
  pendente (sinal do semáforo já existe; lembrete é ação humana).
- Mudar a escala de qualquer lado (5★ jovem × 4pt mentor é decisão
  registrada).
- Analytics cross-dupla/coorte das avaliações.
