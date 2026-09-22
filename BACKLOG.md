# Backlog — realiza.vc

Fonte única de pendências. Itens resolvidos são removidos das listas e somados ao resumo abaixo.

Resolvido até aqui: fuso SP em `ciclo.ts`, datas date-only, CSV multi-linha/BOM/`normWhatsapp`/`emailValido`, enum `sem papel`→`null` + validação de papéis/status, `agendarEncontro` (data inválida, número limitado ao ciclo, não reescreve `realizado`, dupla inativa, fuso resolvido no client com ISO + server aceita naïve como SP, `origem`/`link`/`created_by` preservados), `salvarRegistro` (só encontro passado/realizado da própria dupla, dupla ativa, enums validados, `created_by` só no insert, update→realizado checado), `RegistroForm` gated por data + editável com prefill, encaminhamentos em JSON com dedup + reset pós-salvar + keys estáveis + linha clicável inteira, open redirect em `/auth/confirm`, `erroAmigavel`, RLS endurecido (`0004`), semáforo respeita `iniciada_em` e congela pausada/encerrada + motivo com número real do encontro faltante, trilha completa esconde "agendar", coordenação não agenda/registra, `mentor_profile` não zera em update parcial + sincronizado nas transições de papel, `whatsapp` vazio→`null` e inválido→erro (não apaga campo), signup pentestado, mobile-first completo, copy pt-BR acentuado em `src/` e no seed/migration `0005`.

Reviews set/2026 (5 ondas executadas): RLS silenciosa→`ok:true` eliminada nas actions (`.select("id")`+guard), anti-self em `setPessoaAtivo`/`setPessoaRole`, `mentor_especialista` visível no NovaDuplaDialog + supervisor "Nenhum", remarcar dessincronizado corrigido, `nao_aconteceu` com confirm + reversível (`desfazerNaoAconteceu`), validações de e-mail/whatsapp/supervisor/`iniciada_em` (default = 1ª semana antes do 1º encontro do ciclo, via `inicioDefaultDupla`)/capacidade/números/URL scheme/`javascript:`, import (papel desconhecido→puladas, erro de `mentor_profiles` reportado, dedup intra-arquivo por whatsapp, `mapRole("supervisão")`, `normWhatsapp` respeita `+`, delimitador misto ignorado), loop de login morto (sign-out nas telas bloqueadas), login com erros pt-BR + `try/finally` + `useMemo` + "Usar outro e-mail", nudges naturais por caso (sem motivo interno), "Falar com mentorado" só coord/supervisor com nome, terminologia padronizada ("mentorado", "Programa de Mentoria Social", "ciclo", "Marcar apoio como atendido"), plurais `"(s)"` eliminados, tokens `--ok-text`/`--warn-text`/`--destructive`/`--danger` passando AA, hit areas, labels de Select associadas, `SemaforoDot` `role="img"`, `NudgeButton`→`<a>` com estado "Sem WhatsApp", "em breve" visualmente distinto, `not-found`/`error` pt-BR, "Close"→"Fechar", Lucide→Phosphor (lucide-react sem uso), sonner light fixo, `focus-visible` nos stretched-cards, metadata por rota, `eventoDaSemana` sem encontro velho, `diffDias`/`page.tsx` sem prop `me` morta, empty states agenda/materiais, `createPessoa` com whatsapp/capacidade validados. Migration `0005` aplicada no remoto (2026-09-18): 14 títulos + fases + instrumentos de `ciclo_eventos`, 12 linhas de `materiais` e `registros.atividades` acentuados — verificado com SELECTs, zero pendências.

Sprint set/2026 (agents em paralelo): bug semana 3×2 (agenda passou a usar `eventoDaSemana`, `diffDias` invertido removido); **agenda virou calendário mensal real** (`agenda-calendario.tsx`: grade dom–sáb, nº do encontro na célula, recesso como faixa, detalhe ao tocar, lista do mês, legenda, chip "Semana do Nº"); **guardas de dupla** (mentorado único em ativa/pausada + capacidade do mentor, em `createDupla`/`updateDupla` com `.neq` na própria); contador "X/Y" + disabled nos selects de mentor; prefill de terça-19h no agendamento; `mentor-home` reusando `saude.proximo`; **busca por nome** em `/pessoas` e `/duplas` (client components novos, normalização sem acento); nudge de registro pendente com link direto `#registrar-{id}`; **PWA** (`manifest.webmanifest`, icon/apple-icon/maskable, `themeColor` em `viewport`); matcher do middleware excluindo `manifest.webmanifest` + segment match `/login`.

## Decisões do Thiago (set/2026)

- **Termo do jovem**: `mentorado` — padronizado; "(a)" só onde o gênero importa. "jovem realizador" fica só no badge (nome oficial).
- **Nome do programa**: **Programa de Mentoria Social** — único.
- **"matching"**: termo oficial — mantido.
- **`nao_aconteceu`**: reversível com confirmação — implementado (confirm ao marcar + "Desfazer" na timeline + reagendar via dialog).
- **Re-match pós-encerramento**: válido — `0006` trocou o unique por índice parcial `WHERE status IN ('ativa','pausada')`.
- **`realizado_em`** = quando o encontro aconteceu de fato (não quando registraram) — `salvarRegistro` carimba `data_hora`; retroativo preenche com a data informada.

---

## Polimento contínuo set/2026 (waves de agents — executado)

