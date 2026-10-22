# REALIZA-33 — Decisão: escopo da revisão LGPD estrutural

## Contexto

Dados sensíveis de menores já estão em produção (dados civis, respostas de
instrumentos, anexos, avaliações de terceiros). Antes tudo morava no Drive/Docs
da org; agora a plataforma concentra o acervo — e a responsabilidade. O Jira
pede: inventário por tabela (Art. 11), visibilidade por papel, base legal +
consentimento, retenção/anonimização pós-ciclo, e parecer jurídico como gate
pra processamento novo.

A **visibilidade por papel já está decidida e implementada** (rodada 3,
`_contexto.md:111`): coord vê tudo, supervisor da dupla vê como mentor,
auxiliar por turma não vê dados civis. O que falta é o inventário formal
(**abaixo, draft completo — é o entregável real da issue**), a revisão da base
legal e a política de retenção.

---

## Inventário draft de dados sensíveis (verificado contra `supabase/migrations/`)

Legenda visibilidade: **coord** = coordenação · **dupla** = mentor+supervisor
daquela dupla · **self** = o próprio titular · **jovem** = mentorado dono ·
**autor** = só quem escreveu · **público-token** = quem tem o link.
"A11" = sensível no Art. 11 LGPD (e Art. 14 para adolescentes).

| Tabela / coluna | Conteúdo | A11? | Quem lê | Retenção atual |
|---|---|---|---|---|
| `profiles.dados_civis` (0046) | nome civil, RG, CPF, nascimento, endereço | parcial (doc ID) | coord (`profiles_pessoal`), self via `meus_dados_civis` | permanente |
| `profiles` — `data_nascimento, genero, pref_genero_par, motivacao` (0034) | ficha matching | sim (íntimo) | coord-only (revoke explícito, `0034:183-190`) | permanente |
| `profiles.cor_raca` (0054) | autodeclaração | **sim** | coord-only | permanente |
| `profiles.form_bruto` (0054) | payload integral do intake (arquivo morto) | potencial | coord-only; nem o dono edita | permanente |
| `profiles.documento_path` (0012) | doc oficial upado | sim | coord (bucket `documentos` coord-only) | permanente |
| `profiles.consent_lgpd_em` (0034) | carimbo do consentimento | — | staff vê flag (`pessoas/[id]/page.tsx:881`) | latch (`0053:723`) |
| `mentorados` — mesmas colunas sensíveis + `responsavel` jsonb (0034/0046) | ficha do jovem + **dados civis do responsável** (terceiro!) | sim | coord-only (`mentorados_pessoal`) | permanente |
| `mentorados.notas` (0001) | notas livres da coord sobre o jovem | potencial | **coord + mentor/supervisor da dupla** (está no grant de coluna, `0034:194`) — aresta a revisar | permanente |
| `mentorados.curriculo_path/url` (0081) | currículo | sim | coord + supervisor via `mentorados_curriculo` | permanente |
| `mentorados.situacao/saiu_em/motivo_saida` (0077) | saída e motivo | potencial | staff (grant de coluna) | permanente |
| `documentos_pessoa` + bucket `documentos` (0054) | RG, CPF, comprovante residência, **comprovante bancário**, currículo | sim | **coord-only integral** (nem o dono lê) | permanente — "arquivo morto" |
| `formulario_respostas` — sistema `anamnese` (0042) | convivência em casa, bairro/comunidade, rede de apoio, rotina | **sim** (vida familiar/social de menor) | tabela coord-only; `instrumentos_da_dupla` **não** expõe anamnese (só visao/roda/pdm/metas, `0080:546`) | permanente |
| `formulario_respostas` — `roda_vida` (0080) | notas 1–10 por eixo: **Saúde, Família, Espiritualidade** etc. | **sim** (saúde, convicção) | coord + mentor + supervisor + jovem da dupla (`0093:38-44`) | permanente |
| `formulario_respostas` — `visao, pdm, metas` (0080) | objetivos, metas SMART, submetas | potencial | idem | permanente |
| `formulario_respostas` — `avaliacao_360, autoavaliacao_mentor, avaliacao_especialista` (0042/0104) | avaliações de fim de ciclo | potencial | coord-only na tabela | permanente |
| `avaliacoes_encontro` (0071) | estrelas, sentimento, comentário, pedir_apoio do jovem | potencial | coord/supervisor; mentor só se `avaliacao_visivel_mentor`; média quantizada ≥3 (`avaliacao_media_dpp`) | permanente |
| `terceiros_contatos` (0103) | **nome + WhatsApp de amigos/familiares do jovem — pessoas que não consentiram** | sim (terceiro) | coord + mentor + supervisor da dupla | token expira 30d; contato permanece |
| `terceiros_respostas` (0103) | pontos_fortes/a_melhorar **sobre o jovem** | potencial | coord + mentor + supervisor; **jovem nunca** | permanente |
| `terceiros_consolidacao` (0103) | síntese curada | potencial | + jovem quando `publicado_em` | permanente |
| `assinaturas` (0033/0053) | `dados_snapshot` (civis), **ip, user_agent**, hash sha256 | sim | signatário + coord | permanente (evidência jurídica — **quer** reter) |
| `registros` (0001/0002) | reflexões/observações livres do mentor sobre o jovem | potencial | coord + mentor + supervisor da dupla | permanente |
| `encontro_notas` (0015) | anotações pré-encontro do mentor | potencial | idem | permanente |
| `pessoa_notas` (0016/0017) | caderneta sobre uma pessoa | potencial | **só o autor** (nem coord) | permanente |
| `supervisoes.resumo` (0041) | sessão supervisor↔mentor | potencial | coord + autor + **mentor-alvo** (transparência) | permanente |
| `chamados` + comentarios/anexos (0084) | mensagem livre, categoria `urgencia` | potencial (saúde/conflito) | equipe + autor; supervisor não vê `plataforma` | permanente |
| `solicitacoes_especialista.motivo/demanda/justificativa` (0027→0086) | texto livre sobre o jovem | potencial | escopo da solicitação | permanente |
| `devolutivas` / `duplas.devolutiva_pdm` (0086/0037) | feed e devolutiva da trilha | potencial | autor + coord + jovem | permanente |
| `encerramentos` (0037) | autoavaliação do mentor, resumo da jornada | potencial | coord + mentor + supervisor | permanente |
| `registro_anexos` (0009), `chamado_anexos` (0084) | evidências (foto/doc) — pode conter rosto de menor | **sim** (imagem) | escopo dupla/chamado; bucket privado | permanente |
| `avatares` bucket (0014) | **fotos de perfil — bucket PÚBLICO** | **sim** (imagem de menor) | **qualquer um com o link** (decisão consciente, registrada em `/privacidade` §4) | permanente |
| `materiais` (0001/0010) | biblioteca de programa | não | por audiência | permanente |
| `interacoes.nota` (0008) | log de nudges WhatsApp | baixo | escopo dupla | permanente |
| `emails_enviados` (0056) | assunto + lista de destinatários | baixo | coord-only | permanente |
| `notificacoes` (0018) | pings in-app (corpo pode citar nomes) | baixo | destinatário | sem purge (histórico some no limit) |
| `presencas` (0040) | chamada de formação | baixo | coord/self/supervisor-dos-mentores | permanente |
| `ia_eventos.args` (0083) | args canônicos das tools (sem payload de retorno — desenho já evita transcript com PII) | potencial | self + coord | permanente |
| `login_handoffs` (0049) | tokens de sessão | credencial | ninguém (revoke total; RPCs) | TTL 10min + uso único |
| `formulario_links/avaliacao_links/terceiros/assinaturas` — tokens | bearer | credencial | público-token | expiração por token (60d/30d), não do dado |

