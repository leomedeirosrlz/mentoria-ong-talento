# Editor de PDF embutido — brainstorm técnico

**Frente:** o mentor (ou coord) anexa um PDF qualquer à dupla (worksheet "Definindo minhas metas", Roda da Vida impressa, planilha de submetas), gera um link tokenizado e o mentorado **preenche/edita o PDF no browser do celular** — desenhar à mão, escrever texto, marca-texto, assinar — e o resultado volta como arquivo da dupla, na ficha. Estilo tools.pdf24.org, com a barra SLC do produto.

**Público-alvo do editor:** mentorado em Android comum, 4G, sem conta. O link é o fator de posse (precedentes: `/f/[token]` forms engine, `/assinar/[token]` termos).

---

## 0. Recomendação em uma linha

**Arquitetura A** — `pdfjs-dist` renderiza as páginas em `<canvas>`, overlay de anotação em canvas 2D próprio com `perfect-freehand` (tinta bonita sem stylus), flatten para JPEG-por-página num PDF novo via `pdf-lib` (já instalada) — com o pipeline de entrega por tabelas novas `atividades` + `atividade_links`, espelhando `formularios`/`formulario_links` (0036). Caminho de upgrade preservado: `react-konva` no overlay (C) se os gestos encalharem; EmbedPDF (D) se um dia quisermos anotações-PDF-reais; pdfme (E) como superfície irmã para instrumentos estruturados.

---

## 1. Requisitos e restrições (o que pesa na escolha)

- **PDFs reais do programa são PDF-imagem.** `definindo_metas_preenchivel.pdf` (`.tmp-analise/`): ReportLab, 2 páginas A4, 1,8 MB, todo o conteúdo visível é JPEG embutido — e embora o `pdfinfo` reporte `Form: AcroForm` com ~20 widgets, o content stream é malformado (`pdftotext` cospe `Too few (0) args to 'rg' operator`). Conclusão: **não dá pra depender de campos AcroForm nem de camada de texto** — o editor tem que tratar o PDF como "papel fotografado" e desenhar por cima. (Oportunidade: quando o PDF de entrada tiver AcroForm sadio, aproveitar — ver §5 e §8.)
- **Mobile-first duro.** Mentorado em celular, frequentemente Android modesto → bundle enxuto, render por demanda (lazy pages), gestos bem-feitos (pinch/pan), hit areas ≥ 44 px, `env(safe-area-inset)` como o resto do app.
- **Storage escasso (1 GB).** Resultado precisa ser comprimido (JPEG-por-página ~150–200 dpi ≈ 250–400 KB/página) e com teto. Contexto do projeto já prevê offload frio p/ Drive — não bloqueia o MVP.
- **Servidor não processa PDF.** Vercel free + route handlers: sem poppler, sem canvas nativo. Parse/render/flatten no client; servidor só resolve token, valida e guarda bytes.
- **CSP rigorosa** (`next.config.ts`): `script-src 'self' 'unsafe-inline'`, `worker-src` não declarada (cai em script-src). Worker same-origin do pdfjs funciona sem mudança; WASM (pdfium/EmbedPDF) exigiria `'wasm-unsafe-eval'` e talvez `worker-src blob:` — custo de segurança real a pesar na opção D.
- **Padrões do codebase a respeitar:** RPCs `security definer` com grant `anon` (anon nunca toca tabela — 0036), route handler stream de arquivo com validação de token (`/api/assinar-token/[token]`), storage row-first + policy `path = name` (0009/0010), `{error}`/`{ok}` nas actions, demo-mode honesto, copy pt-BR.
- **`pdf-lib` 1.17.1 já é dependência** (gera os termos assinados — `src/lib/documentos/pdf.ts`).

---

## 2. Arquiteturas alternativas

Resumo:

| # | Arquitetura | Libs novas (licença) | Esforço | Mobile | Resultado |
|---|-------------|----------------------|---------|--------|-----------|
| A | pdfjs raster + overlay canvas próprio + freehand → flatten raster | `pdfjs-dist` 6.3.x (Apache-2.0), `perfect-freehand` 1.2.3 (MIT) | **M** | Ótimo | Alto (WYSIWYG garantido) |
| B | pdfjs + Fabric.js | `pdfjs-dist`, `fabric` 7.4.0 (MIT) | M | Bom | Alto |
| C | react-pdf + react-konva | `react-pdf` 11.0.0 (MIT), `konva` 10.7.0 + `react-konva` 19.3.0 (MIT) | M | Ótimo | Alto |
| D | EmbedPDF (pdfium WASM) + plugin de anotação | `@embedpdf/*` 2.15.x (MIT/Apache-2.0) | S de integração / **L de risco** | Incógnito | Altíssimo (anotações PDF nativas) |
| E | pdfme — preenchimento por template | `@pdfme/ui` + `@pdfme/generator` 6.2.2 (MIT) | M | Ótimo | Altíssimo p/ forms, sem desenho livre |
| F | iframe de ferramenta externa | — | S | — | **Inaceitável** |

Nas cinco opções viáveis (A–E), **tudo que não é o overlay de edição é igual**: mesmas tabelas, RPCs de token, rotas de arquivo, bucket, flatten por pdf-lib e superfície na ficha. A decisão real é "quem desenha e guarda as anotações em memória". Esforços abaixo medem o editor + fluxo ponta a ponta.

### A — pdf.js raster + overlay canvas próprio (recomendada)

Cada página vira um par de canvases empilhados: base (pdf.js render → bitmap) e overlay (anotações). O modelo de dados é uma lista de **ops por página** — `{tipo: "tinta"|"markertexto"|"texto", pontos[], cor, tamanho}` — serializável como `rascunho` jsonb (autosave = replay das ops). `perfect-freehand` transforma os pontos do dedo no polígono suavizado da tinta (é a engine de traço do tldraw/Excalidraw — desenho bonito sem stylus nem pressure).

- **Componentes/rotas:** `EditorPdf` (client, página `/a/[token]`); `NovaAtividadeDialog` + seção Atividades na ficha; rotas novas `GET /api/atividade/[token]/arquivo`, `POST /api/atividade/[token]/entregar`, `GET /api/atividade-arquivo/[id]` (autenticada, espelha `/api/anexo/[id]`).
- **Export:** redesenha base+overlay num canvas offscreen por página → `toDataURL("image/jpeg", 0.78)` → `pdf-lib` cria PDF novo e `embedJpg` página a página. **O PDF final não depende de parsear o original** — o pdf.js é o único parser, e ele tolera o content stream malformado do worksheet real. Efeito colateral positivo: saída comprimida por construção (~300 KB/página @ 150 dpi).
- **Prós:** zero dependência pesada além do pdf.js (padrão de mercado, Apache-2.0); bundle público enxuto (~350–450 KB gz somando pdf.js + worker + pdf-lib, tudo `import()` dinâmico e isolado na rota `/a`); controle total da UX pt-BR; funciona com qualquer PDF incluindo corrompido; op-model simples dá undo/borracha-por-objeto/rascunho de graça.
- **Contras:** o editor é 100% código nosso — gestos (pinch/pan), hit-test da borracha, replay, text tool. É o tipo de código que o codebase já escreve à mão (ver `ciclo.ts`, `agenda-calendario.tsx`), mas são ~1,5–2,5k linhas client novas; saída raster (zoom no PDF final é o DPI do JPEG — ok para o uso: fonte já é scan).
- **Riscos:** complexidade de gestos em telas diversas; mitigação = 2 dedos sempre pan/zoom, 1 dedo = ferramenta ativa; e fallback C (Konva) sem reescrever o resto.
- **Esforço: M.** Mobile: ótimo (controle total, sem lib disputando o touch).

### B — pdf.js + Fabric.js

`fabric` fornece `PencilBrush` (desenho livre nativo), `IText`, modelo de objetos com seleção, `canvas.toJSON()/loadFromJSON()` (rascunho praticamente grátis) e eventos de touch. O overlay vira um `fabric.Canvas` por página (ou um stage único com páginas empilhadas); base renderizada como imagem de fundo não-selecionável.