**Correção/a11y**: `new Date()` de client components virou prop `agora`/`hoje` do server (hydration segura); dashboard voltou a server component (`headers()` → `origem`, `useSyncExternalStore` fora); CTA morto do supervisor; `scroll-mt` na âncora `#registrar-*`; touch targets 44px mobile em `buttonVariants`/`Input`/`SelectTrigger`; `prefers-reduced-motion` global; `.dark` removido (sem toggle); Label↔Select associado em todos os dialogs; fieldset/legend nos grupos do RegistroForm; inputs sem nome acessível corrigidos; selects não cortam mais opções longas; login com `<h1>`/`role="alert"`/foco no painel; `DialogFooter` nos dialogs destrutivos; calendário com `role="grid"` + roving tabindex + setas + `aria-pressed`/`aria-current` + detalhe `aria-live` + todos os dias clicáveis + `fmtCompleta` nos labels; `loading.tsx` no grupo `(app)`; dead code removido (lucide-react, next-themes, ui/{tabs,table,avatar,separator}, svgs boilerplate); `normaliza`→`lib/utils`; `/pessoas` com query leve `getDuplasResumo`; `queries.ts` lança erros (maybeSingle onde null é legítimo); NovaDuplaDialog ordenado + mentorado ocupado disabled; `0006` re-match no remoto; `/16`→`totalEncontros(eventos)` em tudo; `type="submit"` explícito.

**Features**: **encontro retroativo** (`0007` `realizado_em` + `registrarEncontroRetroativo` + dialog + CTAs na página da dupla e home do mentor — mata o falso "em atraso" de quem se encontrou fora da plataforma); **faixa "Esta semana"** no dashboard (realizaram/registros/aguardando + "Copiar resumo" pro WhatsApp da equipe); **semáforo preventivo** ("o Nº encontro é terça e ainda não foi agendado", ≤5d, sem row); **apoio de dupla pausada** visível (encerrada não — capítulo fechado); **TrajetoriaAvaliacoes** (sparkline de 16 dots no card e no header da dupla); **"Da última vez"** no RegistroForm (combinados pendentes com checkbox → conclusão em lote no `salvarRegistro`); **rascunho local** do registro (localStorage por encontro, restore com banner, limpa no submit); tag "criado no Nº encontro" nos encaminhamentos; **metadata do registro** ("Registrado em … por …" + chip "registro tardio" >3d, join `autor:profiles`); página da dupla com encontros futuros colapsados em `<details>`, link de material por encontro, "Falar com mentorado" pro mentor e "Enviar combinados" (wa.me com pendentes, gateado ao mentor); **anexos de evidência** (`0009`: `registro_anexos` + bucket privado `registro-anexos`, ordem row→upload exigida pela policy de storage, RLS testado por role, `/api/anexo/[id]` → signed URL 300s); **interacoes** (`0008`: log de nudges — `/api/nudge` loga + redireciona, `to` validado wa.me-only, dedup 60s anti-double-tap; "Último nudge dd/mm por …" nos cards); **matching board** em `/pessoas` (chip "Sem dupla · N livres", badges "X/Y duplas", "sem termo"/"sem formação", "especialista").

**Registro wizard + agenda**: `RegistroForm` virou wizard de 3 etapas ("Como foi" → "Sinais de atenção" → "Combinados") — etapas montadas com `hidden` (FormData/rascunho intactos), progresso "Passo X de 3" com foco no heading, portão da avaliação no Avançar e no submit, rodapé sticky; `onSaved` dispara em toda gravação; prop `embutido` tira moldura/título pra uso dentro de modal. Na agenda, o encontro realizado-sem-registro (ou agendado vencido) da dupla abre o form **em Dialog** (`sm:max-w-xl`, responsivo por si) — sem sair pra ficha; retroativo criado pela agenda volta pro dia e já abre o modal (`onCreated` nos dialogs substitui o `router.push` quando presente). **Copy**: "Encaminhamentos" → "Combinados" nas superfícies visíveis + linha explicativa na ficha ("Tarefas que a dupla combinou nos encontros — marque quando forem feitas") e "Novos combinados · o que ficou combinado de fazer até a próxima vez" no passo 3; mural sem microcopy de teclas.

**Gamificação de jornada** (`.devin/plan-gamificacao-jornada.md`): `jornadaDaDupla`/`marcosEntre` em `ciclo.ts` (derivação pura, zero backend — sem tabela de marcos/streak/pontos); `TrilhaJornada` = trilha de nós escopada na janela `iniciada_em` (lime = realizado+registro, âmbar = sem registro, anel âmbar = limbo, anel = agendado, riscado = não aconteceu, muted = futuro; "próximo" = anel lime + `aria-current` + ping único — posição não sobrescreve situação), marcos por limiar de posição (Flag/Medal/FlagCheckered/Trophy, só desenhados depois de atingidos), caption de fase real (`ciclo_eventos.fase`, 6 fases), mini-chave contextual; `MarcoNotifier` dispara toast do marco mais alto cruzado via `localStorage` (cobre retroativo/follow-up/correção passiva), só pro mentor; streak **cortado pelo Thiago** ("meio inútil"); staff vê trilha read-only na ficha, dashboard de coord/sup intocado — jornada individual, nunca competição entre duplas.

---

## Sprint visual "sai do genérico" (set/2026) — plano em execução

Diagnóstico (3 audits com skills): tudo `--background`=`--card`=branco puro (sem plano de fundo); `--accent` amarelo pinta hover de menus em ouro num app lime; tipografia de uma nota (font-medium ~66×, zero text-xl); hierarquia invertida na célula do calendário; "semana do encontro" não desenhada; recesso invisível.

