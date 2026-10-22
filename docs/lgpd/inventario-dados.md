# Inventário de dados pessoais por tabela

> Versão do schema: migrations `0001`–`0111` (verificação manual em
> `supabase/migrations/`). Fonte de recon: `docs/planos/issues/_recon/schema-mapa.md`
> + leitura direta das migrations `0106`–`0111` (posteriores ao mapa).
>
> **Documento vivo** — toda migration que cria tabela/coluna com dado
> pessoal deve acrescentar a linha correspondente aqui na mesma PR.

## Legenda

**Titular** (de quem é o dado):
- **Jovem** — mentorado (adolescente/jovem; em regra menor ou recém-maior —
  Art. 14 LGPD sempre que <18)
- **Adulto** — mentor DPP, mentor especialista, supervisor, coordenação
- **Responsável** — responsável legal do jovem (adulto, terceiro)
- **Terceiro** — familiar/amigo indicado pelo jovem (nunca consentiu)
- **Visitante** — quem abre links públicos sem conta

**Sensibilidade:**
- **A11** = dado sensível no Art. 11 da LGPD (origem racial, convicção
  religiosa/filosófica, saúde, vida sexual, dado biométrico/genetico) —
  para crianças/adolescentes vale também o Art. 14
- **parcial** — misto: parte sensível (documento oficial, endereço), parte comum
- **potencial** — campo de texto livre que pode receber dado sensível
- **baixo** — dado pessoal comum ou metadado operacional
- **credencial** — token/senha que concede acesso (não é dado "sobre" a
  pessoa, mas habilita ver dados dela)
- **—** — sem dado pessoal

**Quem lê:** `coord` = coordenação · `dupla` = mentor+supervisor daquela
dupla · `self` = o próprio titular · `jovem` = mentorado dono · `autor` =
só quem escreveu · `público-token` = quem tem o link · `equipe` =
coord+supervisor.

**Base legal** — detalhamento e caveats em `base-legal.md`:
- **C** = consentimento (Art. 7, I — adulto) · **C14** = consentimento do
  responsável (Art. 14, §1º — adolescente) · **Cs** = consentimento
  específico e destacado p/ dado sensível (Art. 11, I)
- **LI** = legítimo interesse (Art. 7, IX) · **ED** = exercício regular de
  direitos (Art. 7, VI) · **OL** = obrigação legal/regulatória (Art. 7, II)
- **—** = sem base coberta hoje (lacuna registrada em `lacunas-e-riscos.md`)
- **†** = base depende da cláusula **em revisão jurídica** (ver
  `base-legal.md` §5) — a cobertura é a pretendida, não a vigente

## 1. Cadastro e identidade

