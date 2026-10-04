# Atividades interativas — instrumentos do guia como experiência nativa

**Status:** brainstorm de produto — nada aqui está implementado.
**Pergunta central:** o guia DPP diz literalmente *"O PDM e a Roda da Vida não ficam na plataforma: são documentos [externos]"* (cap. 05). Queremos inverter isso: os instrumentos viram atividade nativa — o mentor dispara um link tokenizado pro mentorado (que não loga) **ou** preenche junto com ele no encontro.

---

## 0. O que já existe (e este plano reutiliza)

Verificado no código — cada item é um gancho real, não uma ideia:

| Peça | Onde | O que prova |
|---|---|---|
| Forms engine completo | migrações `0036`+`0042`, `src/lib/forms/{schema,queries,actions}.ts` | `formularios.campos` jsonb (8 tipos), `formulario_links` (token 192-bit, `dest_profile_id`/`dest_mentorado_id`/`dupla_id`, `contexto` jsonb, `usado_em`, `expira_em`), `formulario_respostas` (1/link). Coord constrói em `/formularios`. |
| Superfície pública por token | `src/app/f/[token]/page.tsx` + `formulario-publico.tsx` | Mentorado responde **sem login**, mobile-first, rascunho em `localStorage`, progresso sticky, honeypot, estados pendente/respondido/expirado/inativo. Anon **não tem grant de tabela** — tudo via RPCs `formulario_por_token` / `submeter_resposta_formulario` (security definer). |
| Wiring de domínio no submit | `0036` RPC + `0042` | Resposta de `sistema='avaliacao_360'` com `link.dupla_id` **carimba `encerramentos.checklist`** automaticamente; toda resposta pública gera notificação `formulario_respondido` pra coordenação. *É o precedente exato do "resultado volta pra ficha + coord audita".* |
| `sistema` = instrumento oficial | `0042` | Vocabulario fechado (`anamnese`, `avaliacao_360`, `autoavaliacao_mentor`), unique parcial, guard de trigger (definição imutável, nasce só por migração). Selo "Instrumento oficial" já renderiza no público. |
| Calendário sabe o instrumento de cada encontro | `ciclo_eventos.instrumentos` (seed.sql) | `'{PDM,Roda da Vida (leitura inicial)}'` no encontro 1, `'{Roda da Vida,Modelo SMART}'` nos 12–14, `'{Avaliação 360º,Autoavaliação do mentor}'` no 16. **A espinha "qual atividade em qual encontro" já existe como dado.** |
| Material por encontro na ficha | `materiais.encontro_num` + `materiaisPorNumero` em `duplas/[id]/page.tsx:238-250` | Chips de material já aparecem dentro do `EncontroRow` — o mesmo slot receberia o chip da atividade. |
| Envio de link da ficha | `EnviarFormularioDialog` + `gerarLinksParaDupla` (`src/lib/actions-formularios.ts`) | Dialog com mentor+mentorado como destinos, links prontos pra copiar/WhatsApp (`msgLinkWhatsApp`, `urlPublica` — que já aceita `caminho` pra outras rotas públicas). **Hoje coord-only** (`"Só a coordenação envia formulários."`, linha 66-67) — a premissa "o mentor gera o link" exige abrir isso, ver §3. |
| PDM externo | `duplas.pdm_url` (`0044`) + `PdmUrlDialog` | Campo-url com RPC escopada `definir_pdm_url` (mentor da dupla ou coord). É o lugar onde o PDM nativo se ancora — e a rota de fuga ("PDM continua no Docs") durante a transição. |
| Nota por nº de encontro | `encontro_notas` (`0015`), `NotaEncontro` | Chave `(dupla_id, numero)` — não FK em `encontros`, sobrevive a remarcação. **É o padrão de chave certo pra atividades** (a Roda pertence ao nº do ciclo, não à row agendada). |
| Segundo link público | `/assinar/[token]` | Precedente de superfície pública escopada por token com RPC própria — `/a/[token]` seguiria o mesmo molde. |
| Combinados | `encaminhamentos` (dupla_id, responsavel, prazo, status) | Sobreposição de domínio com submetas — ver pergunta aberta §7. |
| Sem gráfico, sem dep | `package.json` | Não há lib de chart (nem recharts/d3). Radar de 16 eixos = SVG na mão (precedente de visualização: `TrajetoriaAvaliacoes`, dots por encontro; svg inline em `chamada-formacao.tsx`). |
| pdf-lib instalado | `package.json` deps | Usado nos PDFs de evidência de assinatura. `definindo_metas_preenchivel.pdf` **tem AcroForm** (`Form: AcroForm` no pdfinfo) com campos `criar`, `aprender`, `melhorar`, `eliminar`, `visao_futuro`, `meta_1..5`, `meta_N_importancia`, `meta_prioritaria`, `check_1..3_{sim,rever}` — a página é imagem (pdftotext extrai 2 bytes), mas **os campos são preenchíveis via pdf-lib**. Isso muda a conta da alternativa D. |
| Storage escasso | `_contexto.md` | Free tier 1 GB → **dado nativo é mais barato que scan de PDF**: cada instrumento que vira JSON economiza arquivo. Argumento a favor, não contra. |