**Wave 1 — fundação + calendário + home** ✅ executada (3 agents)
- [x] `globals.css`: bg tingido (hsl 240 2% 97%), `--foreground`→15% (+siblings), `--accent` ouro→neutro, `--brand-yellow` morto removido, tokens `--shadow-border`/`-hover`, `.hatch-recesso`, `.animate-enter-x`+`--dir`, `::selection` lime/ink
- [x] `agenda-calendario`: hoje=círculo ink no numeral, selecionado=ring neutro (scale morreu), numeral top-left tabular, **faixa da semana** (wash lime/8 na row), recesso hatch+label "Recesso", chrome `text-lg`+fase+botão "Hoje"+transição `--dir`, detalhe editorial (número `text-3xl` + caption relativo + próximo evento), legenda 3 itens, lista agrupada por semana
- [x] `dashboard`/`mentor-home`/`duplas-lista`: semáforo na superfície (tint danger/5, warn/8), stats `text-3xl`, barra de progresso lime `N/16`, `Num` sem mono, Sep racionalizado (≤1 `·`), empty states com ícone+hierarquia, painéis internos→`bg-muted/40`

**Wave 2 — identidade** ✅ executada
- [x] **Rail do ciclo** (`1—16` clicável, estados realizado/atual ring/futuro, scrollIntoView no nó atual, reduced-motion) + layout 2-col desktop (detalhe sticky `lg:top-4`, lista full-width)
- [x] `duplas/[id]`: discos lime nos nº realizados (line-through em não-aconteceu), wash warn/5 em registro pendente, `text-balance` h1, `line-clamp-2` títulos, h2 semibold
- [x] Sweep surfaces + tipografia: overline unificado `text-[11px] font-semibold tracking-[0.08em]`, `peer-checked:font` fix, `text-[10px]`→11px, bottom-nav `ok-text`→`brand-ink`, sidebar ativo ink-on-lime, login h1 `text-lg`, `title` attrs, `break-words`

**Anti-slop travado**: sem gradiente/glass/glow/bento, sem deps novas, sem pills decorativas, sem stagger em 35 células, Mitr fica (problema é uso, não escolha).

## Sprint UX — skeletons + onboarding + funil (set/2026)

- [x] **Skeletons por rota** — 6 `loading.tsx` espelhando layout real (home/agenda/duplas/ficha/materiais/pessoas); home movida pra `(app)/(home)/` pra matar o boundary duplo do grupo (era skeleton genérico → skeleton da rota = 2 flashes; agora 1 por navegação)
- [x] **Checklist de setup da coordenação** — `setup-checklist.tsx`: card data-driven que se auto-risca e some quando completo; passos da dupla viram hint, não link (regra do domínio); `getContagemPessoas` head-count
- [x] **Linha de orientação pro mentor** — "Vocês marcam o encontro; depois registram aqui como foi." no header ink
- [x] **Documentos por pessoa** — `0012` no remoto: `documento_path` em profiles/mentorados + bucket privado `documentos` (row→upload exigido pela policy, coord-only leitura/escrita) + `/api/documento/[id]?tipo=` signed URL + seção "Documento oficial" nos dialogs de edição
- [x] **Export CSV do ciclo** — `/api/export` coord-only (403 supervisor/mentor): 12 colunas, `;` + BOM + `\r\n` pro Excel pt-BR, datas em SP, `motivo_reagendamento` incluso; botão "Exportar CSV" em `/duplas`
- [x] **Motivo de reagendamento** (substitui "frequência por pessoa") — `0011` no remoto: `encontros.motivo_reagendamento`; obrigatório quando a data muda num encontro já agendado (mesma data/só link não pede), 5 presets + "outro" livre (2–140), `· remarcado: {motivo}` auditável na timeline
- ~~**Candidatura pública**~~ — descartada por agora (Thiago, set/2026): funil fica no Google Forms, plataforma assume pós-seleção
- ~~**Frequência por pessoa**~~ — descartada: o motivo auditável de remarcação cobre o caso real ("ausência do mentorado") sem schema de participantes

## Sprint UX — caça-gaps (set/2026) ✅ executada

3 auditors + 3 fixers. **O beco sem saída**: encontro `agendado` com hora já passada era invisível (`saude.proximo`/`semRegistro` só viam futuro/`realizado`) → home dizia "ainda não agendado" → dialog sem motivo → servidor exigia motivo. Resolvido: `emLimbo` no `saudadeDaDupla` (agendado-passado vira registro pendente — motivo "agendado já passou — falta o registro", não conta como atraso), `atual` do dialog virou a row real do numero, motivo `required` só quando a data muda de fato, `agendarEncontro` rejeita data passada (aponta pro retroativo).

- [x] **Deep-link completo** — middleware preserva `?next=` (path+query), login-form repassa no `emailRedirectTo` **e** o `location.hash` (`#registrar-{id}` sobrevive ao magic link), `/auth/confirm` devolve `next` no erro, `/api/nudge` idem
- [x] **Login em duas abas** — o link do e-mail abre `/auth/confirmado` (check animado + `window.close` + "continuar" fallback: `window.close` só fecha janelas abertas por script, browsers bloqueiam na maioria) e a aba original entra sozinha via `onAuthStateChange` + poll `getSession` + `visibilitychange`/`focus`; painel "Link enviado" ganhou o aviso "esta página entra sozinha"
- [x] **`RevelarApos`** — gates de tempo (`NaoAconteceuButton`/`RegistroForm`) viram client-tick 30s; tab aberta revela os controles quando a hora do encontro chega
- [x] **Erros honestos** — `me()` null → "Sessão expirada — entre de novo." em 26 actions; try/catch→toast em todos os submits (antes falha de rede era silêncio); API routes devolvem 500 texto em vez de `throw`
- [x] **Coerção silenciosa morta** — `iniciada_em` vazio preserva (não zera), `capacidade` vazio→erro (não vira 1), whatsapp inválido no CSV→pulada (não null), `createMentorado` valida e-mail, `precisa_apoio` sticky na edição, `mentor_profiles` fetch-error não sobrescreve com defaults, `motivo_outro` minLength
- [x] **Infra de navegação** — `!me` no layout virou tela bloqueada (era loop infinito de redirect), nudges da página da dupla logam `duplaId`+`t=contato`, `encontro.link` visível na timeline, rows com pendência fora do `<details>` (âncora sempre alcançável), scroll-to-card após registro retroativo, `duplasPorDia` filtra ativas, `podeExcluir` alinhado ao guard do servidor (`temQualquerDupla` inclui encerrada)
- [x] **Login polish** — email trim+lowercase, autofocus, painel ecoa o e-mail, "Reenviar link ou usar outro e-mail", copy PKCE ("abra no mesmo navegador"), catch nos submits
- [x] **Forms** — autosave flush no unmount (não perde os últimos 500ms), `aviso`→`toast.warning`, editar-registro auto-colapsa, retroativo reseta ao fechar, `accept` restrito (pdf/png/jpg/webp — fora SVG/HEIC), "Baixar modelo" CSV, url required em material-link, "(em dupla)" no editar-dupla, erro de e-mail duplicado nomeia o campo, sonner 8s
- **Manual restante**: template do magic link no dashboard Supabase (PKCE prende o link ao navegador que pediu — se usar `{{ .ConfirmationURL }}`, considerar `{{ .TokenHash }}` ou código OTP pra fluxo in-app-browser)

