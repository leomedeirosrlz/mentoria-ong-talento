# Spec — Documentos do plano: combinado e roteiros semanais

**Feature:** `specs/020-docs-do-plano` · **Status:** Clarified
**Fila:** `REALIZA-521` · **Dono:** Thiago · **Data:** 23/11/2026

## Problema e resultado

- **Dor hoje:** o combinado é um card operacional (lista de passos + aceites) mas não há um documento legível do "o que foi combinado" que a dupla possa ler antes de aceitar; e o roteiro é o `roteiro-encontro-NN` estático do corpus — nenhum roteiro semanal por dupla derivado do plano vigente.
- **Resultado observável:** a hierarquia de documentos fica clara e sem quarto documento — **"O combinado"** (um por versão do plano, leitura do aceite, sai junto com a spec 017), **"Roteiro do encontro N"** (operacional da semana, absorve os `encontro_guia_ajustes`) e **"Biblioteca"** (o corpus de referência). O combinado é determinístico (planner, nunca a Liza); os roteiros nascem lazy — o primeiro quando o primeiro encontro é agendado, o N+1 quando o N é concluído, nunca os 16 de uma vez; auxiliar/coordenação geram uma semana sob demanda com preview, validação, rascunho/publicado, idempotência e invalidação por versão do plano.
- **Como saberemos que funcionou:** o jovem lê "o combinado" antes de aceitar; cada semana tem seu roteiro na hora certa; coordenação gera a semana 7 sob demanda, revisa o rascunho e publica; quando o plano muda de versão, os roteiros derivados marcam-se desatualizados e as versões publicadas anteriores seguem legíveis.

## Fora de escopo

- Geração por IA do conteúdo (spec 021 — o roteiro nasce determinístico do corpus + ajustes; a Liza entra depois como autora de variações).
- PDF/impressão (render na tela basta nesta rodada).
- Edição colaborativa do doc do combinado (é projeção do escopo — quem muda é a proposta/versão).
- Tradução/acessibilidade além do padrão da casa.

## Histórias de usuário

### US1 — Doc do combinado antes do aceite (P1)

- **Por que P1:** aceitar o que não se lê é aceite cego. O doc sai junto com a spec 017: é nele que "Ver o combinado" aterrissa.
- **Teste independente:** proposta ativa → doc disponível para os quatro papéis com o mesmo conteúdo.
- **Cenários:**
  1. **Dado** uma proposta no ar **quando** qualquer um dos quatro papéis abre o plano **então** o doc do combinado lista: quem propôs, o ritmo, a janela, cada passo com data e ação (encontro/conversa), recessos no caminho e a regra do aceite/contestação — tudo derivado do `escopo` persistido.
  2. **Dado** plano em versão 2 **quando** o doc abre **então** ele corresponde à versão vigente — um doc por versão, não um snapshot solto.

### US2 — Roteiros semanais lazy (P1)

- **Por que P1:** gerar 16 roteiros de uma vez cria lixo desatualizado na primeira mudança de plano.
- **Teste independente:** plano aceito → agenda o 1º encontro → roteiro 1 existe; conclui → roteiro 2 existe.
- **Cenários:**
  1. **Dado** plano aceito e primeiro encontro do escopo agendado **quando** o gatilho roda **então** o roteiro da semana 1 nasce publicado (ou rascunho auto-publicado — decidir default) a partir do corpus + ajustes da dupla.
  2. **Dado** encontro N concluído **quando** o gatilho roda **então** o roteiro N+1 nasce; nunca mais de um passo à frente.
  3. **Dado** dupla sem plano **quando** a semana anda **então** o roteiro semanal não se aplica (o corpus estático segue a fonte).

### US3 — Geração sob demanda pela equipe (P1)

- **Por que P1:** o lazy cobre o fluxo feliz; a equipe precisa destravar uma semana específica.
- **Teste independente:** coordenação gera a semana 7, revisa, publica.
- **Cenários:**
  1. **Dado** coordenação/auxiliar numa dupla com plano **quando** escolhe a semana **então** o preview mostra o roteiro montado antes de salvar.
  2. **Dado** o preview válido **quando** salva como rascunho e depois publica **então** o status transita rascunho → publicado, com idempotência (regerar a mesma semana/plano não duplica).
  3. **Dado** o plano mudou de versão **quando** o roteiro derivado existe **então** ele marca "versão anterior do plano" e a regeneração cria nova versão preservando a anterior.