- **Prós:** menos código de canvas na mão; borracha = `canvas.findTarget`/remover objeto; modelo maduro e documentado; serialização nativa.
- **Contras:** fabric é opinativo — seleção/handles/controls atrapalham a UX minimalista mobile (dá pra desligar, mas é atrito); pinch-zoom **não** é built-in (fórmula manual com `viewportTransform`); ~100 KB gz a mais; versão 7 recém-reescrita (ESM-first, algumas mudanças de API vs. docs antigos).
- **Esforço: M** (menor que A no miolo, maior no domar). Mobile: bom. Licença MIT ok.

### C — react-pdf + react-konva

`react-pdf` (MIT, wrapper declarativo do pdf.js: `<Document>/<Page>` cuidam de worker e render) + `react-konva` (scene graph via React: `Stage/Layer/Line/Text`), com gestos maduros — pinch-zoom de stage é receita documentada do Konva e hit-testing é nativo (borracha = destroy do shape no ponto). `react-konva` 19.x é versionado junto ao React 19 — compatível.

- **Prós:** a parte mais arriscada de A (gestos + redraw + hit-test) vem pronta e testada; código declarativo idiomatico com o codebase (state → shapes).
- **Contras:** dois runtimes de render (React + react-reconciler interno do react-konva); ~200 KB gz a mais; Konva é overkill conceitual (engine de games/graphics) para "carimbar PDF"; `react-pdf` esconde o pdf.js — quando precisar de controle fino (render scale por DPR, lazy pages) briga com a abstração.
- **Esforço: M.** Mobile: ótimo. É o **plano B honesto**: se o overlay próprio de A sair do controle nos gestos, Konva entra como drop-in mantendo modelo de ops, export e backend idênticos.

### D — EmbedPDF (pdfium WASM) + plugin de anotação

`@embedpdf/core` + `@embedpdf/plugin-annotation` 2.15.x (MIT; adapter React 3.0.0-next.0 Apache-2.0): viewer headless rodando **pdfium** (o motor do Chrome) compilado pra WASM, com plugin de anotações — ink, free text, highlight, shapes, stamp — e `saveAsCopy()` que grava **anotações PDF de verdade** no arquivo (abrem no Acrobat, editáveis). É literalmente a experiência "pdf24" pronta.

- **Prós:** qualidade de renderização e fidelidade superiores; anotações estruturais (selecionáveis depois, exportáveis); menos código de canvas nosso; roadmap alinhado ao que queremos.
- **Contras (pesam muito):** projeto jovem (repo criado jan/2025, ~4,4k stars, v2→v3 em transição — adapter React ainda em tag `next`); WASM de ~2–4 MB gz na primeira carga (celular 4G, público de baixa renda — real); **CSP precisa abrir `'wasm-unsafe-eval'`** e provável `worker-src blob:`; debug de crash dentro do WASM é opaco; formato interno do estado prende ao vendor; superfície de customização pt-BR exige conhecer o sistema de plugins.
- **Esforço:** S–M para integrar algo bonito rápido; **L de risco** (maturidade + peso + CSP + lock-in). Recomendo revisitá-lo se a frente crescer para "editor de verdade" (redação, comentários, multi-anotador).

### E — pdfme: preenchimento por template (irmã, não substituta)

`@pdfme/ui` + `@pdfme/generator` 6.2.2 (MIT): modelo **template `{ basePdf, schemas[] }`** — campos posicionados sobre o PDF em branco (texto, data, checkbox, select, **signature pad**, imagem). A coord monta o template uma vez por instrumento (o Designer é embutível), o mentorado abre um `Form` e preenche campos — e `generate()` flattena.

- **Prós:** a resposta sai **estruturada** (json de valores por campo, não tinta) — alimenta relatório/360/matching depois; UX de preenchimento imbatível no celular (é um form, não uma prancheta); MIT, comunidade ativa; cobre 80% do caso real "preencher worksheet" com zero desenho.
- **Contras:** **não tem desenho livre/marca-texto** — "riscar", "circular uma frase", "desenhar seta" não existem (signature pad sim); exige template por instrumento (setup editorial por material); ainda assim PDF-imagem na base.
- **Esforço:** S para "Form com template fixo feito por nós"; M–L se embutir o Designer pra coord. Posição: **superfície complementar** — pdfme para os instrumentos oficiais conhecidos (metas, anamnese de saída), editor livre (A) para o PDF qualquer que o mentor subir. Não exclui A; reduz o escopo exigido dela.