| Tabela / coluna | Conteúdo | Titular | Sens. | Quem lê | Base | Retenção atual |
|---|---|---|---|---|---|---|
| `profiles` — públicas (`nome, email, whatsapp, role, bio, linkedin, areas, avatar_path, cidade, uf, interesses, cargo, empresa, origem, nome_social`) | ficha operacional de staff/mentor | Adulto | baixo | escopo por papel (RLS `profiles_select`, 0076); diretório interno | C | permanente |
| `profiles` — sensíveis (`data_nascimento, genero, pref_genero_par, motivacao`) | ficha de matching | Adulto | sim (vida íntima potencial) | `profiles_pessoal` coord-only (revoke explícito, `0034:187`) | C | permanente |
| `profiles.cor_raca` (0054) | autodeclaração | Adulto | **A11** (origem racial) | coord-only | Cs † | permanente |
| `profiles.form_bruto` (0054) | payload integral do intake (arquivo morto) | Adulto | potencial | coord-only; nem o dono edita | C | permanente |
| `profiles.dados_civis` (0046) | nome civil, RG, CPF, nascimento, endereço | Adulto | parcial (documento ID) | `profiles_pessoal` coord-only; self via `meus_dados_civis` | C + ED (assinatura do termo) | permanente |
| `profiles.documento_path` (0012) | documento oficial upado | Adulto | parcial | coord (bucket `documentos`) | C | permanente |
| `profiles.consent_lgpd_em` (0034) | carimbo do checkbox de consentimento | Adulto | — | staff vê flag | — (é o registro da própria base) | latch imutável (`0053:723`) |
| `mentor_profiles` (0001/0034/0073) | tipo, áreas, capacidade, termo_ok, formacao_ok, experiência, disponibilidade | Adulto | baixo | 4 papéis staff + self (RLS) | C | permanente |
| `profile_papeis` (0085) | papel + escopo_turma | Adulto | baixo | self + staff | C | permanente |
| `mentorados` — públicas (`nome, email, whatsapp, ong_origem, avatar_path, cidade, uf, interesses, objetivos, escolaridade, origem, nome_social, contato_compartilhado`) | ficha operacional do jovem | Jovem | baixo | coord + mentor/supervisor da dupla (grant por coluna `0034:194` + RLS `0023`); turma dos colegas vê subconjunto via `mentorados_turma` (0076) | C14 † | permanente |
| `mentorados` — sensíveis (`data_nascimento, genero, pref_genero_par, motivacao`) | ficha matching do jovem | Jovem | sim | `mentorados_pessoal` coord-only | C14 † | permanente |
| `mentorados.cor_raca, form_bruto` (0054) | autodeclaração + raw intake | Jovem | **A11** / potencial | coord-only | Cs † (via responsável) | permanente |
| `mentorados.dados_civis` (0046) | civis do jovem | Jovem | parcial | `mentorados_pessoal` coord-only | C14 † | permanente |
| `mentorados.responsavel` jsonb (0046) | **civis do responsável legal** | Responsável | parcial | `mentorados_pessoal` coord-only | C do responsável (ele assina) † | permanente |
| `mentorados.notas` (0001) | notas livres da coord sobre o jovem (≤10000) | Jovem | potencial | **coord + mentor/supervisor da dupla** — está no grant de coluna (`0034:194`) | C14 † | permanente — **aresta aberta: ver `lacunas-e-riscos.md` L-3** |
| `mentorados.curriculo_path/url` (0081) | currículo do jovem | Jovem | potencial | coord + supervisor via `mentorados_curriculo` | C14 † | permanente |
| `mentorados.situacao/saiu_em/motivo_saida` (0077) | saída e motivo (≤300) | Jovem | potencial | staff + mentor/supervisor (grant de coluna `0077:42`) | C14 † | permanente — alvo da política de anonimização |
| `turma_inscricoes` (0111) | fila de turma: profile/mentorado + papel_esperado + status + `nota` ≤300 | Adulto/Jovem | baixo (nota: potencial) | coord-only (policy for all) | C / C14 † | permanente |

## 2. Operação do ciclo (dupla, agenda, registros)

