# Base legal do tratamento (LGPD)

> Mapeamento das hipóteses legais que cobrem — ou deveriam cobrir — cada
> finalidade do programa. Onde a base depende de texto de termo ainda não
> revisado, está marcado **† em revisão jurídica** (ver §5).
>
> Referências: Arts. 7 (dados pessoais), 11 (dados sensíveis) e 14 (crianças
> e adolescentes) da Lei 13.709/2018.

## 1. Mapa por finalidade

| Finalidade | Titular | Base legal | Instrumento / estado |
|---|---|---|---|
| Operar o programa (cadastro, matching, agenda, registros, instrumentos) | Adulto (mentor/supervisor/coord) | **Consentimento** (Art. 7, I) + execução do termo de adesão (Art. 7, V) | `consent_lgpd_em` no onboarding + `termo-voluntario` assinado — **ok** |
| Operar o programa | Jovem (adolescente) | **Consentimento específico e em destaque por pelo menos um dos pais/responsável** (Art. 14, §1º) | `autorizacao-responsavel` via `/assinar/[token]` — **texto EM REVISÃO JURÍDICA** (§5) |
| Dados sensíveis de menor (roda_vida: saúde/espiritualidade/relação afetiva; cor/raça; anamnese; imagem) | Jovem | **Consentimento específico e destacado** — Art. 11, I já prevê "o titular **ou seu responsável legal**" + Art. 14, §1º | **sem cobertura hoje** — a cláusula 2.1 do rascunho não menciona dados sensíveis; lacuna L-2, revisão §5. Não há hipótese sem-consentimento aplicável à operação regular (as alíneas do Art. 11, II são estreitas — ex.: tutela da saúde é restrita a serviços de saúde) — **o consentimento específico é a única rota, o que torna a revisão do texto o elo crítico** |
| Dados sensíveis de adulto (`cor_raca`, ficha íntima de matching) | Adulto | **Consentimento específico e destacado** (Art. 11, I) | parcial — checkbox LGPD genérico; revisão §5 |
| Evidência de assinatura (IP, UA, hash, snapshot) | Signatário | **Exercício regular de direitos** (Art. 7, VI) | implementado (0053) — ok |
| Relatório público `/resumo/[slug]` a parceiros/diretoria | Jovem+Adulto | a confirmar — compartilhamento com terceiro vai além da "finalidade do programa" do rascunho; lacuna L-7 | pendente |
| Log de acesso `resumo_acessos` (ip_hash, UA) | Visitante | **Legítimo interesse** (Art. 7, IX — segurança e auditoria) | ok — minimização por hash+salt |
| Logs operacionais (`emails_enviados`, `notificacoes`, `interacoes`, `dupla_saude_snapshots`, `trilha_lembretes`, `ia_eventos`) | Adulto/Jovem | **Legítimo interesse** (Art. 7, IX) | ok |
| E-mail transacional (Resend) e magic link (Supabase Auth) | Adulto/Jovem/Responsável | Execução da relação + legítimo interesse | ok; ver subprocessadores §4 |
| Terceiros indicados (`terceiros_contatos`) | Terceiro | **sem base hoje** — lacuna L-1; mitigação proposta: legítimo interesse + aviso + exclusão a pedido | pendente — §5 |
| Caderneta privada (`pessoa_notas`) | Jovem/Adulto | Legítimo interesse do autor | decisão deliberada — só o autor lê (0017) |
| Sentry (telemetria de erro) | Adulto/Jovem (metadados) | Legítimo interesse — scrub de PII, sem replay | ok |

## 2. Consentimento — mecanismos existentes

- **`profiles.consent_lgpd_em`** — latch imutável (`0053:723-727`): grava o
  carimbo do checkbox no cadastro; não pode ser apagado nem retrodatado.
  Cobre o adulto que se cadastra.
- **`assinaturas`** — evidência eletrônica (snapshot dos dados, IP, UA,
  hash SHA-256, versão do template) — cobre o responsável legal
  (`autorizacao-responsavel`), o mentor (`termo-voluntario`) e o jovem
  (`termo-mentorando`).
- **Sem mecanismo** — terceiros indicados (nunca assinam nada) e dados
  sensíveis específicos (não nomeados no texto vigente).

## 3. Direitos do titular — capacidade atual