### F — iframe de ferramenta externa (pdf24/DocHub/smallpdf) — descartada

Não há embed editável gratuito e white-label; o PDF (dados pessoais, frequentemente **de menor**) sairia do nosso perímetro para terceiro sem DPA; o resultado não voltaria à ficha; o token vazaria como posse; UX/branding fora do nosso controle; dependência de uptime e termos alheios; contraria SLC e LGPD. Nem como "provisório" — é o tipo de gambiarra que as regras do projeto vetam.

### Variante — rasterização server-side (base de A–C como PNG, não PDF)

Em vez do pdf.js no browser, um route handler rasteriza páginas para PNG/JPEG com `@embedpdf/pdfium` (MIT, roda em Node/Vercel serverless — mupdf é AGPL, evitar; pdftoppm exige binário que o deploy não tem). O client vira "anotador de imagens" puro: bundle mínimo, render instantâneo e idêntico em qualquer aparelho, até em celular que engasga com pdf.js. Custo: WASM no servidor (cold start ~100–300 ms), imagens intermediárias, zoom do base limitado à resolução pré-renderizada (mitigar com 2 resoluções + re-render sob demanda). Vale se a telemetria mostrar devices fracos demais — decidir com dados, não antes.

---

## 3. Modelo de dados, token e rotas

### Tabelas (migration nova, espelha 0036)

```sql
create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  dupla_id uuid not null references public.duplas (id) on delete cascade,
  encontro_num smallint,                 -- vínculo solto por número (padrão encontro_notas/materiais)
  material_id uuid references public.materiais (id),  -- origem = material oficial da biblioteca
  titulo text not null,
  instrucoes text,                       -- o que o mentorado deve fazer/preencher
  tipo text not null default 'pdf_livre'
    check (tipo in ('pdf_livre')),       -- cresce p/ instrumentos nativos (§6)
  origem_path text,                      -- PDF subido pelo mentor (bucket `atividades`)
  paginas smallint,
  status text not null default 'pendente'
    check (status in ('pendente','em_edicao','entregue','devolvida','cancelada')),
  rascunho jsonb,                        -- ops de anotação por página (autosave; cap ~5 MB)
  rascunho_em timestamptz,
  resultado_path text,
  resultado_thumb_path text,             -- JPEG 320 px p/ listagem na ficha
  resultado_tamanho integer,
  entregue_em timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(material_id, origem_path) = 1)
);

create table public.atividade_links (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  token text not null unique check (char_length(token) >= 20),  -- 192 bits base64url
  dest_mentorado_id uuid references public.mentorados (id),
  dupla_id uuid not null references public.duplas (id),         -- denormalizado como formulario_links
  expira_em timestamptz,
  ativo boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
```

**Por que tabela nova e não reutilizar `formulario_links`:** semanticamente outro ciclo de vida — link de formulário é *one-shot* (`usado_em` trava no submit); link de atividade é **multi-sessão** (rascunho reabre N vezes até entregar, e reabre de novo numa devolução). Amarrar atividade em `formularios` exigiria row fantasma de formulário sem campos — gambiarra explícita que as regras vetam. Mesmo shape físico (token 192-bit, `dest_mentorado_id`, `dupla_id` denormalizado, `expira_em`) → cópia honesta do padrão.

**RLS de `atividades`/`atividade_links`:** select — coord tudo; mentor e supervisor da dupla (mesmo `exists()` de `encontro_notas`, 0015). Write — coord + `d.mentor_id = my_profile_id()`. Anon: `revoke all`, fluxo público inteiro por RPC (mesma linha dura da 0036).

**RPCs públicas (security definer, grant anon — espelha `formulario_por_token`/`submeter_resposta_formulario`):**