**Gap de permissão (atravessa todas as alternativas):** hoje só a coordenação gera links (`gerarLinksFormulario`/`gerarLinksParaDupla`/`enviarAnamneseMentorado` → `meCoord()`; `EnviarFormularioDialog` só renderiza com `souCoord`, `page.tsx:348`). O pedido é "o mentor gera o link pro seu mentorado". Caminho: RPC/action escopada estilo `definir_pdm_url` — mentor autenticado emite link só com `dest_mentorado_id` da própria dupla ativa e só de instrumentos marcados como "emissíveis pelo mentor". Decisão de produto em §7.

---

## 1. Catálogo: o que o guia tem e o que cada um vira

Fonte: `Guia do Mentor DPP` (cap. 07 instrumentos, cap. 10 os 16 encontros, cap. 14 templates) + `definindo_metas_preenchivel.pdf` + ata da reunião.

| # | Instrumento (guia) | Quando | Forma atual | Vira na plataforma |
|---|---|---|---|---|
| 1 | **Roda da Vida** — 4 quadrantes × 4 áreas = **16 eixos fixos**, nota 1–10 | Leitura inicial (enc. 1, preenchida em casa) + aplicação formal (enc. 12–14, "Roda da Vida hoje") | Papel/PDF | **Radar interativo**: 16 sliders (ou tap-por-anel) → polígono SVG ao vivo; duas instâncias por dupla (`momento: 'inicial'|'mes5'`) com overlay antes/depois. Áreas fixas: *Pessoal* (saúde/disposição, intelecto/cultura, equilíbrio emocional, independência) · *Profissional* (carreira, finanças, escola/universidade, contribuição social) · *Relacionamentos* (família, amigos, amoroso, vida social) · *Qualidade de vida* (hobbies, atividade física, realização/felicidade, espiritualidade). |
| 2 | **PDM** — Declaração de Visão + até 3 metas (verbo de ação + indicador de sucesso + prazo) + **árvore recursiva de submetas** ("o que preciso fazer pra conseguir isso?" → níveis A, B, C…) | Construído enc. 1–4, **vivo** até o 16 (revisão meio de percurso enc. 9, ajustes contínuos) | Google Docs/Drive (`duplas.pdm_url`) | **Documento vivo nativo** — não um formulário. Editor na ficha da dupla (mentor), coleta assíncrona por links de "rodada de tarefa", árvore com progresso (submeta → status). *É o item que não cabe no forms engine como está.* |
| 3 | **Construindo a sua Visão** — 6 prompts reflexivos → Declaração de Visão (verbo no futuro + prazo) | Tarefa pós-1º encontro | Template em papel | **Form tokenizado puro** — cabe 100% nos tipos atuais (6× `texto_longo`). Zero engine nova; só form `sistema` + permissão de emissão. A Declaração colhida aqui pode alimentar o PDM (ver alternativa C). |
| 4 | **"Definindo minhas metas"** worksheet — criar/aprender/melhorar/eliminar, visão, 5 metas + importância, meta prioritária, checagem SMART sim/rever | Enc. 2–3 | PDF-imagem **com AcroForm** (campos listados em §0) | Duas opções: (a) form nativo equivalente (campos conhecidos → schema trivial); (b) coleta nativa + **pdf-lib preenche o AcroForm oficial como artefato** de saída. |
| 5 | **Avaliação por terceiros** — jovem indica ≥3 amigos + ≥3 familiares (+colegas); mentor envia 2 perguntas (pontos fortes / a melhorar) e **consolida anonimizando** | Pré-1º → devolutiva no 2º | E-mail manual + tabela de consolidação em papel | **Multi-link genérico**: mentor cola N contatos (ou o mentorado indica via um mini-form), cada respondente recebe link genérico `dest=null` com `dupla_id`+`contexto.papel` (amigo/família/colega). Agregação `agregaRespostas` já existe — a consolidação automática **é** o anonimizador (coord/mentor veem o agregado, não quem disse o quê — a tabela "Pontos fortes × melhoria" do guia sai pronta). |
| 6 | **Avaliação por encontro — lado do mentorado** | Todo encontro, logo após | Inexistente (mentorado não tem canal) | **Micro-form tokenizado ancorado em `(dupla, numero)`** — `formulario_links.contexto.encontro_num` já existe pra isso. Decidido na ata: "cada um na sua visão, agrega na 360". Emissão automática pós-`realizado` ou botão no EncontroRow. |
| 7 | **Checklist de competências do mentor** — 10 competências × {já faço bem / preciso desenvolver} + prioridade | Pré-ciclo e no enc. 16 | Papel | Form `sistema` simples (10× `sim_nao`/`select` + checkbox de prioridade) — versão mentor, não mentorado. |
| 8 | **Autoavaliação do mentor** (5 perguntas) | Enc. 16 | **Já existe** (`sistema='autoavaliacao_mentor'` + RPC `salvar_autoavaliacao`, `0037`) | Manter; a versão-form e a RPC coexistem (o form é a superfície pública). |
| 9 | **Avaliação 360º** | Enc. 16 | **Já existe** (`sistema='avaliacao_360'` + wiring no checklist) | Manter; recebe a agregação das micro-avaliações (item 6). |
| 10 | **Mensagens-modelo** (preparação, às pessoas indicadas, encaminhamento) | Vários | Templates em `materiais` | **Continuam texto** — mas ganham botão "copiar com nomes preenchidos" (dados da dupla) e, quando a mensagem pede um instrumento ("sua Roda da Vida"), **o link da atividade vai embutido**. O template vira launcher, não vira form. |
| 11 | **Perguntas Eficazes / Feedback Construtivo / Escuta Ativa / CNV** | Conteúdo de apoio | `materiais` tipo `conteudo` | **Não viram atividade** — são referência. Podem renderizar como card de ajuda dentro da tela da atividade ("como conduzir"). |
| 12 | **Plano de continuidade** (síntese final do mapa de metas, enc. 14) | Enc. 14 | Papel | É o PDM relido — não é instrumento separado; sai como export/print do documento vivo. |