| Tabela / coluna | Conteúdo | Titular | Sens. | Quem lê | Base | Retenção atual |
|---|---|---|---|---|---|---|
| `duplas` | vínculo mentor×mentorado×supervisor, turma, status, `demanda`, `devolutiva_pdm`, motivo_encerramento | Jovem+Adulto | potencial | coord/mentor/supervisor da dupla (0001); jovem via `jovem_duplas` (colunas reduzidas) | C + C14 † | permanente |
| `encontros` | data/hora, status, link, motivo_reagendamento | Jovem+Adulto | baixo | escopo dupla + jovem via `jovem_duplas`; `realizado` imutável (0043) | C + C14 † | permanente |
| `registros` | reflexões/observações do mentor sobre o jovem (≤20000) | Jovem | potencial | coord + mentor + supervisor da dupla | C14 † | permanente |
| `registro_anexos` + bucket `registro-anexos` | evidências (foto/doc) — **pode conter rosto de menor** | Jovem | **A11** (imagem) | escopo dupla; bucket privado, signed URL | Cs † | permanente |
| `encaminhamentos` | combinados da dupla | Jovem+Adulto | baixo | escopo dupla; jovem lê os dele via `jovem_encaminhamentos` | C + C14 † | permanente |
| `encontro_notas` | anotação pré-encontro do mentor | Jovem | potencial | escopo dupla | C14 † | permanente |
| `pessoa_notas` (0016/0017) | caderneta privada sobre uma pessoa | Jovem/Adulto | potencial | **só o autor** — nem coord lê (decisão deliberada 0017) | LI (anotação do voluntário) | permanente |
| `interacoes` (0008/0094) | log de nudges (canal, tipo, nota) | Jovem+Adulto | baixo | escopo dupla | LI | permanente |
| `supervisoes.resumo` (0041) | sessão supervisor↔mentor | Adulto | potencial | coord + autor + **mentor-alvo** (transparência, decisão 0041) | C | permanente |
| `solicitacoes_especialista` + `solicitacao_propostas` | motivo/demanda/justificativa/mensagens sobre o jovem | Jovem+Adulto | potencial | partes da negociação + coord | C + C14 † | permanente |
| `devolutivas` + `duplas.devolutiva_pdm` | feed da trilha especialista | Jovem | potencial | autor + coord + jovem (0089) | C14 † | permanente |
| `encerramentos` (0037) | checklist do rito, autoavaliação do mentor, resumo da jornada | Jovem+Adulto | potencial | coord + mentor + supervisor da dupla | C + C14 † | permanente |
| `presencas` (0040) | chamada de formação | Adulto | baixo | coord/self/supervisor-dos-mentores | C | permanente |
| `chamados` + atualizações/comentários/anexos (0084) | fila de atendimento; `categoria='urgencia'`; mensagem livre | Jovem/Adulto | potencial (saúde/conflito) | equipe + autor (supervisor não vê `plataforma`); anexos `interno` = equipe | C + C14 † | permanente |
| `dupla_saude_snapshots` (0107) | histórico do semáforo: `motivos/sinais` = **contagens+labels de enum, sem nomes nem texto livre** (verificação LGPD do PR — `0107:23-25`) | Jovem+Adulto (derivado) | baixo | coord + supervisor das duplas | LI | permanente |
| `trilha_lembretes` (0108) | ledger de lembretes do prazo (dupla, marco, destino) | Adulto | baixo | coord-only | LI | permanente |

## 3. Instrumentos e respostas (coração sensível do programa)

| Tabela / sistema | Conteúdo | Titular | Sens. | Quem lê | Base | Retenção atual |
|---|---|---|---|---|---|---|
| `formulario_respostas` — `anamnese` (0042) | convivência em casa, bairro/comunidade, rede de apoio, rotina | Jovem | **A11** (vida familiar/social de menor) | **coord-only** — `instrumentos_da_dupla` não expõe anamnese | Cs † | permanente |
| `formulario_respostas` — `roda_vida` (0080) | notas 1–10 em 16 eixos: **Saúde, Equilíbrio emocional, Família, Relacionamento amoroso, Espiritualidade** (`0080:639-657`) | Jovem | **A11** (saúde, convicção, vida íntima) | coord + mentor + supervisor + **jovem da dupla** (`0093:39-46`) | Cs † | permanente |
| `formulario_respostas` — `visao, pdm, metas` (0080) | objetivos, metas SMART, submetas | Jovem | potencial | escopo dupla + jovem | C14 † | permanente |
| `formulario_respostas` — `avaliacao_360` (0042) | vínculo, evolução, PDM — respondida por mentor **e** jovem | Jovem+Adulto | potencial | coord na tabela; jovem lê **só a própria resposta** via `jovem_jornada` (`0096:218-222`) | C + C14 † | permanente |
| `formulario_respostas` — `autoavaliacao_mentor`, `avaliacao_especialista` (0042/0104) | avaliações de fim de ciclo/trilha | Adulto | potencial | coord-only na tabela | C | permanente |
| `formulario_respostas` — forms comuns (0036) | respostas de formulários criados pela coord | variável | potencial | coord-only | conforme o form † | permanente |
| `pdm` + `pdm_itens` (0109) | PDM vivo: visão + metas/submetas (texto do jovem e da dupla) | Jovem | potencial | coord + mentor + supervisor + jovem (policy `0109:170-192`) | C14 † | permanente |
| `avaliacoes_encontro` (0071) | estrelas 1–5, sentimento, comentário, `pedir_apoio` do jovem | Jovem | potencial | coord/supervisor; mentor só se `avaliacao_visivel_mentor` ∧ trilha≠especialista; jovem lê a própria via `jovem_duplas`; média quantizada ≥3 (`avaliacao_media_dpp`) | C14 † | permanente |
| `terceiros_contatos` (0103) | **nome + WhatsApp de amigos/familiares indicados pelo jovem — pessoas que nunca consentiram** | Terceiro | sim (não-titular) | coord + mentor + supervisor da dupla | **— lacuna L-1** | token expira 30d; **contato permanece** |
| `terceiros_respostas` (0103) | pontos_fortes/a_melhorar **sobre o jovem** | Jovem | potencial | coord + mentor + supervisor; **jovem nunca** | C14 † | permanente |
| `terceiros_consolidacao` (0103) | síntese curada pelo mentor | Jovem | potencial | escopo dupla + jovem quando `publicado_em` | C14 † | permanente |
| `especialista_grade` / `especialista_excecoes` (0073) | agenda semanal e bloqueios do especialista | Adulto | baixo | self + coord | C | permanente |