- `atividade_por_token(p_token)` → `{status, titulo, instrucoes, destinatario, paginas, rascunho, expira_em}` — nunca `resultado_path` nem dados de outras rows (0053 style: recorte mínimo).
- `salvar_rascunho_atividade(p_token, p_rascunho jsonb)` → valida token ativo/não expirado → grava rascunho + `rascunho_em`, promove `pendente → em_edicao`. Teto no payload (`octet_length(rascunho::text) <= 5_000_000`).
- `entregar_atividade(p_token, p_resultado_path, p_thumb_path, p_tamanho)` → revalida token → grava resultado + `entregue_em` + `status='entregue'`, insere `notificacoes` pro mentor (`tipo` novo `atividade_entregue` — o CHECK de `notificacoes.tipo` ganha o valor na mesma migration). Idempotente: re-chamada devolve ok (retry de rede não duplica).
- (interna) `devolver_atividade` — mentor/coord reabre: `status='devolvida'`, mantém rascunho → o link volta a servir edição.

### Storage

Bucket novo **`atividades`** (privado): `origem/{atividade_id}.pdf`, `resultado/{atividade_id}.pdf`, `thumb/{atividade_id}.jpg`. Na criação: `file_size_limit = 25 MB`, `allowed_mime_types = '{application/pdf}'` — cap declarativo no storage (colunas reais de `storage.buckets`), reforçado no client. Policies `storage.objects` espelham 0009 (objeto só vale com row de metadados e escopo da dupla). Origem vinda de `material_id` não duplica arquivo — serve do bucket `materiais` já existente.

### Rotas

| Rota | Quem | O quê |
|------|------|-------|
| `GET /a/[token]` | público | Página do editor (server component resolve `atividade_por_token`; estados espelhando `/f/[token]` — não encontrado, expirado, cancelada, já entregue). Rota curta p/ WhatsApp; middleware ganha `p.startsWith("/a/")` em `isPublic`. |
| `GET /api/atividade/[token]/arquivo` | público | Stream do PDF base: RPC resolve token → `origem_path` ou `material.path` → download via **`createAdminClient()`** (`src/lib/supabase/admin.ts` já existe — primeiro uso de service role pra storage; a fronteira é a validação do token na RPC, como `/api/assinar-token`). `Cache-Control: private, no-store`. |
| `POST /api/atividade/[token]/entregar` | público | Multipart com o PDF final → valida token via RPC → checa `%PDF` + MIME + teto (ex. 15 MB) → upload admin pro `resultado/` + `thumb/` → chama `entregar_atividade`. Se a RPC recusar (link morto), remove o objeto (sem órfãos). |
| `GET /api/atividade-arquivo/[id]` | app | Signed URL 300 s do resultado/origem p/ usuário logado — espelha `/api/anexo/[id]`; a RLS de `atividades` já autoriza (404 fora do escopo). |

**Sobre o service role no fluxo público:** anon não alcança `storage.objects` (linha dura intencional) e o Postgres não emite signed URL — as duas saídas honestas são admin client no route handler (escolhida; a autorização continua sendo o token validado por RPC security definer) ou abrir policy de storage pra `sistema/`-style prefix (não cabe: arquivos são por-dupla, privados). O mesmo handler serve o base PDF no modo "preview do mentor" se quisermos unificar — mas o autenticado usa a rota `/api/atividade-arquivo/[id]` com RLS normal.

---

## 4. UX do fluxo completo

