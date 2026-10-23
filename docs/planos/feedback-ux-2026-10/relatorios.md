# Feedback — /relatorios (builder + links públicos)

Tela: `src/app/(app)/relatorios/page.tsx` + `relatorio-builder.tsx` +
`relatorio-canvas.tsx` + `novo-link-dialog.tsx`.

## Itens do feedback

1. **Links públicos viram dropdown "Compartilhar"** — a seção de links
   criados sai da listagem principal; viram menu/dropdown sob o nome
   "Compartilhar".
2. **Menos atrito no form de compartilhar** — o formulário pra escolher o
   que compartilhar é grande demais e sem preview. Pedido: **importar o
   que já está setado nos filtros do builder** — o recorte atual da grade
   (turma, colunas, granularidade) já vem preenchido no dialog.
3. **Senha no mesmo form** — a definição de senha do link entra no mesmo
   form de compartilhar (não em tela à parte).
4. **Gerenciar no dropdown** — revogar, visualizar links criados, acessos:
   tudo atrás do dropdown "Compartilhar", não na página principal.

## Direção

**Revisão do Thiago sobre o mock v1** (`docs/mockups/relatorios/v1.html` —
referência de anatomia do dropdown, mas a direção muda):

- **O dialog ATUAL (`novo-link-dialog.tsx`) é melhor que o do mock** —
  manter o form real, não o redesenhado. O que muda no dialog:
  (a) título do link em cima; (b) resumo do recorte vai pra BAIXO do
  form (chips "T2 · por dupla · 8 colunas"), não eyebrow no topo;
  (c) **tira a prévia/miniatura** — atrito demais; (d) menos textinho
  eyebrow no geral. Form mais compacto que o atual.
- **A seção "Links públicos" vira dropdown mantendo a largura** — não um
  menuzinho estreito: um painel dropdown largo (≈ largura da seção atual)
  sob o botão "Compartilhar" na toolbar, com links ativos inline (copiar/
  revogar/redefinir senha/ver acessos) + item "Novo link público" no topo.
- **Senha**: campo livre pra digitar OU em branco = geramos uma forte —
  e a gerada vem com **botão copiar / cópia automática** (decisão do
  Thiago). Opção explícita "link sem senha" existe com aviso de
  exposição. RPC hoje só gera automática → migration + action pra senha
  digitada.
- **Contato**: `expor_contato` herda da grade como hoje (decisão do
  Thiago — fiel ao recorte).
- A listagem da página principal fica só com o canvas/builder; links
  saem da vista direta.

## Critérios de aceite

- [ ] Um único controle "Compartilhar" na toolbar do builder concentra:
      criar link, listar links existentes (com revogar), ver acessos.
      O painel aberto tem largura próxima da seção atual — não menu
      estreito. Nada de seção de links permanente na página.
- [ ] Abrir "Novo link" com filtros setados no builder → dialog já reflete
      turma/colunas/granularidade atuais (não os defaults).
- [ ] Dialog: título do link primeiro; resumo do recorte como chips no
      rodapé do form; SEM prévia/miniatura; microcopy mínima.
- [ ] Campo senha no dialog: digitável; em branco gera senha forte
      exibida uma vez com botão copiar (ou cópia automática + toast);
      toggle "sem senha" com aviso de exposição.
- [ ] Sem regressão: link criado abre `/resumo/...` público; specs de
      relatórios/links verdes; mobile 390px sem overflow no dialog e no
      painel dropdown.

## Mapa de regressões e gaps (review out/2026)

### Estado atual mapeado

- **Guarda**: `/relatorios` é coord-only — qualquer outro papel
  redireciona (`src/app/(app)/relatorios/page.tsx:23`). Reforço em duas
  camadas: `coordOuErro` nas actions
  (`src/lib/actions-relatorio-links.ts:34`) e `has_papel('coordenacao')`
  dentro das RPCs (0110:736).