**Leitura do catálogo:** os instrumentos se dividem em **três naturezas** — e essa é a pergunta que as arquiteturas respondem de jeitos diferentes:

- **Coleta one-shot** (submete uma vez, acabou): Construindo a Visão, avaliação por terceiros, checklist, micro-avaliação por encontro, *cada aplicação* da Roda. → **o forms engine resolve hoje, quase de graça.**
- **Documento vivo** (editado em rodadas, consultado todo encontro): o PDM. → **não é formulário**; precisa de entidade própria.
- **Referência/launcher**: mensagens-modelo, técnicas de comunicação. → não são atividade.

---

## 2. O loop que toda alternativa precisa fechar

```
mentor (logado, ficha da dupla)
   → dispara atividade [link tokenizado | "preencher junto agora"]
        → mentorado abre /f|/a/[token] no celular via WhatsApp (sem login)
             → resposta/atualização grava ancorada em dupla_id (+ encontro_num)
                  → ficha da dupla mostra estado+resultado (seção/bloco próprio)
                       → coordenação audita (lista, agregados, notificação, export)
```

Os quatro elos já existem isoladamente: emissão de link (`EnviarFormularioDialog`), superfície pública sem login (`/f/[token]`, `/assinar/[token]`), âncora em dupla (`formulario_links.dupla_id`), auditoria (`/formularios/[id]` respostas + `formulario_respondido`). O que falta em todas as alternativas: **mentor como emissor** (hoje coord-only) e **o documento vivo** (PDM).

---

## 3. Alternativas de arquitetura

### Alternativa A — Estender o forms engine com tipos de campo "instrumento"

**Desenho:** `FormularioCampoTipo` (`schema.ts:7-15`) ganha tipos compostos:
- `"roda_vida"` — valor `{area_id: nota 1-10}` das 16 áreas fixas (constante `AREAS_RODA` em `schema.ts`);
- `"metas_smart"` — valor `[{titulo, indicador, prazo}]`, cap N;
- `"lista_contatos"` — `[{nome, whatsapp|email, papel}]` pra avaliação por terceiros;
- `"visao"` — na prática `texto_longo` já cobre (não precisa de tipo).

Cada tipo novo = um renderer em `CampoRenderer` (`formulario-publico.tsx:486+`), um ramo em `formularios_limpa_respostas` (RPC, `0036:167-254`), um ramo em `agregaRespostas` (`schema.ts:251+`) e fixture demo. O form `sistema='roda_da_vida'` vira "1 pergunta = o instrumento inteiro". PDM entra como campo `"metas_smart"` serializado na resposta jsonb.