## 4. Assinaturas, evidência e documentos

| Tabela / coluna | Conteúdo | Titular | Sens. | Quem lê | Base | Retenção atual |
|---|---|---|---|---|---|---|
| `documento_templates` (0033) | versões dos termos | — | — | authenticated (metadados) | — | permanente |
| `assinaturas` (0033/0053) | `dados_snapshot` (civis), **ip, user_agent**, `hash_documento` sha256, assinatura_texto | Adulto/Responsável/Jovem | parcial | signatário + coord | ED + C | **permanente — evidência jurídica, deliberadamente retida (o hash perde sentido sem o snapshot íntegro)** |
| `documentos_pessoa` + bucket `documentos` (0054) | RG, CPF, comprovante residência, **`comprovante_bancario`**, currículo | Adulto/Jovem | sim | **coord-only integral** (nem o dono lê) | C / C14 † | permanente — "arquivo morto" — **`comprovante_bancario` = lacuna L-4** |
| `login_handoffs` (0049/0050) | access/refresh tokens do magic link | Adulto/Jovem | credencial | ninguém (revoke total; RPCs uso-único) | — | **TTL 10min + uso único** |
| `formulario_links`, `avaliacao_links`, `terceiros_contatos.token`, `assinaturas.token` | bearer tokens de fluxos públicos | Jovem/Terceiro/Responsável | credencial | público-token | — | expiração do token (60d avaliação / 30d terceiros / 30d assinatura reemitível) — **do token, não do dado** |
| `relatorio_links` (0110/0111) | slug, `senha_hash` bcrypt, `config` do recorte, revogação | — (config sobre Jovem/Adulto) | credencial | coord-only; público via RPCs `relatorio_link_info`/`abrir_relatorio` | — | enquanto vivo + rastro em `resumo_acessos` |

## 5. Comunicação e notificações

| Tabela / coluna | Conteúdo | Titular | Sens. | Quem lê | Base | Retenção atual |
|---|---|---|---|---|---|---|
| `comunicados` (0018/0055) | avisos da coordenação | Adulto/Jovem (corpo pode citar nomes) | baixo | por audiência | LI | permanente |
| `notificacoes` (0018) | sino in-app (corpo pode citar nomes) | Adulto/Jovem | baixo | destinatário | LI | sem purge — histórico morre no limit da UI |
| `emails_enviados` (0056/0071/0084) | assunto + contagem de destinatários + **`falhas text[]` com e-mails que falharam** | Adulto/Jovem | baixo | coord-only | LI | permanente — política em `politica-retencao.md` C-5 |
| `ia_eventos.args` (0083) | args canônicos das tools IA (pode conter texto do usuário ≤300c) | Adulto | potencial | self + coord | LI | permanente |

