# REALIZA-33 — Revisão LGPD estrutural: inventário de dados sensíveis + visibilidade + retenção

- **Jira:** [REALIZA-33](https://kelyng.atlassian.net/browse/REALIZA-33) (Tarefa, prioridade **High**; migrada do Linear REALIZA-51)
- **Tier:** C — decisão/escopo (`decisao.md`)
- **Veredito de status:** **ESCOPO B ENTREGUE** (docs) — ver "Entregue" abaixo. **Seguem abertos:** revisão jurídica do texto da `autorizacao-responsavel` (Thiago), confirmação das 2 arestas (`mentorados.notas`, `comprovante_bancario`) e do N de anonimização, e a implementação de expurgo (escopo C, follow-up do 1º encerramento de ciclo).

## Escopo (o que a decisão precisa cobrir)

- Inventário de dados sensíveis por tabela — **draft já entregue em `decisao.md`** (tabela completa por tabela/coluna, classificação Art. 11, quem lê, retenção atual).
- Visibilidade por papel: a regra já está **implementada e decidida** (coord vê tudo — decisão 03/out em `_contexto.md:111`; `dados_civis`/`*_pessoal` coord-only; `instrumentos_da_dupla` expõe respostas a coord+mentor+supervisor+mentorado da dupla). Resta **registrar** e revisar 2 arestas (`mentorados.notas` legível pelo mentor; `avatares` bucket público com foto de menor).
- Base legal + consentimento: o termo `autorizacao-responsavel` (única base legal do menor) é rascunho interno; cláusula 2.1 cobre "finalidades do programa" genericamente — decidir se revisa o texto para cobrir dados sensíveis, imagem e terceiros.
- Retenção/anonimização pós-ciclo: hoje **zero** — saída vira `situacao`/`saiu_em` (`0077`), delete só via cascata coord. Decidir política escrita + se implementa anonimização automática.
- Terceiros não-titulares: `terceiros_contatos` guarda nome+WhatsApp de amigos/familiares do jovem que **nunca consentiram** (`0103`) — precisa de posição.
- Parecer jurídico como gate para processamento novo: IA sobre texto livre de menores (REALIZA-178/179/180) já está condicionada a isso no `docs/planos/README.md:76` (decisão 6 da ata).
- Subprocessadores e `/privacidade`: página existe (`src/app/privacidade/page.tsx`) mas não lista operadores (Supabase/Resend/Vercel/Sentry) nem prazos de retenção concretos.

## Dependências / bloqueios

- Nenhuma dependência técnica — é trabalho de decisão + documento.
- **Alimenta:** REALIZA-178/179/180 (IA) — a ata já marcou "IA sobre texto livre de menores" como pendente de parecer jurídico.
- Relacionada: REALIZA-55/20 (editor/atividades criam mais um corpus de dados do menor — convém entrar já coberto pela revisão).

## Esforço estimado

- **P** — inventário + decisões registradas + revisão do texto da autorização (escopo B da `decisao.md`).
- **M** — se incluir implementação de retenção/anonimização automática (escopo C).

## Riscos

- **Dados Art. 11 já em produção sem base legal específica** (espiritualidade/saúde da Roda da Vida; cor/raça no matching) — quanto mais demora, maior o passivo.
- Termo do responsável é rascunho não-revisado — se questionado por responsável/ONG parceira, não há lastro.
- Terceiros (amigos/família) armazenados sem nenhum consentimento — mitigação possível barata (aviso no convite + exclusão a pedido).
- Sem retenção: dados de desistentes ficam pra sempre; crescimento contínuo do passivo por ciclo.

> DECIDIDO (Thiago): escopo B aprovado; ele revisa cláusulas com o jurídico.

## Entregue (escopo B — docs)

Documentação formal em **`docs/lgpd/`** (documento vivo — tabela/coluna nova
com dado pessoal entra no inventário na mesma PR):

- **`inventario-dados.md`** — inventário por tabela/coluna: titular
  (jovem/adulto/responsável/terceiro/visitante), sensibilidade Art. 11,
  quem lê, base legal (Art. 7/11/14) e retenção atual. Cobre schema até
  `0111` — inclui as tabelas novas que o draft da `decisao.md` não tinha:
  `resumo_acessos` (0106), `dupla_saude_snapshots` (0107),
  `trilha_lembretes` (0108), `pdm`/`pdm_itens` (0109),
  `relatorio_links`+`turma_inscricoes` (0110/0111).
- **`base-legal.md`** — mapa de hipóteses legais por finalidade,
  mecanismos de consentimento existentes, direitos do titular (capacidade
  atual), subprocessadores, e a lista do que a cláusula de autorização
  precisa cobrir — marcada **EM REVISÃO JURÍDICA (Thiago)**, sem redação
  final inventada.
- **`politica-retencao.md`** — retenção por categoria C-1…C-14 com estado
  (decidido × proposta): `resumo_acessos` 13 meses (decidido, poda lazy já
  implementada na `abrir_relatorio`), assinaturas permanentes (evidência),
  tokens/TTL existentes, e propostas pendentes (instrumentos→agregado após
  1 ciclo, desistentes anonimizados N meses pós-ciclo — N proposto 6,
  terceiros expurgados ao fim do ciclo da dupla). Execução manual por
  encerramento de ciclo — **sem automação** (escopo C).
- **`lacunas-e-riscos.md`** — registro L-1…L-12 com evidência, severidade,
  estado e dono: consentimento de terceiros (L-1), base legal de sensíveis
  de menor (L-2), `mentorados.notas` (L-3), `comprovante_bancario` (L-4),
  avatares públicos (L-5), janela do link legado sem senha (L-6),
  subprocessadores/`/privacidade` (L-7), órfãos de storage (L-8), ausência
  de endpoint do titular (L-9), IP spoofável na evidência de assinatura
  (L-10), `p_ip_hash` forjável (L-11), retenção zero (L-12 — mitigado pela
  política escrita).

**Não entregue (fora do escopo B):** deleção/anonimização automática,
endpoint "meus dados" do titular, bump de versão do template da
autorização (espera a revisão jurídica fechar a redação).