- **Layout atual**: `page.tsx:141-147` renderiza `RelatorioLinksCard`
  (card **permanente** "Links públicos") **antes** do `RelatorioBuilder`
  — dropdown ainda não existe. O card traz o trigger "Novo link"
  (NovoLinkDialog **sem** `configInicial` → defaults) e a lista com
  `resumoRecorteLink` (relatorio.ts:804-828 — "Grade de pessoas · T2 ·
  sem contato"), slug, `acessos`/`ultimo_acesso`/`falhas_24h`,
  `expira_em`, `criado_por_nome`, badge "Sem senha" quando `!protegido`
  e `estadoLink` (Ativo/Expirado/Revogado, relatorio.ts:786). Menu ⋯ por
  link: Copiar link / Abrir público / Redefinir|Definir senha / Revogar
  (`ConfirmDeleteButton`); senha nova aparece uma vez inline.
- **Prefill existe pela metade**: `relatorio-builder.tsx:214-219` monta
  `configInicialLink = {tipo:"grade", turma, granularidade, colunas}` e
  passa pro `NovoLinkDialog` do botão "Publicar link" (:321-331) — o
  item 2 do feedback já funciona por esse caminho. **Bug latente**:
  `useState(configInicial…)` semeia só no mount
  (novo-link-dialog.tsx:120-136) — o dialog monta junto da página e
  mostra o recorte inicial mesmo depois da turma mudar. O critério
  "dialog reflete o recorte atual" exige re-seed ao abrir (padrão
  `draftDe` de `registros-filtros.tsx:46,223`) ou `key` no componente.
- **`NovoLinkDialog`**: tipo (grade|ciclo|assinaturas), título com
  sugestão (`TIPO_LABEL — turma|"Todas as turmas"`, :155-161), turma /
  granularidade / checkboxes de coluna, switch "Compartilhar contato"
  (default = `COLUNAS_CONTATO ∩ configInicial`, :130-132), selects de
  cronograma/documento/status/validade — **sem campo de senha**; a cópia
  diz "Sempre protegido por senha gerada na hora" (:516). Sucesso: link
  + senha em `Copiavel` (:260-270), "só o hash fica".
- **Actions**: `criarLinkRelatorio` (:45-69) → `rpc
  criar_relatorio_link {p_titulo, p_config, p_validade}`;
  `revogarLinkRelatorio` (:74) → `revogar_relatorio_link(p_id)`;
  `redefinirSenhaLink` (:94) → `redefinir_senha_relatorio_link(p_id)` —
  é também o "definir senha" do link legado sem hash.
- **RPCs (0110)**: `criar_relatorio_link(p_titulo text, p_config jsonb,
  p_validade interval default null)` (:724) **sempre gera** senha via
  `gerar_senha_relatorio()` (:200 — "xxxx-xxxx", ~39,7 bits, alfabeto
  sem ambíguos), grava só bcrypt e devolve o claro uma vez; **não aceita
  senha digitada** — senha no form exige migration + action.
  `revogar_relatorio_link(p_id)` (:781) seta `revogado_em` e
  `abrir_relatorio` recusa na hora. `redefinir_senha_relatorio_link`
  (:809) — também só gera. `relatorio_links_stats()` (:846) lista sem
  hash e já traz `protegido`, `acessos`, `ultimo_acesso`, `falhas_24h`.
  `relatorio_link_info(p_slug)` (:265) é o shell público neutro.
  `abrir_relatorio(p_slug, p_senha, p_ip_hash, p_ua)` (:310) compara
  bcrypt, rate-limita e audita em `resumo_acessos` (0106 — append-only,
  IP hasheado, retenção 13 meses; select é coord-only por policy mas o
  grant existe → log por evento pode ser query direta, sem RPC nova).
- **"Sem senha" já é estado suportado**: `senha_hash null` →
  `protegido=false`, badge na lista e `abrir_relatorio` pula a checagem
  (:427-429) — o seed 0111 tem um link legado assim. Só falta expor a
  escolha no form/RPC (hoje a RPC sempre gera).
- **`expor_contato`**: flag no `config` jsonb; a RPC (0110:453-518) só
  traz `email`/`whatsapp` quando true — e só pro tipo grade
  (ciclo/assinaturas nunca expõem contato, mesmo com config forjado).
  `configLinkOk` rejeita coluna de contato sem a flag;
  `COLUNAS_CONTATO = {email, whatsapp, contato_mentor,
  contato_mentorado}`. **Decisão Thiago**: `expor_contato` **fica com
  o toggle como está** (herda da grade, catálogo como hoje) — manter só
  o aviso visual no form (mock já sinaliza: chip warn "com contato" +
  nota "contato de menor = decisão delicada"), sem mudança de default.
- **Página pública**: `src/app/resumo/[slug]/page.tsx` (rota é
  `/resumo/[slug]`, não "token") — noindex, `relatorio_link_info` (:105)
  dá shell/estado neutro, `abrir_relatorio` (:141) valida **a cada
  render** (revogar/rodar senha vale na hora), cookie `resumo_<slug>`
  guarda a senha 30d httpOnly (`src/lib/actions-resumo.ts:30,50`).
- **e2e**: `tests/e2e/app/resumo.spec.ts` cobre o texto "Links
  públicos", o botão "Publicar link", labels do dialog (Título/Publicar
  link/Concluir), `code`×2 (url+senha), o gate público ("Relatório
  protegido"/"Senha do relatório"/"Abrir relatório") e revogação;
  fixtures semeiam `senha_hash` bcrypt direto. Demo:
  `demoRelatorioLinks` (demo/queries.ts:2269) alimenta a lista; mutações
  respondem `DEMO_MSG`.

### Riscos de regressão por item

1. **Dropdown "Compartilhar"** (itens 1 e 4): `ui/dropdown-menu` é menu
   estreito — painel largo pede `ui/popover` (existe, usado pelo
   app-shell) ou `Dialog`/`Sheet`; não há bottom-sheet na casa (o mock
   sugere sheet no mobile — componente novo). Tirar o card "Links
   públicos" e o botão "Publicar link" quebra `resumo.spec.ts` —
   atualizar o spec junto. E o cruzamento server×client muda: hoje o
   card (dados do server) é irmão do builder (estado do recorte); o
   painel na toolbar do builder precisa dos dois — `links` desce por
   prop ou o painel vira client com fetch próprio.
2. **Senha digitada** (item 3): exige migration — assinatura nova (ex.
   `p_senha text` + convenção/flag pra "sem senha"). `create or
   replace` com assinatura diferente cria **overload** no PostgREST —
   decidir drop da antiga ou manter compat, e os grants do overload
   novo precisam acompanhar. Validar senha digitada (tamanho/formato)
   no SQL ou na action; manter o retorno "claro uma vez" e o bcrypt no
   banco — nunca persistir/logar o claro. `redefinir_senha_*` tem o
   mesmo contrato gerado — decidir se "redefinir" aceita digitada.
3. **"Sem senha" explícito**: funciona por baixo (`senha_hash null`),
   mas pela UI atual é irreversível (voltar a ter senha = "definir");
   o toggle precisa do aviso de exposição + novo parâmetro na RPC.
4. **Cookie `resumo_<slug>` guarda a senha em claro** (httpOnly, 30d):
   com senha digitada pelo usuário — potencialmente pessoal/reutilizada
   — isso vira cópia dela no browser. Documentar; a gerada não sofre
   disso.
5. **Prefill** (item 2): `configInicial` cobre só grade — ciclo/
   assinaturas começam do zero (ok, saem do recorte). No dropdown novo,
   "Novo link público" deve nascer com o recorte do builder, não com os
   defaults do card — e ver o bug de seed stale acima.
6. **expor_contato herdado ON**: decisão do Thiago é herdar da grade —
   mas o catálogo nasce com contato ligado, então o link nasce com
   contato salvo o usuário desligar. Manter o aviso no form (chip
   "com contato" + nota) é o mínimo LGPD.
7. **`resumoRecorteLink` já existe** (relatorio.ts:804) — os "chips de
   recorte no rodapé" do dialog podem reusá-la em vez de formatador
   novo.
8. **"Ver acessos"**: `relatorio_links_stats` já traz agregados; log
   por evento é query direta em `resumo_acessos` (policy coord-only) —
   sem RPC nova, mas falta decidir onde renderiza (item no painel?
   dialog?).
9. **Título sugerido usa a string crua de turma** (:158) — se o plano
   de turmas mudar labels de exibição, o título do link público quer o
   longo (decisão já tomada lá).

### Gaps do plano

- **Contrato de senha não especificado**: assinatura nova do RPC, flag
  "sem senha", validação mínima e `redefinir` digitada — o plano só diz
  "migration + action".
- **Onde mora "ver acessos"**: agregado no item da lista vs. dialog com
  log por evento (`resumo_acessos` é consultável direto).
- **Composição do painel**: quem monta o painel (server) × quem sabe o
  recorte (client builder) — o cruzamento não está resolvido.
- **Mobile**: o mock sugere bottom-sheet; o critério só pede "390px sem
  overflow" — decidir se o sheet entra ou se popover resolve.
- **Muitos links**: `relatorio_links_stats` ordena `created_at desc`;
  o painel lista tudo ou N recentes + "ver todos" (pra onde)?
- **Expirados/revogados**: hoje a lista mostra todos — manter ordem/
  filtro (`estadoLink` já tem precedência revogado > expirado).
- **Demo**: o dropdown no demo mostra links (`demoRelatorioLinks`) mas
  mutações respondem DEMO_MSG — decidir se "Novo link" aparece/
  desabilita no modo demo.

### Opções de melhoria não cobertas

- `ui/password-input.tsx` já existe — senha digitável com toggle de
  visibilidade pronto.
- `Copiavel`/`CopiarLink`/`filterChipCls` reusáveis pros chips de
  recorte e pro link no painel.
- Cópia automática da senha gerada + toast: `sonner` já é a lib da casa.
- Se "sem senha" virar opção real, a RPC pode devolver `senha: null` e
  a UI pular o painel de segredo — um estado ambíguo a menos.
- `formulario-links` (forms engine) já tem UI de links públicos com
  dropdown por link (`formulario-links.tsx:251-264`) — vocabulário de
  menu a reaproveitar, mas o objeto é outro (tokens por destinatário).

### Must-read antes de implementar

- `supabase/migrations/0110_relatorio_links.sql` inteiro —
  `criar_relatorio_link` (:724), `abrir_relatorio` (:310; senha
  opcional :427-429), `revogar` (:781), `redefinir` (:809),
  `relatorio_links_stats` (:846), allowlist de `expor_contato`
  (:453-518). E 0106 (`resumo_acessos`) + 0111 (`turma_inscricoes`,
  seed legado sem senha).
- `src/components/novo-link-dialog.tsx` — form real a manter
  (`Copiavel` :65, seed `configInicial` :120-136 — re-seed ao abrir,
  trigger customizável :234-242).
- `src/components/relatorio-links-card.tsx` + `src/lib/relatorio.ts`
  (`estadoLink` :786, `resumoRecorteLink` :804, `COLUNAS_CONTATO`,
  `configLinkOk`).
- `src/app/resumo/[slug]/page.tsx` + `src/lib/actions-resumo.ts` —
  shell neutro, cookie `resumo_<slug>`, revalidação por render.
- `src/app/(app)/relatorios/relatorio-builder.tsx:76-123,214-219,
  321-331` — estado do recorte e `configInicial` já existente.
- `tests/e2e/app/resumo.spec.ts` — nomes que a spec procura ("Links
  públicos", "Publicar link", labels do dialog, `code`×2).
- `docs/mockups/relatorios/v1.html` — notas e decisões em aberto
  (:410-418) já respondem várias perguntas do dropdown.
