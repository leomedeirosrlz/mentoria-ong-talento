# REALIZA-138 — Demo "Alterar view: Agenda 1/2/3" — documento de decisão

Issue: `demo`, `decisão`. Fonte: backlog 2026-11. Status: **DECIDIDO (Thiago, 11/nov) — descartada, sem código**: mockups não entram em prod; as variantes vencedoras já são o produto (`?aba=`/`?visao=`). Equivale à Opção C — a necessidade de revisar os mocks fica coberta pelo próprio `docs/mockups/` no repo.

> Este não é um spec de implementação. A issue está bloqueada numa
> escolha de arquitetura que só o Thiago fecha: **modos reais** dentro
> do produto × **comparador de mockups**. Opções, esforço e recomendação
> abaixo.

## O pedido

Na `/demo`, um controle "Alterar view: Agenda 1 / 2 / 3" para comparar as
variantes de layout avaliadas na rodada de mockups (REALIZA-137 — os 26
HTMLs em `docs/mockups/`: agenda, chamados, duplas, instrumentos,
jovem-especialistas, materiais, registros).

## O que o recon mostra

- **As vencedoras já são o produto.** A `/agenda` real já tem os modos
  `?aba=minha|por-mentorado|calendario`, `?visao=dpp|especialista`,
  coord `monitoramento|calendario`, auxiliar por-turma|consolidada
  (`src/app/(app)/agenda/page.tsx:194-362`) — tudo funciona na demo
  hoje, com o dataset demo cobrindo.
- **As perdedoras nunca foram codadas** — existem só como HTML em
  `docs/mockups/` (não servidos pelo app). Nenhum ponto do produto
  alcança as variantes avaliadas.
- **A `DemoBar` não tem nada de "Alterar view"** — hoje troca papel,
  rever onboarding, sair (`src/components/demo-bar.tsx:172-235`).
- **Análise anterior já documentada**: `docs/planos/issues/REALIZA-138/`
  (README, sdd, plan, acceptance) chega à mesma bifurcação e registra a
  Opção A como recomendação de trabalho; o README chega a anotar
  "DECIDIDO: Opção A" — mas nada foi implementado (`public/mockups/` e
  `/demo/mockups` não existem, `demo_view` não existe). Como a decisão
  formal segue com o Thiago, este doc reabre só a pergunta — não a
  análise.
- `docs/planos/implementacao-telas-finais.md` WP9 já prescreve o viewer
  de mockups (`src/lib/demo/mockups.ts` registry, assets públicos,
  "Layouts em teste").

## Opções

| | **A — Viewer de mockups na demo** | **B — Modos reais paralelos** | **C — Fechar sem código** |
|---|---|---|---|
| O que é | Os HTMLs de `docs/mockups/` viram assets em `public/mockups/`; `/demo/mockups/[tela]?v=` embute a variante em iframe; `DemoBar` ganha "Alterar view" contextual; cookie `demo_view` lembra a escolha | `demo_view` alterna componentes React reais dentro da rota do produto — cada variante vira código mantido | As abas reais (`?aba=`) bastam como "views"; fecha a issue sem viewer |
| Fidelidade ao pedido | Alta — compara **literalmente** o que foi avaliado (dataset canônico único do `_brief-final.md`) | Média — reimplementa as perdedoras; compara "o que foi recodado", não "o que foi julgado" | Baixa — `?aba=` compara escopos do desenho final, não as variantes perdedoras |
| Esforço | **P** — mover assets, registry ~4KB, 2 rotas, seção na DemoBar, exceção CSP `/mockups/*`, 2 testes | **G** — 3+ implementações mantidas por tela: superfícies, queries e e2e multiplicados por variante | Zero |
| Risco | CSP `frame-ancestors` (hoje `none` em `next.config.ts:35`) — mitigado por exceção escopada + `sandbox="allow-scripts"`; 2 mocks com `<script>` inline; drift docs↔public | Divergência permanente: cada fix de produto não propaga para as variantes mortas; contraria SLC (manter código morto de propósito) | Equipe sem acesso aos mocks não consegue comparar — a necessidade original segue aberta |
| Removibilidade | Total — `public/mockups/` + rotas + seção somem ao fim da validação (WP9 prevê; marcar `REALIZA-138`) | Nenhuma — modo real vira superfície de produto a manter | — |

## Recomendação

**Opção A** — é o que o WP9 já prescreveu, custo P, zero migration, e é a
única fiel ao propósito ("ver as variantes que competiram"). B é
reimplementação cara de layouts já rejeitados; C deixa o material de
avaliação inacessível a quem não clona o repo.

Detalhe de segurança da A: `iframe sandbox="allow-scripts"` sem
`allow-same-origin`, CSP escopada `default-src 'none'` +
`frame-ancestors 'self'` no path dos assets, `?v=` inválido cai na
variante decidida, cookie `demo_view` no padrão dos demais cookies demo
(limpo em `limparCookiesDemo`/`limparDemo`).

## Pergunta a responder (Thiago)

> **"Manter só a vencedora no produto e expor as variantes como mockups
> navegáveis na demo (A — recomendada), ou construir modos reais
> paralelos (B)?"** — se B, a issue vira épico e precisa de recorte de
> quais variantes realmente valem manter.

Decisão registrada aqui → a spec de implementação é escrita a seguir (o
`docs/planos/issues/REALIZA-138/sdd.md` já tem a arquitetura completa da
Opção A pronta para virar plano).

## Validação da decisão (não é aceite de implementação)

- [ ] A opção escolhida responde ao pedido original — quem avaliou os
  mocks consegue revê-los sem clonar o repo?
- [ ] Se A: aceito o custo permanente zero (artefato de avaliação,
  removível por grep `REALIZA-138`)?
- [ ] Se B: aceito manter N implementações por tela e o e2e
  multiplicado?
- [ ] Escopo temporal confirmado: viewer é temporário (some após a
  validação dos mocks) ou permanente como material de divulgação?

## Fora de escopo (desta decisão)

- Implementar qualquer opção (só após a escolha).
- Side-by-side de duas variantes na mesma viewport (evolução trivial do
  viewer se A vencer — 2 iframes).
- Novos mockups ou rodada nova de layout.
- Qualquer migration — nenhuma opção toca o banco (A só move assets e
  um cookie de preferência).