1. **Criar (mentor, na ficha da dupla — "a telinha é a tela de trabalho"):** seção/card **Atividades** na ficha (nova, ao lado de `ArquivosDupla` e por-encontro na `EncontroRow` quando `encontro_num` bate). `NovaAtividadeDialog`: título, instruções pro mentorado, **fonte do PDF** — upload (`accept="application/pdf"`, teto 20–25 MB, mensagem pt-BR) *ou* "usar material da biblioteca" (lista `materiais` com `path` da audiência dele; `encontro_num` pré-sugere pelo `materiais.encontro_num`). `criarAtividade` insere a row já com `origem_path` (padrão row-first, 0010) → client sobe o arquivo → `criarLinkAtividade` gera o token (dedupe por `atividade_id` + destinatário ativo, igual `criarLinkFormulario`).
2. **Enviar:** dialog pós-criação com link + botão **WhatsApp** (`waLink(mentorado.whatsapp, "Oi {nome}! ... {link}")` — helper já existe em `ciclo.ts:1172`) + copiar. Reemitir rotação de token p/ expirado (espelha `reemitirLinkFormulario`).
3. **Abrir (mentorado, celular):** `/a/{token}` → landing mínima no padrão `/f` (logo, "Programa de Mentoria Social", saudação com primeiro nome): título, instruções do mentor, prazo, botão **"Abrir e preencher"** → editor fullscreen.
4. **Editar:** ferramentas do §5; **autosave do rascunho** (debounce ~1,5 s) via `salvar_rascunho_atividade` — o rascunho mora no servidor, então fechar e reabrir o link (mesmo em outro aparelho) restaura tudo. Banner discreto "Rascunho salvo automaticamente".
5. **Entregar:** CTA fixo "Entregar atividade" → resumo ("N páginas preenchidas — dá pra voltar e editar enquanto o mentor não devolver") → confirma → client gera o PDF final (flatten, §5) → `POST /api/atividade/{token}/entregar` → card de sucesso "Enviado! {mentor} já foi avisado." Estado `entregue` no link vira card informativo (e "ver o que eu enviei" = rota pública do resultado por token — opcional MVP).
6. **Ver (mentor):** card da atividade na ficha muda para `entregue` + notificação `atividade_entregue` (bell já existe); clique abre o PDF (signed URL autenticada) e a thumbnail na lista. Ações do mentor: **devolver pra ajuste** (reabre o link com o rascunho intacto — o WhatsApp de aviso é dele, coerente com "a dupla agenda; a plataforma monitora"), cancelar, baixar.
7. **Auditar (coord):** mesma visão da ficha (RLS cobre) + a listagem pode entrar no painel agregado depois — MVP: visão por dupla basta.
8. **Resultado no acervo da dupla:** a seção "Arquivos" da ficha (hoje só `registro_anexos` — `arquivos-dupla.tsx`) passa a unir os `resultado_path` de atividades entregues ("Atividade: {título} · entregue em {data}") — um lugar só pra "o PDF da Roda da Vida preenchida", sem duplicar arquivo no `registro-anexos`.

---

## 5. Editor — ferramentas mínimas e UX mobile

Toolbar inferior fixa (polegar), 44 px, Phosphor — padrão "poucas ferramentas, cada uma ótima":

| Ferramenta | MVP | Notas |
|------------|-----|-------|
| **Caneta (tinta)** | 2 espessuras × 3 cores (preto, azul, vermelho) | `perfect-freehand` suaviza; serve como "assinar à mão" — assinatura é desenho informal, **não** o fluxo jurídico de `assinaturas` (0033: IP/UA/hash). Produto deve manter essa fronteira no copy ("desenhar", não "assinar documento"). |
| **Marca-texto** | amarelo ~40% alpha, ponta chata | canvas: `globalCompositeOperation="multiply"` no replay (o traço "gruda" no papel como marca-texto real). |
| **Texto** | toque cria caixa; tamanho único relativo ao zoom | input ancorado acima do teclado virtual; commit = op `texto`. Fonte do sistema no canvas (export raster herda — consistente). |
| **Borracha** | por objeto: toca num traço/texto → apaga a op inteira | hit-test distância ponto→polilinha (raio ~12 px); honesta e previsível. Pixel-eraser = v2. |
| **Desfazer/refazer** | pilha de ops por página | `history[]`/`redo[]`; autosave grava o estado resultante. |
| **Zoom/pan** | 1 dedo = ferramenta ativa; **2 dedos = pan + pinch sempre** | transform CSS durante o gesto (60 fps) + re-render pdf.js no settle em resolução maior. Fit-width default; max ~4×. |
| **Páginas** | scroll vertical contínuo (padrão pdf24), páginas lazy | `IntersectionObserver`; overlay redesenha ao entrar no viewport. |
| **Rascunho** | autosave debounce → RPC | "Continuar de onde parei" é o default do link. |
| **Entregar** | flatten raster → PDF novo | JPEG q~0,78 a 150–200 dpi; thumb 320 px; barra de progresso por página ("Preparando página 2 de 3…"). |

