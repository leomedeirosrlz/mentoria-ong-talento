# Auditoria de copy — nov/2025 (branch `copy/audit-1125`)

Escopo: jovem (home, agenda, perfil, pessoas, materiais, avaliações/PDM) e
mentor (home, agenda, ficha da dupla, registro). Só texto exibido; estrutura,
CSS e lógica intocados. Referência: `/tmp/opencode/copy-referencia.txt`.

## Resultado

A rodada anterior de voz já está refletida no código atual: as superfícies
seguem "você", frase curta, imperativo consistente ("Pede", "Marque"), "pra"
como voz da casa e erro = o que houve + o que fazer. A auditoria achou **4
correções reais** — três travessões em texto exibido (agendar/remarcar dos
dois lados, ajuda da sessão combinada) e uma frase enrolada na agenda do jovem.

## Mudanças (arquivo | antes → depois)

| arquivo | antes → depois |
| --- | --- |
| src/components/jovem-agendar-dialog.tsx:173 | "Agendar é sempre pra frente — escolha uma data e horário futuros." → "Agendar é sempre pra frente. Escolha uma data e horário futuros." |
| src/components/agendar-encontro-dialog.tsx:250 | "Remarcar é sempre pra frente — escolha uma data futura." → "Remarcar é sempre pra frente. Escolha uma data futura." |
| src/components/registro-form.tsx:1015 | "…este registro vale pelos dois — o conteúdo aparece uma vez só…" → "…vale pelos dois. O conteúdo aparece uma vez só…" |
| src/app/(jovem)/jovem/agenda/page.tsx:831 | "Pede por aqui que quem aceita propõe um com você" → "Pede por aqui que quem aceitar propõe um horário com você" |

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

Nenhum. As strings corrigidas não aparecem em asserts de teste.

## Decisões e pendências

- `?? "—"` / `|| "—"` mantidos: são glifos de "valor vazio" em dados (cidade,
  UF, média), não travessão de prosa. Fora de texto corrido, a régua não morde.
- "SMART" (Modelo SMART) é vocabulário do programa citado nos materiais; fica.
- "mentorado(a)" nas mensagens de WhatsApp: forma neutra consagrada; fica.
- Jargão em comentários de código (`RPC`, `payload`) permanece — a régua é de
  texto exibido, e comentário não renderiza.
- Varredura por jargão/palavras proibidas: sobrou só código (`!= null`,
  `redirect`, imports), não texto de tela.

## Gates (rodados em cada passo)

`next typegen && tsc --noEmit` limpo · `eslint src/` 0 erros, 112 warnings
(baseline, `no-restricted-syntax` Button) · `pnpm test` 3296 passed, 1 skipped.

Commits: `2ef5bd8c` jovem-home · `f9eda421` jovem-agenda · `4513c2a0`
mentor-agenda · `48b89c79` dupla-registro.