**Rotas novas:** nenhuma (usa `/f/[token]`). **Tabelas novas:** nenhuma. **Componentes novos:** `campo-roda-vida.tsx` (16 sliders + mini-radar), `campo-metas.tsx` (lista editável de cards meta).

- **Esforço:** M por tipo (roda ≈ M sozinha; metas_smart M-L; contatos S).
- **Prós:** reusa 100% do pipeline — token, rascunho localStorage, submit RPC, `agregaRespostas`, respostas-section, `formulario_respondido`, demo; mentorado já conhece a UX; nada de infra nova de segurança (anon continua RPC-only).
- **Contras:** **a resposta é um snapshot jsonb opaco** — "quais submetas da dupla estão abertas?" exige varrer respostas; o PDM é *vivo* e o link é one-shot (`usado_em` + unique `link_id`): depois de enviado, o jovem não corrige uma meta — precisa outro link, e a versão nova não conversa com a velha. O instrumento mais importante (PDM) fica mal resolvido: vira "preencher de novo" a cada rodada, sem árvore, sem progresso.
- **O que mentor vê:** chip no EncontroRow → dialog de envio (se a permissão abrir) → resposta renderizada na respostas-section e, com trabalho extra, um radar lendo `respostas[campo_id]`.
- **O que mentorado vê:** o form bonito que já existe, com uma "pergunta" especial — a roda de 16 sliders.
- **Veredito:** resolve os one-shots e deixa o cerne de fora. Boa como *camada*, insuficiente como resposta inteira.

### Alternativa B — Entidade nova `atividades`, motor paralelo

**Desenho:**
```sql
atividade_templates (id, tipo text check in ('roda_vida','construindo_visao',
  'metas','avaliacao_terceiros','avaliacao_encontro','checklist_mentor'),
  titulo, descricao, schema jsonb, encontro_num smallint,  -- sugerido pelo guia
  sistema bool, versao int, ativo bool)

atividade_links (id, template_id, token unique, dupla_id, encontro_num,
  dest_mentorado_id, contexto jsonb, status 'pendente'|'respondido'|'expirado',
  usado_em, expira_em, created_by)

atividade_respostas (id, link_id unique, payload jsonb, respondido_em)
-- + RPCs: atividade_por_token(p_token), submeter_atividade(p_token, p_payload)
--   (mesmo desenho definer do forms engine)
```
Rotas: `/a/[token]` (página pública irmã de `/f/[token]`) com renderers dedicados por tipo — `RodaDaVida` (radar), `ArvoreMetas`, `ColetaContatos`. Na ficha: seção "Instrumentos da dupla" listando instâncias por encontro_num.

- **Esforço:** L–XL (3 tabelas + 2 RPCs + página pública + renderers + seção da ficha + demo + notificações).
- **Prós:** renderers dedicados = UX do tamanho do instrumento (radar de verdade, não "pergunta 3"); schema por tipo permite **payload relacional** (`atividade_respostas.payload -> 'notas'` indexável, ou tabelas-filha por tipo); modela corretamente tanto one-shot quanto multi-rodada.
- **Contras:** duplica o que o forms engine já faz bem (token, validade, estados, anon-via-RPC, honeypot, rascunho, emails/notificações, demo) — dois motores pra manter, dois lugares onde um bug de segurança pode morar; a coordenação ganha um segundo builder pra entender.
- **O que mentor vê:** na ficha, por encontro, os instrumentos daquele passo do guia com estado (pendente/respondido) e o resultado renderizado (radar, árvore).
- **O que mentorado vê:** experiência dedicada por instrumento — a Roda é uma roda, não um form.
- **Veredito:** tecnicamente o mais honesto pro PDM, mas paga o preço de um motor inteiro novo quando 80% já existe. Faz sentido só se a visão final (portal do mentorado, §E) for o destino assumido.

### Alternativa C — Híbrida: forms = camada de coleta, projeções = documento vivo ⭐

**Desenho:** separa *coletar* de *manter*. O forms engine continua sendo a única porta de entrada pública; cada resposta de instrumento oficial **projeta** pra tabelas de domínio — o mesmo padrão que `0042` já usa pro 360→checklist:

```sql
-- documento vivo por dupla (substitui pdm_url quando existir)
pdm (dupla_id unique, visao text, visao_em timestamptz, updated_at)
pdm_itens (id, pdm_id, parent_id null→recursivo, tipo 'meta'|'submeta',
           titulo, indicador, prazo date, status 'aberta'|'feita'|'dropada',
           area_roda text null,          -- meta da Roda quando veio dela
           origem 'dupla'|'link',        -- quem criou
           ordem smallint, created_at, updated_at)

-- aplicações da roda (snapshot por momento)
roda_vida (id, dupla_id, momento 'inicial'|'mes5', notas jsonb -- {area: 1-10}
           , meta_prioridade jsonb null, respondido_em, link_id)
```

Wiring dentro de `submeter_resposta_formulario` (RPC já definer — `0042` faz exatamente isso pro 360): resposta de `sistema='construindo_visao'` → upsert `pdm.visao`; `sistema='metas'` → append em `pdm_itens` com `origem='link'` marcado "proposta do jovem" (o mentor aceita/ajusta junto no encontro); `sistema='roda_vida'` → insert `roda_vida` com `contexto.momento`.

O **mentor edita o PDM direto na ficha** (logado, RLS `mentor da dupla`, padrão `encontro_notas`): árvore `pdm_itens` com expand/collapse, check de SMART inline, arrastar submeta, marcar feita. O **mentorado contribui por rodadas de tarefa** — que é *exatamente* como o guia manda: pós-2º "defina suas metas" (link A), pós-3º "desdobre em submetas" (link B). Cada rodada = um link novo e one-shot — a limitação do forms engine deixa de ser bug e vira o fluxo do guia.

**Rotas novas:** nenhuma pública (tudo `/f/[token]`); `/duplas/[id]` ganha seção "Plano de desenvolvimento". **Forms novos de sistema** (só seed + enum): `construindo_visao`, `metas`, `submetas`, `roda_vida`, `avaliacao_terceiros`, `avaliacao_encontro`, `checklist_mentor`.

- **Esforço:** M total incremental — Fase 1 (Visão+contatos+avaliação de encontro) ≈ S-M porque não inventa nada; Roda = tipo de campo novo ou `schema` dedicado + radar SVG (M); PDM vivo = L (árvore + editor + wiring).
- **Prós:** reusa tudo que já é auditado e testado; modelo mental da Kelyng ("o sistema pega o modelo e coloca na telinha") sai do papel — `ciclo_eventos.instrumentos` + `encontro_num` sugerem a atividade certa no encontro certo; o PDM vira **dado** (semáforo pode perguntar "tem metas?", o resumo da jornada pode contar submetas feitas, o encerramento pode checar PDM preenchido); compatível com demo honesto e com export.
- **Contras:** é a mais trabalhosa das três primeiras; exige o mapa `sistema`→projeção um a um (enum cresce, cada um com wiring próprio); dois "lugares de verdade" se o PDM externo (`pdm_url`) coexistir — precisa de decisão de convivência.
- **O que mentor vê:** EncontroRow do encontro 2 já mostra "Declaracao de Visão · respondida"; bloco "Plano de desenvolvimento" na ficha com a árvore editável; propostas do jovem chegam como fila de aceite ("3 metas novas propostas — revisar junto").
- **O que mentorado vê:** por rodada, um link WhatsApp que abre exatamente a tarefa do guia ("Minhas metas", "Minha Roda da Vida"); nunca uma ficha inteira, nunca login.
- **Veredito:** casa coleta-que-já-existe com documento-que-falta, segue o ritmo do guia (rodadas de tarefa) e transforma o PDM de arquivo em dado auditável. **É a recomendação.**

### Alternativa D — PDF como fronteira: AcroForm fill (pdf-lib) + overlay

**Desenho:** dois sabores.
- **D1 — PDF preenchido como artefato de saída:** coleta nativa (qualquer alternativa) → pdf-lib grava nos campos AcroForm do `definindo_metas_preenchivel.pdf` (campos confirmados: `criar`, `aprender`, `melhorar`, `eliminar`, `visao_futuro`, `meta_1..5`, `meta_prioritaria`, `check_N_{sim,rever}`) → PDF oficial preenchido vira anexo da dupla/evidência. Complementa qualquer opção, não compete.
- **D2 — Overlay/editor sobre PDF-imagem:** renderizar a imagem da página + inputs posicionados por cima (mapear campos AcroForm → coords) como UI de preenchimento. Mantém fidelidade visual ao documento oficial.
- **D3 — Fluxo papel-digital:** mentorado baixa/imprime/escreve/tira foto → upload. O anti-objetivo (mobile, WhatsApp, storage 1 GB comendo foto de 3-8 MB por folha).