**Cerejas (v2):** formas (círculo/seta — a Roda da Vida pede marcas sobre sectores), texto com 2 tamanhos, borracha de pixel, modo "assinatura guiada" (caixa tracejada + linha de base), e **AcroForm fast-path**: se `pdf-lib.getForm().getFields()` achar campos sadios ou o pdf.js `page.getAnnotations()` devolver widgets, gerar inputs posicionados sobre os rects e preencher via `field.setText()` — o worksheet real declara 20 widgets (malformados no content stream, então é oportunidade a testar, não fundação).

**Detalhes mobile que fazem a diferença:** `touch-action: none` no stage; Pointer Events (uma API só p/ mouse+toque); `devicePixelRatio` cap 2; sem `oncontextmenu`; teclado não cobre o input (anchor bottom + `scrollIntoView`); rotação de tela re-fita a página.

---

## 6. Convivência com "atividades interativas" nativas

O outro plano cobre instrumentos nativos (Roda da Vida desenhada na plataforma, PDM estruturado, forms). A frente deles e esta convergem no mesmo conceito — **atividade entregável por link** — e devem compartilhar o chassis:

- **`atividades.tipo`**: `'pdf_livre'` agora; `'roda_vida'`, `'pdm'`, etc. depois. Mesma tabela, mesmo `atividade_links`, mesmas rotas de token/entrega/notificação, mesma seção na ficha. O que muda por tipo é só o editor (canvas livre vs. instrumento dedicado) e o payload (`rascunho` de ops vs. dados estruturados + PDF gerado server-side via `documentos/pdf.ts`).
- **Divisão de casos:** instrumento oficial conhecido → nativo (dado estruturado, relatório possível); PDF arbitrário que o mentor trouxe → editor livre. Se a frente E (pdfme) entrar, vira um terceiro `tipo` — `'template_pdf'` — reusando tudo menos a tela de edição.
- **Na ficha:** uma única seção "Atividades" lista todas, com badge por tipo; os resultados caem juntos em "Arquivos". Mentor não aprende dois conceitos.

Ponto de alinhamento entre os dois planos: o schema acima já prevê `tipo` e `rascunho` genéricos — ratificar para não nascerem duas tabelas quase-iguais.

---

## 7. Transversais

- **Worker do pdf.js sem CSP nova:** copiar `pdfjs-dist/build/pdf.worker.min.mjs` para `public/` (script postinstall ou `?url` do bundler) e `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"` — worker same-origin respeita `script-src 'self'` (worker-src herda). Se escolher D, abrir `'wasm-unsafe-eval'` (+ talvez `worker-src blob:`) — decisão de segurança explícita.
- **Bundle:** tudo `await import()` dentro do componente do editor — a rota pública `/a` é leaf e isolada; o app logado não paga 1 KB.
- **Notificações:** `notificacoes.tipo` CHECK ganha `'atividade_entregue'` (mesma migration). Sem notif pro mentorado — o canal dele é o link; lembrete é o mentor reenviar (WhatsApp manual, coerente com o domínio).
- **Demo:** fixtures em `src/lib/demo/data.ts` (`atividades` + link com token legível); `/a/[token]` em demo abre o editor de verdade sobre um `demoPdf` placeholder (helper existe); salvar rascunho/entregar → `DEMO_MSG` como toda escrita demo; a ficha demo mostra uma atividade entregue com thumb.
- **Compressão/teto:** origem ≤ 25 MB (cap do bucket + validação client); resultado alvo ~300 KB/pág. (teto 15 MB na rota de entrega); thumb ~30 KB. Orçamento: 60 duplas × 10 atividades × 1 MB ≈ 0,6 GB — dentro do 1 GB, e o offload frio pra Drive (contexto) resolve o futuro.
- **Sem email por ora:** `emails_enviados` existe (0056/0057) — se quiserem, o link também pode ir por Resend depois; WhatsApp é o canal real.

---

## 8. MVP → visão