## Sprint UX — auditoria de arquitetura da informação (set/2026) ✅ executada

Pesquisador gerou **`.devin/ux-checklist.md`** (64 checkpoints, 12 categorias — divulgação progressiva, Hick, carga cognitiva, Gestalt, hierarquia, affordance, pistas visuais, fricção, erros, mobile/touch, esforço, onboarding/empty states) e 8 fixers em paralelo aplicaram por tela. HIGHs resolvidos: **nudge do mentor apontava pro próprio WhatsApp** (gated por `!souMentor`); **detalhe-do-dia fora da viewport no mobile** (scrollIntoView ao selecionar por ponteiro — `e.detail` distingue toque de teclado, que mantém contexto); **ações enterradas em microcopy** ("Entrar na chamada"/"Material" promovidos a chips 44px, chamada vira lime na janela −15min/+2h; **múltiplos forms de registro inline** → `registro-inline.tsx`: 1 form aberto por vez, hash `#registrar-{id}` como fonte de verdade, deep-link e `RevelarApos` preservados).

Também entrou: stat-cards do dashboard viraram **filtros reais via URL** (`/?filtro=risco|atencao|pendentes`, `aria-current`, "Ver todas"); selects da NovaDupla ordenados por vagas/carga/disponibilidade (não alfabético); notas de efeito em Pausada/Encerrada/desativar/papel; `type="tel"` em todos os WhatsApp; toast de exclusão nomeia a entidade (`sucesso` prop no ConfirmDeleteButton, todos os callers); empty states com CTAs reais (dialogs embutidos); "em breve" vs "sem conteúdo" acionável em materiais + "Trocar arquivo" com restore em falha; RegistroForm em 3 `<details>` nomeados + `avaliacao` com validação inline `role="alert"`; `min` no datetime-local; segment control do login virou radios nativos + countdown de reenvio parseado do 429; skip-link, `aria-current`, live region enxuta na agenda, legenda dos dots perto do uso, `#encaminhamentos` âncora, skeleton com paridade de borda; copy bug: "Encerre a dupla antes de excluir" mentia vs guard do servidor.

**Registrado como débito consciente**: seleção do dia na agenda não persiste na URL (Suspense/SSR não-trivial); `chamadaAgora` é server-render (não vira lime sozinho com a aba aberta — revelação funcional segue no `RevelarApos`); assimetria coord-marca-`nao_aconteceu`-mas-não-registra mantida (decisão de modelo); "Registre aqui." ~20px da home = exceção inline WCAG documentada; `EditarRegistro` + form de criação podem coexistir (constraint cobre só criação); submit-sticky inviável (card `overflow-hidden` clipa).

## Sprint polish — identidade de papel + motion + declutter (set/2026) ✅ executada

Spec em **`.devin/polish-spec.md`** (128 linhas, produzida por idealizador; 4 implementadores paralelos + validador que corrigiu 4 pontos). Decisão central: **mentor = tinta do sistema** (lime colidiria com `--ok` e com a reserva pra ação), **mentorado = amarelo 48°** (`--role-mentorado` — o amarelo do ponto do logo, = `--chart-2`; violeta/esmeralda/âmbar-texto rejeitados em revisão). Regra final: **amarelo só como marcador** (dot `size-1.5` antes do nome, disco do avatar, label de parear) — nome de pessoa é sempre tinta do contexto, nunca cor de texto. `DuplaNomes` padroniza o lockup "X e Y" nos 5 lugares; `Avatar papel="mentorado"` tinge iniciais (mentorado não tem foto); dots de papel nos labels de parear.

**Motion** (lib `motion` 13.4 — `motion/react`): vocabulário em `src/components/motion.tsx` (`EASE`=`--ease-snappy`, `T.micro/enter/panel/pill` spring bounce:0, `fade`); `MotionConfig reducedMotion="user"` no root layout (guard CSS não cobre JS). Aplicado: pill `layoutId` no segment Link|Senha, crossfade form↔enviado + campo senha expandindo (`height:"auto"`), pills `nav-bottom`/`nav-side` deslizando entre rotas, crossfade do detalhe do dia na agenda, `RegistroInlinePanel` que cresce (autosave sobrevive: subtree fica montado até o fim do exit). CSS segue dono de hover/stagger/dialogs.

**Bugfixes do feedback**: banner ink do mentor-home não encostava no topo → `-mt-(--card-spacing)` cobre o `py` do Card + `pt-(--card-spacing)` devolve o respiro interno; avatar quebrava quando o `<img>` falhava antes da hidratação (onError nunca disparava) → `ref` callback checa `complete && naturalWidth===0` no mount.

