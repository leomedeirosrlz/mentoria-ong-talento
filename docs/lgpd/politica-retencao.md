# Política de retenção e eliminação (escrita — sem automação)

> Escopo B: política **escrita**, execução **manual** pela coordenação via
> SQL/export enquanto o volume é dezenas de mentorados/ciclo. A deleção
> automática é escopo C — follow-up do primeiro encerramento de ciclo real
> (`docs/planos/issues/REALIZA-33/decisao.md`).
>
> **Estado de cada regra:** `decidido` = implementado/decisão fechada ·
> `proposta` = recomendação deste documento, pendente de confirmação do
> Thiago/jurídico antes de virar rotina.

## 1. Regras por categoria

| # | Categoria (objetos) | Regra | Estado / execução |
|---|---|---|---|
| C-1 | **Evidência de assinatura** (`assinaturas` + `dados_snapshot` + ip/ua/hash + PDF) | **Permanente** — é a prova jurídica do consentimento; anonimizar o snapshot quebra o hash | decidido (desenho, 0033/0053) |
| C-2 | **Credenciais de sessão** (`login_handoffs`) | **10 min + uso único** | decidido — implementado (0049/0050) |
| C-3 | **Tokens de fluxo público** (`formulario_links`, `avaliacao_links`, `terceiros_contatos.token`, `assinaturas.token`) | expiração do token: 60d (avaliação) / 30d (terceiros/assinatura) — expira o **link**, não o dado | decidido — implementado (expiração lazy) |
| C-4 | **Log de acesso do relatório público** (`resumo_acessos`) | **13 meses** | decidido (`_decisoes.md`) — poda lazy na `abrir_relatorio` (`0110:347`), sem job |
| C-5 | **Log de e-mails** (`emails_enviados`) | **13 meses**, alinhado a C-4 (mesma natureza de auditoria; `falhas` carrega e-mails em claro) | **proposta** — hoje permanente; execução manual trimestral |
| C-6 | **Auditoria operacional** (`ia_eventos`, `trilha_lembretes`, `interacoes`, `dupla_saude_snapshots`) | **13 meses** — `dupla_saude_snapshots` pode virar série agregada sem limite (já nasce sem nomes/texto livre por desenho, `0107:23-25`) | **proposta** — snapshots são exceção: manter |
| C-7 | **Conteúdo operacional do ciclo** (`encontros`, `registros`, `encaminhamentos`, `encontro_notas`, `supervisoes`, `chamados`+anexos, `solicitacoes*`, `devolutivas`, `encerramentos`, `presencas`, `pdm`+`pdm_itens`, `notificacoes`, `comunicados`) | vida do programa: **enquanto a dupla/ciclo estiver ativo + 1 ciclo seguinte** para prestação de contas e continuidade de reingresso | **proposta** — hoje permanente |
| C-8 | **Instrumentos com dado sensível** (`formulario_respostas` de `anamnese`, `roda_vida`, `avaliacao_360`, `autoavaliacao_mentor`, `avaliacao_especialista`; `avaliacoes_encontro`; `terceiros_respostas`/`consolidacao`) | **viram agregado/anonimizado após o fim do ciclo seguinte ao preenchimento** — a estatística do programa (notas médias, contagem de entregas) se preserva sem a resposta nominal | **proposta** (era o exemplo do escopo B) — pendente: definir formato do agregado |
| C-9 | **Ficha do mentorado desistente** (`mentorados` + `form_bruto`, `dados_civis`, `documentos_pessoa`, `documento_path`, `avatar_path`, `curriculo_*`, `responsavel`) | **anonimizar PII direta** (nome→iniciais, contatos/documentos/foto/responsável apagados) **N meses após o encerramento do ciclo** do jovem — proposta N=6, a confirmar (gatilho = `cronogramas.status='encerrado'`, não `saiu_em` — ver §2); linha permanece pra estatística e linhagem de duplas | **proposta** — pendente confirmação de N |
| C-10 | **`terceiros_contatos`** (nome+WhatsApp de não-titulares) | **expurgo do contato ao fim do ciclo da dupla** (o token já expira em 30d; o nome/telefone não precisam sobreviver à dupla) | **proposta** — pendente; atrelado à lacuna L-1 |
| C-11 | **Arquivos em storage** (`avatares`, `documentos`, `registro-anexos`, `chamado-anexos`, `materiais`) | seguem o dono: saem junto com a regra da tabela que os referencia; `avatares` de desistente apagado junto com C-9 | **proposta** — órfãos sem dona: lacuna L-8 |
| C-12 | **`pessoa_notas`** (caderneta privada do autor) | não expira pelo ciclo — é do autor, não da dupla; apaga com a conta do autor ou a pedido | **proposta** |
| C-13 | **`relatorio_links` revogados/expirados** | metadado permanece (fim da cadeia de custódia do `resumo_acessos`); sem dados de titular na linha | decidido por desenho (0110) |
| C-14 | **`profiles` de ex-voluntários** (`ativo=false`) | mesma regra C-9: anonimizar PII direta N meses após desativação | **proposta** — pendente confirmação de N |