**Fase 1 (MVP SLC):** migration (tabelas + bucket + RLS + RPCs + tipo de notif), `/a/[token]` + 3 rotas de arquivo, editor A completo (caneta, marca-texto, texto, borracha, undo, zoom/pan, autosave, entrega raster), criação + link + WhatsApp na ficha, status chips, ver resultado (signed URL + thumb), seção Atividades na ficha, "Arquivos" unindo resultados, demo honesto. *Esforço total: L (o editor é ~60% do trabalho).* Cortável se apertar: devolução (fase 1.5) e "ver o que enviei".

**Fase 2:** devolver-com-comentário (motivo vira banner no link), histórico de entregas (`entregas` se auditarmos versões), AcroForm fast-path, formas (seta/círculo), assinatura guiada, lembrete automático de link perto do `expira_em`, preview embutido do resultado na ficha.

**Visão (não-comprometer agora):** export vetorial (`pdf-lib` tem `drawSvgPath` + `drawText` — traços viram paths nítidos e o arquivo fica minúsculo; exige fonte embed + conversão de coordenadas — só vale se saírem PDFs com camada de texto real), pdfme pros instrumentos oficiais (E), EmbedPDF se virar "editor de verdade" (D), co-edição sequencial mentor↔mentorado no mesmo PDF (segundo link com papel, ou o mentor edita logado), resultado atrelado ao `registro` do encontro quando houver.

---

## 9. Perguntas abertas

1. **Devolução entra no MVP?** Sem ela, "ficou ruim" vira conversa no WhatsApp e nova atividade — aceitável? (Recomendo fase 1.5 rápida, não cortar o conceito.)
2. **Versões de entrega importam?** Auditoria fina (o que mudou entre entrega 1 e 2) pede tabela `entregas`; sobrescrever `resultado_path` é mais simples e provavelmente suficiente.
3. **"Assinatura" desenhada no worksheet tem peso?** Se algum instrumento virar documento (não exercício), precisa entrar no fluxo 0033 com evidências — manter o editor como "preenchimento", nunca "assinatura de termo". Decisão de produto, não técnica.
4. **Mentor também edita o PDF** (preenche metade, mentorado completa)? Se for caso real, planejar o link do editor logado desde o MVP (mesma tela, auth diferente).
5. **Prazo/lembrete:** `expira_em` default sugerido (7 dias? até o próximo encontro?) e nudge automático ou manual?
6. **Instrumentos oficiais da biblioteca** (`materiais` com `path`) viram atividade com um clique a partir da tela de Materiais, ou a criação só acontece na ficha? (Recomendo os dois: atalho em Materiais cria a atividade já com `material_id` + `encontro_num`.)
7. **Resultado também anexa ao `registro`** do encontro (quando existir) ou só na seção Arquivos? Duplicar arquivo não; linkar sim — decidir a apresentação.

---

## Apêndice — libs verificadas (npm, set/2026)

| Lib | Versão | Licença | Papel |
|-----|--------|---------|-------|
| `pdfjs-dist` | 6.3.289 | Apache-2.0 | render páginas → canvas (A–C) |
| `react-pdf` | 11.0.0 | MIT | wrapper React do pdf.js (C) |
| `perfect-freehand` | 1.2.3 | MIT | traço de tinta suavizado (A) |
| `fabric` | 7.4.0 | MIT | canvas object-model completo (B) |
| `konva` + `react-konva` | 10.7.0 + 19.3.0 | MIT | scene graph + gestos (C) |
| `pdf-lib` | 1.17.1 ✅ instalada | MIT | PDF final (embedJpg/drawSvgPath/getForm) |
| `@embedpdf/core` + `plugin-annotation` + `pdfium` | 2.15.1 | MIT/Apache-2.0 | viewer+anotações nativas (D) — React adapter 3.0.0-next.0 |
| `@pdfme/ui` + `@pdfme/generator` | 6.2.2 | MIT | template-fill estruturado (E) |
| `signature_pad` | 5.1.4 | MIT | (não precisa — freehand cobre) |
| `tldraw` | 5.5.2 | comercial (key obrigatória em produção; hobby com watermark, discricionária) | inviável p/ SLC sem custo |
| `mupdf` | 1.28.1 | AGPL-3.0 | evitar (copyleft) |
| `react-pdf-highlighter` | 8.0.0-rc.0 | MIT | só highlight de camada de texto — não se aplica (PDFs são imagem) |