- **Esforço:** D1 S-M (pdf-lib já está no projeto, campos conhecidos); D2 L-XL (posicionamento por PDF, responsividade impossível — a folha A4 no celular é o problema, não a solução); D3 S mas contraproducente.
- **Prós:** D1 gera o "documento oficial" pro rito/auditoria sem pedir pro jovem mexer em PDF; D2 mantém o papel como fonte da verdade literal.
- **Contras:** PDF-imagem em celular é UX ruim por definição; overlay é manutenção frágil (mudou o PDF, quebrou o overlay); D3 come storage e não gera dado. D2/D3 não resolvem o PDM vivo.
- **Veredito:** **D1 vale como feature de export dentro de C** ("baixar o PDM oficial preenchido"). D2/D3 ficam de fora.

### Alternativa E — Portal do mentorado por token ("seu espaço")

**Desenho:** um link persistente por dupla (`portal_links`: token de vida longa, rotacionável, escopo `(dupla_id, mentorado_id)`) abre `/j/[token]` — mini-home do jovem: "sua Roda", "seu plano" (árvore read/edit), "próximos combinados", "tarefa da semana" (a rodada de coleta ativa render inline, não como form separado), avaliação rápida pós-encontro. O token vira **sessão**, não fator de posse de um envio.

- **Esforço:** XL — modelo novo de autenticação-por-token (TTL, rotação, revogação, "já li/continuar"), superfície stateful inteira, e todas as atividades dentro.
- **Prós:** a melhor UX possível pro jovem WhatsApp-cêntrico — um link fixo que ele guarda; reengajamento natural; cada instrumento vira uma aba do espaço dele; elimina "link novo a cada tarefa" (um ponto de entrada só, sempre o mesmo).
- **Contras:** muda a fronteira de segurança (token persistente ≈ sessão — o forms engine deliberadamente faz token one-shot); escopo grande demais pra primeiro passo; overlap com "por que não dar login pro mentorado?" — pergunta de produto que talvez deva ser respondida antes.
- **Veredito:** é a **visão**, não o MVP. C entrega os instrumentos agora; E vira o agrupador quando (e se) fizer sentido dar ao jovem um lugar contínuo.

---

## 4. Como cada alternativa fecha o loop

| Elo | A (tipos no form) | B (motor novo) | C (híbrida) ⭐ | D (PDF) | E (portal) |
|---|---|---|---|---|---|
| **Mentor gera link** | `EnviarFormularioDialog` p/ mentor (abrir permissão) | dialog novo + RPC própria | mesmo dialog, forms `sistema` novos | n/a (D1 é saída) | link único emitido na criação da dupla |
| **Mentorado no celular** | `/f/[token]` com campo especial | `/a/[token]` dedicado | `/f/[token]` por rodada | PDF no WhatsApp (ruim) | `/j/[token]` persistente |
| **Volta pra ficha** | resposta jsonb em respostas-section; radar exige parse | `atividade_respostas` + seção própria | projeções: `pdm*`, `roda_vida` renderizam nativo | anexo/evidência | tudo dentro do portal + espelho na ficha |
| **Coord audita** | agregaRespostas + `formulario_respondido` | tela própria a construir | idem forms + **dados consultáveis** (metas, radar médio da turma) | PDF pra baixar | idem + métricas de engajamento |
| **Documento vivo (PDM)** | ❌ snapshot | ✅ nativo | ✅ `pdm_itens` | ❌ | ✅ dentro do portal |
| **Roda interativa** | ✅ campo composto | ✅ renderer dedicado | ✅ campo composto → projeção | ❌ | ✅ aba do portal |

---

## 5. Recomendação

**Alternativa C** — forms engine como camada única de coleta pública + projeções de domínio como documento vivo — com **D1** (PDF oficial preenchido via pdf-lib) como export, e **E** como visão de longo prazo.

**Por quê:**
1. A maior parte dos instrumentos é one-shot e **já tem casa** — reimplementar token/anonymous-submit/rascunho/notificação (B) é pagar duas vezes pelo mesmo risco.
2. O PDM é o único instrumento realmente *vivo* — e é o que o guia chama de "documento central". Merece tabela própria; o resto usa o motor que existe.
3. O wiring `sistema → projeção` já tem precedente no próprio banco (`0042`: 360 carimba checklist, todo submit notifica coord) — não é arquitetura nova, é o padrão da casa aplicado a mais instrumentos.
4. "Rodada de tarefa = link novo" replica fielmente o roteiro do guia (tarefa pós-1º, pós-2º, pós-3º, "Roda da Vida hoje") — a limitação do one-shot vira o desenho certo.
5. Cada fase entrega valor sozinha — nenhuma é um passo em falso se a próxima não vier.

### Sequência MVP → visão