**Anotações do mentor** (`0015` `encontro_notas` + `salvarNotaEncontro` + `nota-encontro.tsx`): plano de aula/lembretes por nº do encontro — chave `(dupla_id, numero)`, não FK de `encontros` (existe antes do agendar e segue o nº na remarcação). Autosave debounce 800ms + flush no blur, `<details>` nativo, preview da 1ª linha no summary. Na agenda: editor no bloco do encontro oficial (rotulado pelo mentorado se >1 dupla) + sob "Sua dupla" pra encontro remarcado fora do dia oficial. Na ficha: editor por `EncontroRow` (mentor ativa) / leitura pros demais com nota. Plano em `.devin/plan-agenda-notas.md`.

**Declutter**: zona de meta única em duplas-lista, "último lembrete" junto da ação (nudge→lembrete, termo em pt-BR), badge "pendências" consolidado, "sugerido" omitido em encontro realizado, supervisor→`text-xs`, card Mentorado ganhou o nome (estava ausente), overlines padronizadas. Validador corrigiu: foco no crossfade (ref callback no mount real — `mode="wait"` atrasa o alvo 150ms), "e" do lockup ilegível sobre ink (→`text-white/50`), h2 "Encontros" fora da gramática (→overline), `aria-hidden` em ícones. Débitos LOW: badge overflow residual em pessoas (4 badges/row possíveis), `transition-all` pré-existente em copiar-resumo, padding dentro do height-animado, deep-link `#registrar-*` anima no load, morph cosmético do pill ao remontar form, h1 do login `text-lg` (fora da escala — tela de marca).

## Sprint caça-redundância (set/2026) ✅ executada — agents com login real

3 auditores autenticados no dev server via cookie de sessão (`/tmp/realiza-dev-auth.sh` gera: login por senha de teste → cookie `sb-*-auth-token` base64) extraíram o texto renderizado e corrigiram. Destaques: **"sugerido {data}" ×16** → "datas sugeridas pelo guia" uma vez no rótulo da seção Encontros; **"Em dia/Em dia"** → `SemaforoBadge` suprime motivo idêntico ao rótulo; faixa "Esta semana" sem "2º encontro" duplicado e sem zeros forçados (plurais corrigidos); **palavra-tipo dos eventos da agenda** só renderiza quando o título não a carrega (`tipoDitoNoNome`); prefixo "Nº encontro ·" suprimido na linha do mês (fica em sr-only — o grupo já diz); fase do mês só aparece quando o mês inteiro é de uma fase; "Supervisor: {self}" suprimido na visão do supervisor; motivo=status deduplicado com o chip; badge "especialista" morto (o Select de papel já diz); "Sem dupla · N livres" → "Sem dupla · N"; "E-mail (login por link de acesso)" → "E-mail"; subtítulo de materiais trocou enumeração por função.

**Bug encontrado pela auditoria — Select.Value cru**: Base UI renderiza o `value` quando o Root não tem `items` — a página mostrava `mentor_especialista`/`coordenacao` crus e **UUIDs** nos selects de parear. Fix: `items={Record<valor,label>}` em todos os Selects (13 arquivos: agents nos deles, eu em editar-dupla/nova-dupla/agendar/registro-form/retroativo). Convenção nova: **todo `<Select>` leva `items`** — registrado na spec.

## Sprint perfis internos — "rede social" controlada (set/2026) ✅ implementada

**`/pessoas/[id]`** — página de perfil interna que resolve `profiles` OU `mentorados` pelo id (`getPessoaPerfil`): avatar grande (foto → Gravatar → iniciais), papel/status, chips de contato (wa.me + mailto), lista de duplas linkadas e **mural de notas**. Acesso: coord/supervisor abrem qualquer perfil; **mentor abre só o mentorado da própria dupla** — `pessoa_notas` RLS limita leitura/escrita ao vínculo (inclusive dupla encerrada) e `mentorados` RLS retorna null fora dele → 404 natural; perfil de staff pra mentor → `notFound()` explícito; o próprio perfil redireciona pra `/perfil`. Entradas: nomes viram links em `/pessoas` (com avatar 32px na row — foto ou iniciais) e no card Mentorado da ficha; `VoltarLink` volta no histórico quando a origem é interna (coord vem de /pessoas, mentor da dupla), senão cai no fallback por papel.

**`pessoa_notas`** (`0016` + **`0017` privada do autor**): mural por pessoa — `num_nonnulls(profile_id, mentorado_id)=1`, texto ≤10k, `created_by` FK. RLS: **select/delete só do próprio `created_by`** (caderneta privada — decisão do Thiago; a visão colaborativa de `0016` morreu); insert escopado (staff em qualquer mural, mentor só no do mentorado da própria dupla — a nota nasce visível só pra quem escreveu); sem update (imutáveis). `addPessoaNota`/`deletePessoaNota` devolvem `{error}` e o `.select("id")` pós-write detecta bloqueio silencioso de policy. Feed sem autor (toda nota visível é sua), mais recente primeiro; composer só pra quem pode anotar.

**Foto no cadastro** — `FotoField` (preview circular via object URL revogada, `accept` PNG/JPG/WebP, toast se >2MB) em NovaPessoa, NovoMentorado e nos dialogs de edição (PessoaActions/MentoradoActions, com a foto atual de preview). Upload **server-side dentro da action** (`subirFoto` em actions.ts): o FormData leva o File, o insert cria o id, a foto sobe pra `avatares/<id>/<uuid>.<ext>` e o path é persistido — falha de upload não derruba o cadastro, vira `aviso`→`toast.warning`. Na edição, foto nova remove a antiga do bucket. `mentorados.avatar_path` criado; policy `avatares_coord_write` deixa a coordenação escrever em qualquer pasta (a pasta-por-usuário de `0014` segue pro self-upload do /perfil). Avatar do mentorado no h1 da ficha agora usa a foto quando existe.