## Casos de borda

- Semana sem encontro do escopo (recesso, gap): o lazy não gera roteiro para semana vazia.
- Regenerar semana já publicada: cria versão nova; a publicada anterior vira `substituido` e segue legível (trilha), não some nem é reescrita.
- Plano `contestado`/`expirado`: roteiros vigentes marcam-se inválidos e a próxima proposta recria da versão nova.
- Fusão (spec 018): sessão cobrindo 2 passos — o roteiro segue a **semana/passo**; a fusão aparece como nota "esta sessão cobre os passos N e N+1" no roteiro da âncora (`sessao_id` no encontro).
- `escopo` sem `passos` (plano legado da 0219): roteiros lazy não geram — o doc lê o que existe.
- Jovem nunca publica/edita: só lê o publicado via recorte definer — nunca rascunho nem `substituido` de outra dupla.
- Roteiro gerado por "job" vs "coordenação": `gerado_via` registra a origem.
- Versão publicada mais antiga que a vigente: continua endereçável/legível para staff e para a trilha da dupla (`substituido`), só deixa de ser "a vigente".

## Requisitos funcionais

- **FR-001:** o doc do combinado é renderização determinística de `dupla_planos.escopo` + metadados (proponente, versão, janela, decisões de ritmo/recesso) — um doc por versão do plano, sem tabela nova, sem IA; introduzido junto com a spec 017.
- **FR-002:** roteiros semanais persistidos por plano/número/versão em `dupla_plano_roteiros` com `conteudo` estruturado (blocos), `status` (`rascunho`/`publicado`/`substituido`), `plano_versao`, `gerado_por/via`, `gerado_em`, `publicado_em` — DDL completo (RLS, grants, índices) no recon §5.3.
- **FR-003:** geração lazy: primeiro encontro agendado → roteiro 1; encontro N concluído → roteiro N+1; idempotente por (plano, número); nunca o lote inteiro e nunca N+2.
- **FR-004:** geração sob demanda: coordenação e auxiliar (`supervisiona_dupla`) escolhem a semana, veem preview, salvam rascunho, publicam; validação do conteúdo antes de persistir.
- **FR-005:** mudança de `plano.versao` invalida roteiros derivados (marca visual + caminho de regeneração); versão nova marca a anterior como `substituido`, nunca apaga nem reescreve — o índice único do vigente é parcial (`where status='publicado'`), a unique completa é `(plano_id, numero, versao)`.
- **FR-006:** leitura: dupla lê roteiros publicados do próprio plano; staff no escopo lê rascunho/publicado/substituido; jovem só o publicado, via recorte definer; o disclosure do card "Sua semana" (spec 019) prefere o roteiro semanal vigente ao corpus estático.
- **FR-007:** montagem do roteiro é determinística nesta fatia: corpus `roteiro-encontro-NN` + `encontro_guia_ajustes` da dupla + contexto do plano (ritmo, fusão, recesso) — a montagem é função pura testável. Avaliar primeiro a derivação pura na leitura (roteiro como projeção de corpus+ajustes+contexto, sem persistir); persistir só o que a trilha/versionamento exige — o que se decide fica registrado no recon/PR.

## Requisitos não funcionais