| Direito | Estado |
|---|---|
| Confirmação/acesso | parcial — RPCs `meus_dados_civis` (0046) e `meus_dados_pessoais` (0048) devolvem os próprios dados; pedido manual à coordenação cobre o resto. Endpoint dedicado não existe. |
| Correção | self-edita os campos públicos; sensíveis/civis via coordenação |
| Eliminação | só via coordenação (cascata manual); sem anonimização — política em `politica-retencao.md` |
| Portabilidade | `/api/export` é relatório operacional da coord, não "meus dados" do titular |
| Revogação do consentimento | canal `mentoria@realiza.vc`; efeito prático = saída do programa (`situacao='desistente'`) — o que acontece com os dados depois está na política de retenção |

## 4. Subprocessadores (operadores)

Estado: **não listados em `/privacidade` e sem DPAs formais registrados** —
lacuna L-7. Inventário do que atravessa cada um:

| Operador | Papel | Dados que atravessam |
|---|---|---|
| Supabase (Postgres + Auth + Storage) | banco, auth, arquivos | todo o banco + buckets + e-mail de login |
| Vercel | hosting/edge | todo o tráfego (headers, IP, sessão) |
| Resend | e-mail transacional | endereços de destinatários + assunto/corpo dos envios |
| Sentry | telemetria de erro | metadados de erro com scrub (`src/lib/sentry-scrub.ts`), sem replay |

## 5. Cláusulas da autorização — **EM REVISÃO JURÍDICA (Thiago)**

> O texto vigente de `CLAUSULAS_AUTORIZACAO`
> (`src/lib/documentos/texto.ts:100-129`) é **rascunho interno sem fonte
> oficial** — `docs/fontes/` só tem o `termo-adesao-voluntario.txt` do
> adulto. A revisão é pessoal do Thiago com o jurídico. **Não escrever
> redação final aqui** — só o que a cláusula precisa cobrir:

**Pendentes que a revisão precisa endereçar:**

1. **Dados sensíveis (Art. 11 + 14)** — a 2.1 atual cobre genericamente
   "seleção de mentor, acompanhamento pedagógico e segurança"; precisa
   nomear em destaque: saúde e disposição, equilíbrio emocional,
   espiritualidade, vida familiar e relação afetiva (Roda da Vida +
   Anamnese), autodeclaração de cor/raça, e **imagem** (avatar público e
   evidências com rosto).
2. **Imagem** — avatar em bucket público (`avatares`, qualquer link abre) e
   anexos de evidência; a decisão de bucket público precisa constar da
   autorização ou ser revista (lacuna L-5).
3. **Terceiros indicados** — contatos de familiares/amigos (`terceiros_*`,
   0103): como o jovem/responsável declara que os indicados foram avisados,
   e o que a ONG oferece (aviso no convite + exclusão a pedido) — lacuna L-1.
4. **Compartilhamento com parceiros** — relatório de turma por link
   (`/resumo`) para parceiros/diretoria/financiadores: a finalidade
   "prestação de contas" precisa estar no texto ou o relatório precisa
   ficar restrito a dados que a finalidade atual cobre (lacuna L-7).
5. **Arestas binárias** que a revisão decide (perguntas do `decisao.md`):
   - `mentorados.notas` volta a ser coord-only? (hoje legível por
     mentor/supervisor da dupla via grant `0034:194`) — lacuna L-3
   - remover `comprovante_bancario` dos tipos de `documentos_pessoa`
     (`0054:129`)? — minimização, lacuna L-4
   - quem revisa — jurídico pro bono da org ou validação do Léo
6. **Versão e reemissão** — ao fechar texto novo: bump
   `documento_templates.versao` e reemitir `autorizacao-responsavel` só
   onde faltar (decisão escopo B); a versão assinada fica preservada em
   `dados_snapshot`/`hash_documento`.

**Marca obrigatória:** enquanto a revisão jurídica não fechar, todo
documento/código que tocar a autorização carrega a nota
`EM REVISÃO JURÍDICA — Thiago` e nenhuma redação nova entra em produção.

## 6. Gate jurídico para processamento novo

A ata de alinhamento (`docs/planos/README.md:75`, decisão 6) já condiciona
**IA sobre texto livre de menores** (REALIZA-178/179/180) a parecer
jurídico — gate mantido: a revisão deste documento é pré-requisito para
ligar qualquer flag de IA que leia `registros`, `formulario_respostas`,
`pessoa_notas`, `chamados` ou `avaliacoes_encontro`.