## O que já está certo (não mexer)

- Grants por coluna + `revoke` explícito documentado nas sensíveis (`0034`),
  views coord-only definer (`profiles_pessoal`, `mentorados_pessoal`,
  `profiles_contato`), `anon` com zero grants (`0032`), fluxo público só por
  RPC `security definer` com gate de status/expiração.
- `pessoa_notas` autor-only (0017); `avaliacoes_encontro` com visibilidade
  opt-in do jovem + média quantizada (0071); `chamados` com escopo equipe
  (0084); `documentos_pessoa` coord-only integral (0054).
- Sentry com scrub de tokens/PII (`src/lib/sentry-scrub.ts`), sem Session
  Replay por decisão (menores); CSP `frame-ancestors 'none'`; assinaturas com
  evidência (IP/UA/hash) — desenho LGPD-aware.
- Página `/privacidade` publicada com direitos do titular e canal
  (`src/app/privacidade/page.tsx`).

## Gaps encontrados (o que a revisão precisa endereçar)

1. **Base legal do menor é rascunho.** `CLAUSULAS_AUTORIZACAO` está marcada
   "RASCUNHO — não existe fonte oficial em docs/fontes. Texto mínimo para
   revisão jurídica antes de produção" (`src/lib/documentos/texto.ts:100-103`).
   A cláusula 2.1 cobre "seleção de mentor, acompanhamento pedagógico e
   segurança" — **não menciona dados sensíveis** (roda_vida: saúde/
   espiritualidade; cor/raça; anamnese familiar), **imagem** (avatar público,
   evidências com rosto) nem **dados de terceiros** (contatos 0103).
