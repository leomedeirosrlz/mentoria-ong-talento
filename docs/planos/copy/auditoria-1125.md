# Auditoria de copy — nov/2025 (branch `copy/audit-1125`)

Escopo: jovem (home, agenda, perfil, pessoas, materiais, avaliações/PDM) e
mentor (home, agenda, ficha da dupla, registro). Só texto exibido; estrutura,
CSS e lógica intocados — as exceções deliberadas (densidade já decidida na
rodada anterior) estão listadas em "Mudanças de estrutura". Referência:
`/tmp/opencode/copy-referencia.txt`.

## Resultado

As superfícies seguem "você", frase curta, imperativo consistente, "pra"
como voz da casa e erro = o que houve + o que fazer. A rodada fechou dois
blocos:

1. **Renomeação do plano de recuperação**: "plano combinado" → **"Pra ficar
   em dia"** (o "combinado" é o item de tarefa da lista, não o plano). Pill,
   card, textos da semana e vocabulário da Liza alinhados.
2. **Resíduos de voz manual**: travessões em texto exibido, frases
   enroladas, tom de comunicado ("Agradecemos pelo ciclo!"), sub-headers que
   descreviam a página em vez de orientar o passo.

## Mudanças (arquivo | antes → depois)

### Plano — renomeação e voz

| arquivo | antes → depois |
| --- | --- |
| src/lib/sua-semana.ts | pill "Plano combinado" → "Pra ficar em dia" (×2) |
| src/lib/sua-semana.ts | "…põe o combinado pra valer…" → "…põe o plano pra valer…" (×2) |
| src/lib/sua-semana.ts | "…sugestão {data}. Confirmem a data pra seguir no plano." → "…sugestão {data}." |
| src/components/sua-semana-plano.tsx | "Este é o {n}º encontro do plano que {quem} combinou." → "O {n}º encontro é passo do combinado com {quem}." ("combinado" aqui é verbo: acordado com a pessoa) |
| src/components/plano-em-dia-pecas.tsx | legenda "{x} de {y} encontros do plano feitos" → "{x} de {y} feitos" |
| src/components/plano-acordos.tsx | "O combinado vale. Se algo mudou…" → "O plano vale. Se algo mudou…" · "{n}º encontro · passo do combinado" → "…passo do plano" · "combinado pra valer" → "plano pra valer" |
| src/lib/ia/prompts.ts + tools.ts | vocabulário da Liza: plano = "pra ficar em dia", nunca "combinado"; regra "combinado é o item de tarefa" documentada no prompt |
| BACKLOG.md | decisão de vocabulário registrada; item novo "Formação EaD é curso" |

### Voz manual — resíduos

| arquivo | antes → depois |
| --- | --- |
| src/components/jovem-agendar-dialog.tsx | "Agendar é sempre pra frente — escolha…" → "…pra frente. Escolha…" |
| src/components/agendar-encontro-dialog.tsx | "Remarcar é sempre pra frente — escolha…" → "…pra frente. Escolha…" |
| src/components/registro-form.tsx | "…vale pelos dois — o conteúdo…" → "…vale pelos dois. O conteúdo…" |
| src/app/(jovem)/jovem/agenda/page.tsx | "Pede por aqui que quem aceita propõe um com você" → "Pede por aqui que quem aceitar propõe um horário com você" |
| src/app/(jovem)/jovem/page.tsx | "Os encontros das suas mentorias. Vocês combinam as datas juntos." → "Seus encontros, combinados e próximos passos…" (por trilha) |
| src/app/(jovem)/jovem/agenda/page.tsx | "Seus encontros com o mentor e com especialistas." → "Seus encontros com o mentor e especialistas." |
| src/app/(jovem)/jovem/agenda/page.tsx | "…ele aparece nesta agenda." → "…ele aparece aqui." |
| src/app/(jovem)/jovem/agenda/page.tsx | "Sugestão pra destravar o próximo passo" → "Sugestão de data" |
| src/app/(jovem)/jovem/agenda/page.tsx | "Sessões de 1h · escolhe um horário e manda o pedido. …aparece aqui na agenda." → "Sessões de 1h. Escolha um horário e envie o pedido. …aparece na sua agenda." |
| src/app/(jovem)/jovem/materiais/page.tsx | "O que está por vir abre sozinho no encontro certo." → "Os próximos abrem no encontro certo." |
| src/components/jovem-especialistas.tsx | "…Veja quem é e responda." → "…Dá uma olhada e responda." |
| src/components/mentor-home.tsx | "Jornada concluída. Agradecemos pelo ciclo!" → "Jornada concluída. Foi um ciclo inteiro." |
| src/lib/agenda-minha.ts, src/components/trilha-jornada.tsx, src/app/(app)/duplas/[id]/page.tsx | "…, já passou: falta confirmar." / ", falta confirmar" → "…, aguardando confirmação" (3 ocorrências) |
| src/lib/jovem-diretorio.ts + src/app/(jovem)/jovem/page.tsx | `vinculoDeContato`: "Auxiliar da sua dupla" → "Auxiliar executivo da sua dupla" — o nome do papel, alinhado com `papelLabel` e com o `papel="Auxiliar executivo(a) da dupla"` da home |

### "Em lima" → "Em verde"

| arquivo | antes → depois |
| --- | --- |
| src/components/pedir-especialista-dialog.tsx:733 | legenda da grade "Em lima: encaixam na sua disponibilidade" → "Em verde: …" — "lima" é o nome do token, não a palavra que a pessoa fala |