## 2. O que a política NÃO cobre ainda (pendente de decisão)

- **N** da anonimização de desistentes (C-9/C-14) — proposta 6 meses; o
  gatilho certo é o encerramento do ciclo (`cronogramas.status='encerrado'`),
  não `saiu_em` — confirmar.
- **Formato do agregado** de instrumentos (C-8) — resposta nominal vira
  estatística; o que exatamente fica (médias por turma? por eixo da roda?)
  precisa de desenho quando o 1º encerramento real acontecer.
- **Reingresso** — mentorado `concluido` que volta como mentor (REALIZA-159:
  só `concluido` elegível) mantém ficha completa — a regra C-9 vale só pra
  `desistente`.
- **Backups do Supabase** — retenção gerenciada pela plataforma (plano free
  ≈ dump diário com retenção curta); fora do controle do app — registrar
  com o jurídico como ressalva.
- **`emails_enviados.ref_id`** — sobrevive à exclusão do objeto referenciado
  por desenho (log não pode apagar com o aviso); C-5 cobre o resto.

## 3. Execução manual (enquanto não há automação)

Sem pg_cron/pg_net e sem endpoint de retenção: a coordenação executa a
revisão **a cada encerramento de ciclo** (evento `cronogramas` →
`status='encerrado'`), seguindo:

1. **Poda de logs** — já automática em `resumo_acessos` (C-4); manual para
   `emails_enviados` (C-5) se a proposta for confirmada:
   `delete from emails_enviados where created_at < now() - interval '13 months'`.
2. **Terceiros** — `delete from terceiros_contatos where dupla_id in
   (select id from duplas where turma = <turma encerrada>)` — cascata leva
   respostas/consolidação **só se a decisão for expurgar tudo**; se a
   consolidação publicada ficar com o jovem, deletar só o contato.
3. **Desistentes** — lista: `mentorados where situacao='desistente'` do
   ciclo encerrado → anonimização manual de nome/contato/documentos/foto
   (C-9, após confirmação de N).
4. **Storage** — objetos apontados por rows expurgadas saem junto
   (C-11); varredura de órfãos sem dona é lacuna L-8.
5. **Registro da execução** — anotar data/escopo no histórico deste doc ou
   em issue de ops; a trilha de "o que foi expurgado quando" é parte da
   conformidade.

## 4. Relação com exclusão a pedido do titular

Pedido de eliminação (Art. 18, VI) segue o canal `mentoria@realiza.vc`:
a coordenação executa a exclusão manual (cascata) **imediatamente**, fora
do calendário acima — exceto `assinaturas` (C-1) e dados sob guarda legal,
que respondem com a justificativa de retenção.

## 5. Ressalvas

- Prazos `proposta` não estão vigentes — valem a partir da confirmação do
  Thiago/jurídico.
- A regra de retenção é por **categoria de dado**, não por tabela: uma
  mesma tabela pode ter colunas em categorias diferentes (ex.:
  `mentorados.nome` sai na anonimização, `mentorados.cidade/uf` pode ficar
  pro agregado).