**Bug encontrado em teste**: `papelLabel` morava em `app-shell` ("use client") — importar função de módulo client em server component quebra o render (a página de staff dava 404). Movida pra `lib/ciclo.ts` junto dos outros maps de label; regra: **helper compartilhado nunca exporta de arquivo "use client"**.

## Sprint agenda zero-fricção + mural privado (set/2026) ✅ implementada

Planos em `.devin/plan-mural-perfil.md` + `.devin/plan-agenda-zero-friccao.md`. Gatilho: o erro "use 'Registrar encontro'" apontava pra um controle que não existia na agenda (só "Registrar passado" na ficha).

**Mural vira caderneta** — sem botão "Publicar": rascunho em `localStorage` (`mural-nota:{pessoaId}`, restaurado no lazy-init com `suppressHydrationWarning`), publica no blur/Enter/unmount (best-effort — se a aba fechar, o rascunho sobrevive), Shift+Enter quebra linha, Esc limpa. Falha mantém o rascunho; sucesso limpa campo+storage só se o texto ainda é o publicado (digitação durante o voo não se perde). Hint "Só você vê suas notas aqui". Refactor pós-lint: refs atualizados em effect (react-hooks/refs proíbe escrita no render).

**Avatar clicável** — um `<Link>` único englobando avatar+nome+meta nas listas (tabstop único) e os avatares sobrepostos do h1 da ficha viram links pros respectivos perfis.

**`alvoAgendamento(dupla, eventos)`** em `ciclo.ts` — derivação única de `proximoNumero`/`encontroAlvo`/`sugeridoProximo`/`faltantes`/`cicloCompleto` (era copiada em ficha, mentor-home e agenda; `EncontroFaltante` moveu do dialog pra cá).

**Dialog dual-mode** (`AgendarEncontroDialog`): encontro novo com data passada → `registrarEncontroRetroativo` + navega pro `#registrar-{id}` (mesma coreografia do retroativo: scrollTarget + `realiza:hash`); campos origem/link escondem no modo retroativo; submit vira "Registrar encontro"; `min` removido pra novo (fica só na remarcação); prop `trigger` injetável. Em remarcação o passado segue proibido — erro bifurcado no server aponta o controle certo por contexto ("ficha da dupla ou agenda do dia").

**Agenda com CTA contextual** (`AcaoDiaMentor`, só mentor com dupla ativa — coord/sup monitoram, não agendam): dia oficial futuro sem row → "Agendar"; oficial passado sem row → "Registrar" com nº+data pré-selecionados (`numeroInicial`/`quandoPadrao` novos no `RegistrarRetroativoDialog`); row agendada → "Remarcar"; dia qualquer → mesmo critério pro próximo pendente (passado oferece retroativo com o dia como "quando foi"; `proximoNumero` entra nas opções mesmo sem ser oficial vencido). Realizado sem registro não ganha CTA — a linha "Sua dupla" já linka `#registrar-`.

**`?dia=YYYY-MM-DD`** deep-link na agenda (mês+seleção iniciais; fora da janela do ciclo → fallback na heurística antiga). `revalidatePath("/agenda")` nas 5 actions de encontro (dots/status não ficam mais velhos).

**Pendente**: teste ao vivo como mentor (senha de teste do thixaraujo ≠ senha123) — fluxo de mentor verificado por leitura + coord confirmou ausência de CTAs.

# Pendências

## Gestão/domínio — pequenos, alto retorno