**Fase 0 — permissão de emissão (S, desbloqueia tudo):** RPC/action escopada `gerar_link_instrumento` — mentor emite link só pra `dest_mentorado_id` da própria dupla ativa, só de `formularios.sistema` marcados emissíveis (flag nova `emissao_mentor bool` ou allowlist no enum). `EnviarFormularioDialog` renderiza pra `souMentor` filtrando esses forms. Sem isso, "mentor gera link" não existe em nenhuma alternativa.

**Fase 1 — instrumentos que cabem no engine de hoje (S–M):**
- `construindo_visao` (6 texto_longo) + `avaliacao_encontro` (micro-avaliação do jovem, `contexto.encontro_num`) + `avaliacao_terceiros` (links genéricos com `dupla_id` — precisa liberar `dupla_id` em link sem destinatário e um modo "N contatos") — os três viram `sistema` novos no enum + seed.
- Superfície de pendências na ficha (já está no Sprint 2 do backlog da reunião): chips por `formulario_links.dupla_id` no EncontroRow correspondente.
- Agregação da avaliação por encontro alimentando a 360 (decidido na ata).
- Resultado: o mentor passa a operar o ciclo inteiro de coleta sem sair da ficha; mentorado nunca loga.

**Fase 2 — Roda da Vida (M):**
- Tipo de campo `roda_vida` (16 áreas fixas do guia — constante `AREAS_RODA`/`QUADRANTES_RODA` em `schema.ts`) ou form dedicado com `campos` sintético; renderer com sliders/tap + radar SVG na hora (sem dep de chart — `TrajetoriaAvaliacoes` é o precedente de visualização sob medida).
- Projeção `roda_vida(dupla_id, momento)` — dois snapshots por dupla; a ficha renderiza radar **antes/depois sobreposto** (leitura inicial enc. 1 × "hoje" enc. 12).
- Ficha da dupla: bloco "Roda da Vida" com o radar, delta por área, e CTA "enviar pro mentorado" no passo certo da trilha (`ciclo_eventos.instrumentos` já sabe quando).

**Fase 3 — PDM vivo (L):**
- `pdm` + `pdm_itens` recursivo; editor inline na ficha (mentor) — árvore com níveis A/B/C do guia, check SMART inline (verbo inicial, IS preenchido, prazo — os três campos do modelo), status por item.
- Coleta assíncrona por rodadas: `sistema='metas'` e `sistema='submetas'` viram propostas (`origem='link'`) com aceite pelo mentor — "revisar junto" é literalmente o que os encontros 2–4 mandam fazer.
- Metas da Roda (enc. 13: ≥1 por área) entram como `pdm_itens.area_roda` — Roda e PDM conversam como no guia.
- `duplas.pdm_url` coexiste como "PDM externo" com migração suave (depois de um ciclo com os dois, decidir se o campo morre).
- Export: "PDM da dupla" em PDF (o template oficial preenchido — D1) pra encerramento/resumo da jornada.

**Fase 4 — avaliar o portal (E):** se rodadas de link começarem a irritar ("toda semana um link novo"), consolidar em `/j/[token]` persistente — decisão informada por uso real, não por aposta.

---

## 6. Riscos e cuidados transversais

- **Sensibilidade:** Roda e PDM carregam autoavaliação de vida de jovem — visibilidade segue o padrão da dupla (mentor + coord + supervisor leem; o mentorado é o autor). Decidir se coord vê *conteúdo* ou só *estado* (ver §7).
- **Demo honesto:** cada instrumento novo precisa de fixture em `src/lib/demo/forms-data.ts`/`queries.ts` — o dataset demo já modela os três `sistema` atuais; adicionar `roda_vida`/`metas` com respostas plausíveis.
- **Storage:** dados nativos não tocam o bucket — ponto a favor vs. PDFs escaneados.
- **Imutabilidade de instrumento oficial:** `guard_formulario_sistema` (`0042`) já garante que `sistema` só nasce por migração — os forms novos entram por migration com seed, mesma linha.
- **`numero` vs `encontro_id`:** ancorar atividades por `(dupla_id, numero)` (padrão `encontro_notas`) — sobrevive a remarcação e existe antes do agendamento.

---

## 7. Perguntas abertas (Thiago / validação com Léo e uma mentora)