2. **Retenção = zero.** `situacao`/`saiu_em` marca a saída (0077) mas nada
   expira nem anonimiza; desistentes de ciclos passados seguem com PII
   completa. Únicas expirações são de **tokens**, não de dados.
3. **Terceiros sem consentimento** (0103): nome+WhatsApp de amigo/família
   ficam armazenados sem base — mitigação barata: aviso no convite + texto do
   termo do jovem cobrindo "contatos indicados" + exclusão a pedido.
4. **Aresta `mentorados.notas`:** notas da coord (potencialmente sensíveis)
   são legíveis pelo mentor/supervisor da dupla por estarem no grant de
   coluna — decidir se é intencional ou se migra pra `*_pessoal` coord-only.
5. **Subprocessadores não listados** em `/privacidade` (Supabase, Resend,
   Vercel, Sentry) e sem DPAs formais registrados.
6. **Sem procedimento de eliminação/portabilidade**: `/api/export` é relatório
   operacional coord, não "meus dados" do titular (embora existam RPCs
   `meus_dados_civis`/`meus_dados_pessoais` — base pronta).
7. **`comprovante_bancario`** é tipo aceito de `documentos_pessoa` (0054:129)
   — dado bancário de menor/responsável, provavelmente desnecessário
   (minimização: remover do enum ou justificar).

## Opções de escopo

### A — Só inventário e registro (doc-only)

Escreve o inventário final (a partir do draft acima), registra a visibilidade
já implementada e a política de retenção desejada **no papel**, sem mudar
termo nem código.

- **Prós:** mais barato; documento de referência existe.
- **Contras:** deixa vivo o gap mais grave — a base legal do menor é um
  rascunho que a própria fonte admite precisar de revisão jurídica; retenção
  continua zero na prática.

### B — Inventário + base legal + política de retenção escrita (recomendada)

A + revisão do texto `CLAUSULAS_AUTORIZACAO` para cobrir dados sensíveis,
uso de imagem e contatos de terceiros (bump `documento_templates.versao` +
reemissão só onde faltar); decisão sobre `mentorados.notas` e
`comprovante_bancario`; política de retenção escrita (ex.: anonimizar
desistentes após N meses do fim do ciclo; instrumentos/respostas viram
agregado após 1 ciclo) **sem** implementar o expurgo automático ainda;
`/privacidade` ganha lista de operadores + prazos.

- **Prós:** fecha a base legal (o passivo real), custo pequeno (texto +
  doc), alinha com o gate já exigido pra IA.
- **Contras:** retenção fica manual (coord executa via SQL/export) — aceitável
  no volume atual (dezenas de mentorados/ciclo).

### C — B + implementação de retenção/anonimização

B + feature real: RPC/job de anonimização pós-ciclo (pseudonimizar
nome/contato/documentos de desistentes e de encerradas após o prazo,
preservando agregados estatísticos), e possivelmente endpoint "meus dados"
do titular.

- **Prós:** conformidade completa; escala pra N ciclos.
- **Contras:** M–G; anonimização cascateia por ~15 tabelas com FK e
  evidências jurídicas (assinaturas **precisam** continuar íntegras — o hash
  perde sentido se o snapshot for anonimizado); prematuro antes do 1º
  encerramento de ciclo real.

## Recomendação

**Escopo B agora.** O inventário draft acima já é 60% do trabalho; completar
com a revisão jurídica pontual do texto da autorização (é o elo mais fraco —
rascunho sem fonte oficial), a decisão sobre as 2 arestas (`notas`,
`comprovante_bancario`), o aviso/termo pros contatos de terceiros e a
política de retenção por escrito. **C vira follow-up** natural do primeiro
encerramento de ciclo (quando houver `concluida`/`desistente` reais pra
expurgar — hoje quase tudo é ciclo corrente). O **parecer jurídico** fica
restrito à peça que importa (texto do termo + política), não uma revisão
genérica — e continua como **gate fechado** pra IA sobre texto livre de
menores (REALIZA-178+).

## Decisão que falta o Thiago assinar

**Confirma o escopo B — inventário final + revisão jurídica do texto da
`autorizacao-responsavel` (cobrindo dados sensíveis, imagem e terceiros) +
política de retenção escrita sem automação — deixando a anonimização
automática (C) pra follow-up do 1º encerramento de ciclo?**

Confirmações menores que viajam junto (se B): (i) `mentorados.notas` volta a
ser coord-only? (ii) remove `comprovante_bancario` dos tipos de
`documentos_pessoa`? (iii) quem revisa o texto do termo — jurídico pro bono
da org ou validação do Léo?