- [x] ~~**Encaminhamento editável/apagável**~~ — menu ⋯ por item (Editar em dialog / Excluir com confirm). Só o mentor edita/apaga; coord mantém o toggle feito/pendente (correção operacional, não reescrita do acordo).
- [x] ~~**"Meu perfil"**~~ — `/perfil` com foto (upload → Gravatar do e-mail → iniciais), nome/WhatsApp self-edit e troca de senha. `0014`: `profiles.avatar_path` + bucket público `avatares` (pasta `<profile_id>/`). Avatar aparece no shell (sidebar/topbar) e no header da dupla. ✅ sprint perfis: avatar nas rows de /pessoas, `mentorados.avatar_path` + foto opcional no cadastro/edição.
- [x] ~~**`duplas.ciclo` com default fixo**~~ — seletor nos dois dialogs (`cicloVigente`/`ciclosOpcoes` em ciclo.ts, default = vigente).
- [x] ~~**Desativar mentor com dupla ativa**~~ — o confirm nomeia o impacto ("tem N dupla(s) ativa(s) — vão ficar sem mentor") com label "Desativar" no botão.
- [ ] **"Sem papel" em pessoa com dupla**: dupla continua listando ela como mentor — aviso. (Mitigado: `setPessoaRole` trava papel de quem tem dupla ativa/pausada; resta o caso do papel já removido antes do guard.)
- [ ] **Statuses mortos**: `remarcado`/`cancelado`/`atrasado` — implementar ou remover do enum. `duracao_min` ✅ persistido (whitelist no `salvarRegistro` + prefill na edição).
- [x] ~~**`materiais.ordem`**~~ — persistida no `editarMaterial` (edição de metadados implementada no MaterialActions).
- [x] ~~**Ordenação case-insensitive**~~ — `localeCompare pt-BR` em pessoas e nos selects de parear.
- [x] ~~**Trigger no banco**~~ — `0043`: `encontros_status_guard` barra saída de `realizado` (TOCTOU fechado).
- [x] ~~**Supervisor em `/duplas`**~~ — usa `getMinhasDuplas()` (RLS no banco, não filtro JS).
- [~] **`queries.ts`**: `as unknown as Dupla[]` → `supabase gen types`. `src/lib/database.types.ts` gerado do remoto (2256 linhas, schema vivo); adoção gradual nos casts — os tipos locais são hand-narrowed com embeds.
- [ ] **Kit UI residual**: `material-actions.tsx` (1 uso) → inline. (Resto removido; `skeleton.tsx` agora usado pelo `loading.tsx`.)
- [x] ~~**`sonner` `richColors`**~~ — verificado: `sonner.tsx` já mapeia `--success/--error/--warning` pros tokens `--ok`/`--warn`/`--danger`. Nada a fazer.
- [x] ~~**`importar-csv-dialog`**~~ — input reseta (`value=""`), leitura `arrayBuffer()` com fallback UTF-8→Win-1252 + catch pt-BR.
- [x] ~~**`NovaDuplaDialog`/`EditarDuplaDialog`**~~ — skeleton no 1º load, erro honesto com retry, refetch falho → toast sem bloquear.
- [ ] **Padronizar import de `cn`** (`@/lib/utils` vs `cn` direto em ui/*).
- [x] ~~**Pessoas com só dupla encerrada**~~ — `temQualquerDupla` desabilita o excluir com nota explicativa; "Sem dupla ativa" com menção ao histórico.
- [ ] **wa.me diretos na página da dupla** ("Falar com mentorado", "Enviar combinados") não passam por `/api/nudge` → não logam em `interacoes`. Decidir se contato do mentor entra no log (hoje só nudges de coord/supervisor via NudgeButton).
- [x] ~~**`me()` em actions.ts**~~ — 58 call sites com early-return "Sessão expirada" (auditoria completa).
- [ ] **Refactor de complexidade** (react-doctor): `duplas/[id]/page.tsx` e `registro-form.tsx` estão grandes — candidatos a split quando a próxima feature tocar neles.
- [x] ~~**Anexos**: teste E2E~~ — RLS provado contra o remoto; **e** `deleteDupla` remove os objetos do bucket antes da row (sem órfãos em `registro-anexos`).

## Decisões de produto — maiores

- [x] ~~**Trilha especialista — restos**~~ — `0037`: encerramento antecipado, prazo de 3 meses (chip urgente/vencido) e devolutiva notificando o mentor DPP.
- [x] ~~Materiais de verdade~~ — `0010`: `materiais.path` + bucket privado `materiais` (policies de storage espelham a audiência — coord lê tudo, trilha só a própria, supervisor só "todos"); upload no `NovoMaterialDialog` (toggle arquivo/link, 20MB, PDF/imagem) e "Anexar arquivo" no `MaterialActions`; `/api/material/[id]` → signed URL 300s; card de encontro na página da dupla abre o arquivo.
- [ ] **PDM da dupla**: `duplas.pdm_url` (link Drive/Docs) ou storage por dupla.

## Produção

- [ ] **SMTP do magic link — trocar sender provisório → realiza.vc.** Situação: rate limit do SMTP embutido do Supabase contornado com Resend SMTP (`smtp.resend.com:465`, user `resend`) — sender provisório `@thisux.tech` (domínio pessoal verificado, sa-east-1), API key `realiza-smtp-supabase` (sending_access, scopada ao domínio, id `e4f8d7c4`). Passo final: `realiza.vc` está registrado **numa outra conta Resend** (id `9707ed4e`, `not_started`) — entrar naquela conta no resend.com, deletar o domínio pra liberar, recriar aqui (`create-domain` → DNS → `verify-domain`) → nova API key scopada → trocar sender pra `no-reply@realiza.vc` no Supabase Auth → SMTP + `SITE_URL`/redirects de prod.
- [x] ~~Remover login por senha~~ — virou feature: primeiro acesso via magic link cai em `/auth/definir-senha` (flag `user_metadata.senha_em`), depois a pessoa entra por senha **ou** link. Resta só garantir que contas de teste não fiquem com senha fraca compartilhada (`senha123`).
- [x] ~~Signup aberto → convite/allowlist~~ — `0045`: trigger em `auth.users` exige e-mail pré-cadastrado em `profiles` (signup público E `admin.createUser` — dentro do GoTrue são indistinguíveis; SQL direto/migrações bypassam). **Coordenação precisa pré-cadastrar antes de convidar** — magic link de e-mail novo falha com mensagem pt-BR.
- [x] ~~Deploy Vercel~~ — `https://realizavc.vercel.app` no ar (projeto `thisux1s-projects/realiza.vc`, repo `thisux1/realiza.vc` conectado — push na main já dispara redeploy). Envs de prod: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (todas Config/exposed). **Falta no dashboard Supabase** (não dá via MCP): Auth → URL Configuration — Site URL `https://realizavc.vercel.app` + Redirect URLs `https://realizavc.vercel.app/**` (sem isso o magic link de prod não confirma) e o SMTP da tarefa acima.
- [ ] E-mail pra coordenação quando `precisa_apoio = true` (após Resend).
- [x] ~~Export CSV de pessoas/mentorados~~ — `/api/export?tipo=pessoas` coord-only, agora com bloco sensível (nascimento/gênero/pref/motivação) via views `*_pessoal`.
- [x] ~~`middleware`→`proxy`~~ — feito (build reconhece `ƒ Proxy`).

## Qualidade

- [x] ~~Vitest~~ — `vitest@5.0.0`, `pnpm test`: **136 testes** cobrindo `saudadeDaDupla`, agendamento, jornada, formatação, `parseCsv`/`normWhatsapp`/`mapRole`, encerramento, forms schema, documentos. `vitest.config.mts` com `TZ=America/Sao_Paulo` fixo. Bônus: `erroAmigavel` desduplicado (6 cópias → `utils.ts`) e `emailValido` agora aceita domínio multi-label (`@empresa.com.br`).

## Notificações in-app + avisos (feito)

Migrations `0018` + `0019` aplicadas via Management API (o `db push` diverge do
histórico remoto: 17 versões timestamped aplicadas pelo MCP não existem como
arquivos locais — reconciliar algum dia com `db pull` ou repair). Auditoria em
4 frentes + correções: href não aceita mais `//externo`, insert por não-coord
restrito ao fluxo de pedido de apoio, UPDATE só mexe em `lida_em`, delete pra
coord, audiência `equipe` (coord+supervisores), `'todos'` não vaza pra anon.
Coord bloqueada nas actions de agenda/registro/nota — a regra "a dupla agenda"
vale no contrato, não só na UI. Smoke test E2E das policies passou no remoto.

Pendente só de UX real: primeira publicação de aviso pela coord no app e olhar
o painel do sino no browser (abrir, marcar lida, mobile).

## Sprint leitura de registros + evidência do mentor (set/2026)

**Evidência é escrita do mentor** — `0020`: `registro_anexos` INSERT e storage
INSERT ficaram mentor-only (coord perdeu o "Anexar evidência" que aparecia na
ficha); coord mantém SELECT (acompanha) e DELETE (moderação). UI dividida:
`podeAnexar` (mentor) vs `podeRemover` (mentor+coord) no `AnexosRegistro`.
Foco com contraste real: `--ring` era o lime 53% (~1.9:1 no branco) → 38% (~4:1).

**`/registros`** (coord + supervisor, nav "Registros") — resposta a "uma página
pra ver tudo que os mentores responderam no form": cards agrupados por nº de
encontro (desc), chips de triagem clicáveis (apoio em aberto / avaliação baixa /
dificuldade — contagens globais do papel), filtros server-side por searchParams
(encontro, avaliação, dificuldade+`com`, dupla, busca em tema/reflexões/obs),
`<details>` com o `RegistroView` completo + `ResolverApoioButton` inline,
stretched-link pra `duplas/[id]#registrar-{encontro}`, paginação acumulativa
`?pagina=` (100/página, grupos nunca quebram). RLS faz o escopo — supervisor
vê só as suas. Entrada contextual: "Ver registros →" na faixa "Esta semana"
do dashboard (já filtrada no encontro corrente).

**"Detalhes do encontro" na agenda** — pra coord/sup a linha da dupla no
detalhe do dia virou botão que abre modal (`EncontroDetalheDialog`): status,
meta (agendado/realizado/remarcação), sugestão do guia, plano do mentor
(read-only), `RegistroView` completo, combinados gerados por aquele registro,
anexos lazy-fetch (`registro_anexos` via RLS de select), `ResolverApoioButton`
pra coord, "Abrir na ficha" no rodapé. `RegistroView` extraído da ficha —
display do registro vive num componente só.

**Dupla especialista bloqueada** — `createDupla`/`updateDupla` rejeitavam
`mentor_especialista` e os selects de mentor marcavam "trilha especialista (em
breve)": criar produzia calendário/semáforo errados silenciosos (trilha de 5
encontros não modelada). `setPessoaRole` também trava: trocar papel de quem
tem dupla ativa/pausada deixava escrita indevida via `mentor_id` nas policies.
*(Superado — a trilha foi modelada na `0027`+ e o bloqueio caiu: `createDupla`
deriva `trilha` do papel do mentor. O que resta está na seção Pendências.)*

**Auditoria pós-diff — abertos (decisão):**
- Policies `*_mentor_write` de `encontros`/`registros`/`encaminhamentos`/
  `encontro_notas` seguem `for all` + coord — "largas pra correções", mas a
  0020 endureceu anexos na RLS: postura inconsistente. Apertar exige trigger
  por coluna (coord escreve `precisa_apoio`, status de encontro, toggle de
  combinado — write parcial legítimo).
- Objetos órfãos no bucket `registro-anexos`: cascade de `deleteDupla` apaga
  rows, não os arquivos — e a storage-delete exige a row existir, então o
  objeto vira indeletável por policy. Cleanup via trigger ou no deleteDupla.

**Pós-review UX (`7aaad1b` corrigiu os médios) — baixos deferidos:**
- Bottom nav mobile com 6 tabs pra coord ("Registros" ~60px em 360px) —
  conferir visualmente em device real; se apertar, agrupar em "Mais".
- `EncontroDetalheDialog` quase vazio pra encontro sem reg/nota/evento/link
  (badge + link só) — estado legítimo; se incomodar, listar "o que falta".
- `STATUS_LABEL` duplicado (dialog vs `STATUS_ENCONTRO_LABEL` da agenda) —
  unificar na próxima vez que tocar ali.
- Teste real em device: iOS/Safari + VoiceOver (sino, wizard modal, `<details>`
  dos registros) — tudo conferido por leitura, não por uso.

**Auditoria de segurança (set/2026) — 0023/0024/0025/0026 aplicadas; deferido:**
- ~~`profiles_select` "autenticado lê tudo"~~ — **resolvido na `0026`**:
  grant de coluna (`id, user_id, nome, role, ativo, avatar_path, created_at`)
  + view `profiles_contato` (definer) escopada por papel — coord vê tudo com
  `documento_path`, supervisor vê os mentores das duplas ativas/pausadas que
  supervisiona, qualquer um vê a própria linha. `documento_path` sai null via
  CASE pra não-coord. Policies `documentos_storage_*` recriadas lendo a view
  (subconsultavam a coluna revogada). Queries mergeam contato por id via
  `getContatos()`/`comContato()` em `queries.ts`; testado com JWT real —
  `select=email` em `profiles` dá 403 pra mentor e coord (grant é por DB role,
  a view é o caminho).
- Policies `for all` remanescentes (fora anexos, já endurecidos): os triggers
  de autoria da 0023 cobrem a parte de autoria; o restante (colunas de status)
  exige trigger por coluna ou RPCs dedicadas.