- **RLS/RPC:** `dupla_plano_roteiros` (nome a confirmar pelo lead) com `enable row level security`, `grant select` ao `authenticated`, policy de select por escopo-dupla (membro da dupla ou staff via `supervisiona_dupla`/`has_papel`) e recorte definer do jovem que devolve só `publicado`; **nenhum** insert/update/delete grant direto — escrita só por RPCs definer (`roteiro_gerar`, `roteiro_publicar`, `roteiro_regenerar`) com grants explícitos a `authenticated`, no molde das RPCs de plano. DDL sugerido completo no recon §5.3.
- **Gatilho lazy:** via tick `plano_ciclo`-adjacente (job service-role novo, ex. `roteiros_lazy`) — recomendado — ou dentro de `plano_aplicar_passo`/trigger de `encontros`; decidir na implementação (recon §5.3).
- **Conteúdo:** `DocBloco[]` (tipo existente em `src/lib/materiais-documentos.ts`) validado por Zod antes de persistir e de renderizar — schema a criar na spec 021 e reutilizado aqui.
- **LGPD:** roteiro por dupla contém nome da dupla/contexto do plano — entra no inventário como artefato derivado de dados já cobertos.
- **Idempotência:** unique `(plano_id, numero, versao)` + índice único parcial do vigente `on (plano_id, numero) where status='publicado'`; regerar = nova versão com a anterior `substituido`, nunca UPDATE destrutivo. Não usar `(dupla_id, numero, versao)`: a âncora é o plano.
- **Demo:** dupla com roteiros publicados e uma semana em rascunho.

## Entidades e dados

- Nova: `dupla_plano_roteiros` (DDL sugerida completa no recon §5.3 — colunas, RLS, grants, policies, índices): id, dupla_id, plano_id, numero, versao, plano_versao, conteudo jsonb, status (`rascunho`/`publicado`/`substituido`), gerado_por, gerado_via, gerado_em, publicado_em.
- Reuso: `dupla_planos.escopo` (doc do combinado), `encontro_guia_ajustes` (ajustes por dupla — absorvidos pelo roteiro vigente), `docs/rag/roteiro-encontro-*.md` (fonte), `dupla_plano_eventos` (audit do ciclo de vida, se couber).
- Jobs: novo passo no tick ou RPC `roteiros_lazy_tick` service-role (espelho do `plano_ciclo`).

## Critérios de sucesso

- **SC-001:** unit da montagem determinística do roteiro (corpus + ajustes + contexto → blocos válidos) e do doc do combinado (um por versão).
- **SC-002:** e2e: aceita plano → agenda 1º → roteiro 1 publicado; conclui → roteiro 2 — e nunca N+2 no mesmo tick; coordenação gera semana 5 sob demanda (preview→rascunho→publicar→regerar idempotente).
- **SC-003:** jovem lê só o publicado: rascunho e `substituido` invisíveis no recorte definer; `substituido` legível pra staff/trilha.
- **SC-004:** prints do doc do combinado e do roteiro semanal (1440/390).
- **SC-005:** caso negado de escrita (mentor/jovem não publicam) no e2e + policy negada.

## Plano de testes

- **Unit:** montagem do roteiro, validação de blocos, transição de status (`rascunho`→`publicado`, `publicado`→`substituido`), invalidação por versão de plano, régua lazy (nunca N+2), um doc do combinado por versão.
- **E2E app:** fluxos lazy e sob demanda por papel; leitura do jovem só do publicado; `substituido` legível pra staff; regerar preserva a anterior.
- **E2E demo:** roteiros publicados + rascunho.
- **Regressão:** o roteiro estático do corpus segue acessível onde já era (biblioteca/agenda) — não é substituído globalmente.

## Riscos

- Mais um artefato disputando com corpus + ajustes + doc do combinado: a hierarquia é fixa — "O combinado" (por versão), "Roteiro do encontro N" (operacional, absorve os ajustes), "Biblioteca" (corpus); copy e navegação deixam isso claro, sem quarto documento.
- Lazy por job tem latência do tick: o primeiro roteiro pode atrasar — mitigação: gerar também na leitura (on-demand silencioso no primeiro acesso à semana) se o tick for diário demais. Decidir.
- Conteúdo estruturado no banco exige validação rigorosa: bloco inválido nunca renderiza (fallback = roteiro do corpus).
- Derivação pura vs persistência: se o roteiro puder ser projetado sem gravar, a tabela só segura o que a trilha exige — avaliar antes de pagar o custo de versionamento.

## Premissas

- "Semana" do roteiro = o passo do plano (encontro N), não semana civil — a dupla pensa em "roteiro do encontro 7".
- O doc do combinado não é assinado/baixado — é leitura na tela do aceite, um por versão, e sai junto com a spec 017.
- Default do lazy: roteiro nasce **publicado** (conteúdo determinístico do corpus oficial, sem risco editorial); rascunho é para geração sob demanda e depois para a Liza (spec 021). Validar com Thiago.