1. **Quem emite o link?** O pedido é "mentor gera". Hoje emissão é coord-only por desenho (`"Só a coordenação envia formulários."`). Abrir pra mentor-da-dupla muda uma fronteira de permissão — confirmar que é desejado (o mentor conhece o mentorado, é o canal natural) e se coord mantém a emissão em massa.
2. **Link one-shot por rodada × documento editável pelo jovem:** o mentorado pode *corrigir* a Roda depois de enviada, ou cada aplicação é snapshot e a correção acontece junta no encontro? (O guia sugere snapshot + conversa — mas é decisão de produto.)
3. **Submeta × "Combinado" (`encaminhamentos`):** "por qual submeta você vai começar" e "o que ficou combinado até a próxima" são o mesmo objeto no mundo real. `pdm_itens` gera `encaminhamentos`, convivem, ou combinados viram vista de submetas com prazo curto?
4. **Roda fixa ou configurável?** As 16 áreas são do instrumento oficial (fixas, como `sistema`) ou a coordenação pode trocar áreas por turma? (Recomendo fixa — comparabilidade entre duplas/ciclos.)
5. **Avaliação por terceiros:** respondentes são gente fora do sistema (amigos da jovem). Link genérico com `dupla_id` basta, ou vale cadastrar contato (nome+papel) pra o mentor saber quem faltou sem violar o anonimato da *resposta*? (Guia: "cópia oculta entre elas" — o anonimato é entre respondentes e entre resposta↔pessoa.)
6. **Coordenação lê o conteúdo?** Metas e Roda podem ser íntimos ("relacionamento amoroso: 2"). Coord vê tudo (padrão atual das tabelas da dupla) ou vê metadados ("PDM preenchido, 3 metas, radar médio")? Afeta só queries/agregados, não o schema.
7. **O que acontece com `duplas.pdm_url`?** PDM nativo substitui, convive como "link externo opcional", ou vira legado de migração? (BACKLOG mantém o item em aberto exatamente pra isso.)
8. **"Definindo minhas metas"**: preservar o PDF oficial como artefato de export (D1) ou o instrumento vive só nativo? (pdf-lib + campos AcroForm conhecidos tornam o export barato — mas é uma escolha.)
9. **Avaliação por encontro do mentorado — dispara quando?** Automático quando `encontro.status → realizado` (e-mail/WhatsApp pela coord? o mentor manda?), botão no EncontroRow, ou junto do link de registro? E ela é anônima pro mentor (agregada) ou nominal?
10. **Menores:** mentorado <18 já tem autorização do responsável pelo termo — cobre instrumentos de autorrelato (Roda/metas) ou precisa de menção específica? (Pergunta jurídica, não técnica.)
11. **Reengajamento:** se o jovem não respondeu a Roda em casa, o encontro 12 preenche junto — o mesmo token serve de "preencher junto agora" (mentor abre o link no próprio celular do encontro) ou existe modo "preencher junto" separado que pula a posse do token? (Tecnicamente trivial — o mentor logado poderia responder como scribe; mas isso cria ambiguidade de autoria. Talvez `contexto.preenchido_junto: true`.)

---

## Apêndice — onde cada coisa mora (mapa de arquivos verificados)

| O quê | Caminho |
|---|---|
| Engine — tipos, labels, agregação | `src/lib/forms/schema.ts` |
| Engine — queries + demo fallbacks | `src/lib/forms/queries.ts` |
| Engine — actions (salvar, links, submit público) | `src/lib/forms/actions.ts` |
| Emissão pela ficha (hoje coord-only) | `src/lib/actions-formularios.ts` (`gerarLinksParaDupla`:26, `enviarAnamneseMentorado`:162) |
| Página pública | `src/app/f/[token]/page.tsx` + `formulario-publico.tsx` (`CampoRenderer`:486) |
| Tabelas + RPCs públicas + guard de sistema | `supabase/migrations/0036_formularios.sql`, `0042_formularios_sistema.sql` |
| PDM externo atual | `supabase/migrations/0044_pdm_url.sql` (`definir_pdm_url`), `src/components/pdm-url-dialog.tsx` |
| Instrumento↔encontro | `supabase/seed.sql` `ciclo_eventos.instrumentos`; render `duplas/[id]/page.tsx:238-250` (`materiaisPorNumero`) |
| Chave por nº (precedente) | `supabase/migrations/0015_encontro_notas.sql` |
| WhatsApp/link helpers | `src/components/forms/link-shared.ts` (`urlPublica` c/ `caminho`, `msgLinkWhatsApp`), `src/lib/ciclo.ts` (`waLink`:1172) |
| Visualização sob medida (precedente) | `src/components/trajetoria-avaliacoes.tsx` |
| Demo forms | `src/lib/demo/forms-data.ts`, `demoFormularioPorToken` em `src/lib/demo/queries.ts` |
| pdf-lib (AcroForm fill) | dep `pdf-lib@1.17.1`, já usado nos PDFs de assinatura (`src/lib/documentos/`) |