### Acervo — item "Formação EaD"

| arquivo | antes → depois |
| --- | --- |
| src/lib/demo/queries.ts | "Trilha opcional com certificado para mentores." → "Curso gratuito com certificado." (descrição neutra até o tipo `curso` entrar — ver BACKLOG) |

## Mudanças de estrutura (deliberadas, densidade já decidida)

Não são copy — listadas pra o diff ser auditável:

- `src/components/recesso-dupla-card.tsx`: recesso respondido colapsa numa
  linha ("Pausar os encontros" / "Seguir nos encontrando") com "Editar"
  ghost que reabre os botões (`useState<Set>` `editando`).
- `src/app/(jovem)/jovem/agenda/page.tsx`: o parágrafo de ajuda do recesso
  só renderiza enquanto falta resposta (`!recessosDaAgenda.every(r =>
  r.declaradoEm != null && r.usa != null)`).
- `src/components/plano-contestar.tsx`: botão "Não serve pra mim" de
  `outline` para `ghost` + cores muted.
- `src/components/plano-em-dia-pecas.tsx`: legenda da barra `hidden sm:flex`.
- `src/components/sua-semana-plano.tsx`: linha do vínculo `hidden sm:block`.
- `src/components/jovem-encontro-linha.tsx`: no mobile o status sai do canto
  superior direito pra dentro do texto (embaixo da data); o canto fica com
  ⋯ + estrelas da avaliação (`pe-16` no texto). Comentário ajustado pra
  bater com a ordem real.
- `src/components/jovem-agendar-sugestao.tsx`: linha da sugestão corta
  "das HH às HH" → "às HH" (duração é fixa, o fim não muda decisão).
- `src/lib/agenda-minha.ts`: `meta` para de empilhar "com {especialista}"
  — a linha já abre com "Sessão com {nome}".

## Superfícies verificadas já na voz (sem edição)

- Home do jovem: hero, "Precisa de você", semana, estante de instrumentos.
- Agenda do jovem: sugestão de agendar, retroativo, histórico, trilha de
  especialista, plano "ficar em dia", recesso, empty state.
- Perfil + Pessoas: dados, ficha, disponibilidade, privacidade, selos,
  conquistas, "Meus pedidos", diretório e perfil de pessoa.
- Materiais: jornada, instrumentos, acervo, documento nativo, devolutiva.
- Avaliações + PDM: árvore, metas SMART, roda, toggle de visibilidade do mentor.
- Home do mentor: "o que precisa de você", fila, semana, combinados, atalhos.
- Agenda do mentor: "Minha agenda", "Por mentorado", calendário, detalhe do
  encontro, trilha de especialista do mentorado.
- Ficha da dupla + registros: header/saúde, encontros, registro do encontro
  (form completo), terceiros, registros/filtros/painel, anexos.

## Travados por teste

Nenhum. As strings novas viraram assert nos specs (pill "Pra ficar em dia"
em `sua-semana.spec.ts`, `sua-semana-plano.test.tsx`, `plano-combinado.test.ts`;
vínculo "O 5º encontro é passo do combinado com Ricardo" no e2e) — ajuste
só de texto assertado, comportamento intacto.

## Decisões e pendências

- `?? "—"` / `|| "—"` mantidos: glifo de "valor vazio" em dados, não
  travessão de prosa.
- "SMART" (Modelo SMART) é vocabulário do programa citado nos materiais.
- "mentorado(a)" nas mensagens de WhatsApp: forma neutra consagrada.
- "Formação EaD": descrição neutra hoje; virar `curso` nos dois papéis é
  item de BACKLOG (tipo/audiência/CTA nas duas vitrines).
- Jargão em comentários (`RPC`, `payload`) permanece — a régua é de texto
  exibido.
- Varredura por palavras proibidas: sobrou só código (`!= null`, `redirect`).

## Gates

`next typegen && tsc --noEmit` limpo · `eslint src/` 0 erros, 112 warnings
(baseline, `no-restricted-syntax` Button) · `pnpm test` 3296 passed,
1 skipped · `pnpm guard` 11/11 (R8 recuperada: `next-env.d.ts` restaurado
após `next typegen`).

E2E local (`docs/convencoes/ci-e2e.md`, Supabase local + `pnpm start` na
:3100 com `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY` e `IA_BOLHA=1`):
**65 passed** nos 10 specs das superfícies tocadas (demo `sua-semana`,
`jovem-combinado`, `jovem-especialistas`, `plano-em-dia`; app
`jovem-agenda`, `agenda-views`, `plano-em-dia`, `plano-roteiros`,
`plano-acordo`, `combinados-encontro`). Ajustes de spec: asserts de copy
nova (`35b05320`) e locator do badge que hoje existe 2× no DOM
(mobile/desktop) mirando a instância visível (`68a450c7`) — nenhum
comportamento relaxado.

Commits: `2ef5bd8c` jovem-home · `f9eda421` jovem-agenda · `4513c2a0`
mentor-agenda · `48b89c79` dupla-registro · `84176625` auditoria ·
`56058a52` jovem · `2c65442c` mentor · `9b24005f` plano · `03c4b1da` plano ·
`aa249dcf` rename "pra ficar em dia" · `95a88b4f` jovem-agenda ·
`ee979677` jovem-perfil · `a498319d` auditoria · `806e11ee` corpo do PR ·
`b7a927fc` recesso só-leitura · `35b05320` asserts e2e copy ·
`68a450c7` locators e2e.