## 6. Superfícies públicas e storage

| Objeto | Conteúdo | Titular | Sens. | Quem lê | Base | Retenção atual |
|---|---|---|---|---|---|---|
| bucket `avatares` (0014) | **fotos de perfil — bucket PÚBLICO** | Jovem/Adulto | **A11** (imagem — jovem pode ser menor) | **qualquer um com o link** | Cs † — decisão consciente registrada em `/privacidade` §4; pendente confirmação jurídica (lacuna L-5) | permanente |
| bucket `materiais` | biblioteca do programa | — | não | por audiência | — | permanente |
| bucket `documentos` | documentos oficiais | Adulto/Jovem/Responsável | sim | coord (+ supervisor só currículo supervisionado; `sistema/%` = authenticated p/ contra-assinatura) | C / C14 † | permanente |
| bucket `chamado-anexos` | anexos de chamado | Jovem/Adulto | potencial | visibilidade do chamado | C + C14 † | permanente — órfãos sem ciclo de vida (lacuna L-8) |
| `/resumo/[slug]` + `resumo_acessos` (0106/0110) | relatório público: nomes, cidade/UF, par, status (contato só com `expor_contato`); log de acesso `ip_hash`+`user_agent` | Jovem/Adulto (dados) · Visitante (log) | baixo | público com link+senha (legado `t2-x7k4m9qf2w8j` **sem senha até `expira_em`+120d — lacuna L-6**); log coord-only | LI (relatório — cobertura jurídica a confirmar, L-7) · LI (log) | **13 meses — poda lazy implementada na `abrir_relatorio` (`0110:347`)** |
| `resumo_acessos` | `slug, ip_hash (SHA-256 salt+ip, nunca IP cru), user_agent, params, ok/motivo` | Visitante | baixo (pseudônimo) | coord-only; insert service-role | LI (segurança/auditoria) | **13 meses — decidido (`_decisoes.md`); poda lazy em produção** |

## 7. O que já está certo (controles existentes — não mexer)

- Grants por coluna + `revoke` explícito nas sensíveis (`0034`); views
  coord-only definer (`profiles_pessoal`, `mentorados_pessoal`,
  `profiles_contato`, `mentorados_curriculo`); `anon` com zero grants
  (`0032`); fluxo público só por RPC `security definer` com gates de
  status/expiração.
- `pessoa_notas` autor-only (`0017`); `avaliacoes_encontro` com
  visibilidade opt-in do jovem + média quantizada (`0071`); `chamados` com
  escopo equipe (`0084`); `documentos_pessoa` coord-only integral (`0054`).
- Sentry com scrub de tokens/PII (`src/lib/sentry-scrub.ts`), sem Session
  Replay por decisão (menores); CSP `frame-ancestors 'none'`; assinaturas
  com evidência (IP/UA/hash) — desenho LGPD-aware.
- Relatório público com allowlist de colunas em SQL (`0110`) —
  `dados_civis`, `form_bruto`, `*_pessoal`, `documento_path`, CPF/RG/IP/hash
  nunca saem; respostas Art. 11 fora da v1.
- `ip_hash` de visitante é pseudônimo (salt fora do banco,
  `RESUMO_ACESSO_SALT`; produção falha visível sem a env).
- Página `/privacidade` publicada com direitos do titular e canal.

## 8. Cobertura do inventário

Tabelas **sem** dado pessoal (citadas acima só por completude ou fora do
inventário): `ciclo_eventos`, `cronogramas`, `especialista_eventos`,
`materiais`, `formularios` (definições), `documento_templates` (versões dos
termos — metadado público).

Metadados de sistema fora do banco de domínio: `auth.users` (GoTrue —
e-mail, timestamps), logs de plataforma Vercel/Supabase/Sentry — cobertos
em `base-legal.md` §4 (subprocessadores).
