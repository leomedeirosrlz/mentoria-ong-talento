# REALIZA-138 — Demo: switcher "Alterar view" (variantes de layout)

- **Jira:** `REALIZA-138` (projeto REALIZA, `kelyng.atlassian.net`)
- **Tier:** A (doc set completo) · **Esforço:** P · **Risco:** baixo (só demo, nada de schema)
- **Deps:** REALIZA-137 (FEITO — mocks em `docs/mockups/`) + decisão registrada abaixo
- **Docs:** `plan.md` · `sdd.md` · `design.md` · `sdr.md` · `acceptance.md`

## Resumo

Na `/demo`, alternar entre organizações diferentes da mesma tela
("Agenda 1 / 2 / 3") pra comparar as variantes que o processo de mockups
avaliou — controle na `DemoBar`, escolha persistida em cookie `demo_view`.

## Veredito de status — parcialmente absorvida, resta o viewer

O desenho original ("cookie `demo_view` escolhe entre 3 implementações reais
alternativas") ficou **obsoleto na forma**: a decisão aberta da issue
("variantes viram modos reais mantidos × switcher só na avaliação") foi
respondida pela implementação — **as vencedoras viraram O produto**, não
modos paralelos:

- `/agenda` já tem os modos reais `?aba=minha|por-mentorado|calendario`,
  `?visao=dpp|especialista`, coord `monitoramento|calendario`, auxiliar
  por-turma|consolidada (`src/app/(app)/agenda/page.tsx:194-362`) — todos
  funcionando na demo hoje, com o dataset demo cobrindo tudo.
- Não existem 2ª/3ª implementações alternativas mantidas pra um `demo_view`
  alternar — recriar as perdedoras como código real seria o caminho mais
  caro e menos fiel ao que foi avaliado.

**O que resta entregar de verdade:** nenhum ponto do produto alcança as
variantes hoje — elas são HTML solto em `docs/mockups/` (não commitado). O
plano `implementacao-telas-finais.md` já prescreve o mecanismo exato e ele
nunca foi criado: registry `src/lib/demo/mockups.ts` [NOVO], assets públicos,
viewer `/demo/mockups` com iframe e menu "Layouts em teste" (WP9, linhas
91, 119, 497-498). Este plano entrega isso:

- **Cookie `demo_view`** guardando a última variante vista por tela
  (aceite "persiste por cookie" da issue).
- **`/demo/mockups`** — índice das 6 telas + viewer `/demo/mockups/[tela]`
  que embute o HTML da variante escolhida (`?v=`), com link "ver no
  produto" pra tela real correspondente.
- **DemoBar** ganha a seção "Alterar view": na tela real com mockups
  (`/agenda`, `/duplas`, `/chamados`, `/materiais`, `/jovem/*`), chips de
  variante levam direto ao viewer daquela tela; fora delas, link pro índice.
- Os 26 HTMLs movem de `docs/mockups/<tela>/` para `public/mockups/<tela>/`
  (ativos servidos; PNGs e briefs ficam em `docs/` como evidência).
- CSP: exceção escopada `/mockups/*` com `frame-ancestors 'self'` +
  `default-src 'none'` sandbox — ver `sdr.md`.

## Alternativas consideradas (resumo — detalhe no sdd.md)

| Opção | Veredito |
|---|---|
| **A — Viewer de mockups na demo** (este plano) | Recomendada: fiel ao pedido ("organizações diferentes do MESMO dataset canônico"), custo P, é exatamente o que o WP9 prescreve |
| B — `demo_view` alternando componentes reais | Rejeitada: não há componentes alternativos mantidos; implementar perdedoras de verdade = G e contraria SLC |
| C — Fechar sem código (abas reais bastam) | Rejeitada: as abas comparam escopos, não as variantes avaliadas; equipe ainda não consegue abrir os mocks sem o repo |

## BLOCKER — decisão que o plano assume

O plano assume a **Opção A** (a única compatível com o que já foi decidido e
implementado). Se o Thiago quiser de fato alternar **implementações reais**
concernentes (Opção B), esta issue vira épico: definir quais alternativas
reais manter — não é o caso hoje. Pergunta exata a confirmar:
*"Manter só a vencedora no produto e expor as variantes como mockups
navegáveis na demo (A), ou construir modos reais paralelos (B)?"*

## Riscos

- CSP: `frame-ancestors 'none'` global bloquearia o iframe — mitigado pela
  regra `/mockups/*` posterior (Next: último header vence — ver sdd).
- Drift docs↔public: mitigado movendo os HTMLs (fonte única em `public/`).
- 2 mockups usam `<script>` inline (filtro da `duplas/v4`, radar da
  `instrumentos/v1`) — CSP dos assets precisa `script-src 'unsafe-inline'`.
- Escopo temporal: artefato de avaliação — remover `public/mockups/` + rotas
  + seção da DemoBar ao fim da validação (WP9 já prevê; código marcado com
  `REALIZA-138` pra grep).
