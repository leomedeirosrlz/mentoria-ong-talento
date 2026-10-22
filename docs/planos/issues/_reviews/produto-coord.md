# Review consolidada — persona produto-coord (87 pastas)

62 APROVADO · 25 COM-AJUSTES · 0 REPROVADO. Os "com-ajustes" são quase todos
decisões de produto/jurídico do Thiago já declaradas como BLOCKER — não falhas
de plano. Texto completo do reviewer transcrito da sessão (saída verbatim do
agente d50526fb); resumo por issue abaixo.

## COM-AJUSTES — o que falta em cada uma

- **16** — BLOCKER "links genéricos necessários?" vira ação externa explícita; aceite central (histórico migra com conta) merece spec e2e real.
- **22** — "repôr" sidestepado: exigir sweep de vocabulário (grep remarcar/reagendar/reposição) ou registrar decisão; confirmar `⋯Mais` some quando vazio.
- **28** — FEITO, mas confirmar que popup deixa corrigir o nº (ressalva do próprio Jira).
- **32** — BLOCKER turma-inteira×designadas é decisão do Thiago (alarga leitura do auxiliar a todas as duplas da turma — menores no escopo).
- **39** — issue ausente do `_issues.json`: confirmar texto no Jira antes de implementar; copy do chip deve deixar claro "pessoas em +1 turma".
- **51** — BLOCKER real: e-mail vai pro jovem ou pro mentor repassar? Depende da cobertura real de `mentorados.email`; canal fica inerte até `EMAIL_ENVIO_LIBERADO`.
- **62** — bug literal morto: entrega = convenção escrita; fechar como "verificado" com evidência do sweep + confirmar a superfície original com a coord.
- **64** — evidência só cobre `/f`: sweep `/assinar`+`/avaliar`+copy de expiração antes de fechar.
- **69** — confirmar colunas reais de `mentorados` (whatsapp pode ser do responsável) no mapeamento da promoção.
- **70** — BLOCKER: grid de disponibilidade aparece 2× no form oficial? Resolver com Thiago antes do seed.
- **71** — registrar decisão: série completa por-encontro só coord/sup/jovem; mentor vê quantizado+média.
- **138** — BLOCKER A×B (mockups navegáveis × modos reais paralelos); recomendação A; marcar remoção de `public/mockups/` ao fim da validação.
- **143** — depende de variante de mockup; fallback seguro = grade 2-col por quadrante.
- **157** — exigir repro/screenshot do bug visual antes do PR (causa proposta plausível, não provada).
- **159** — BLOCKER: `desistente` elegível? Plano assume só `concluido`.
- **172** — itens 6-7 "a verificar": confirmar causa-raiz antes de marcar fechado; item 1 (`atribuido_nome`) — decidir exibir ou remover query.

## Vereditos APROVADO — notas-chave (o resto é "evidência correta, fechar Jira")

- **FEITO → fechar Jira**: 15, 19, 27, 30, 31, 38, 40, 46, 61, 63, 72, 96(dupe 21), 97(dupe 22), 99-103, 137, 140, 141, 142, 147, 152-154, 162, 17, 124-126 (absorvidas).
- **20** — decisão certa: evoluir `formulario_links` sem tabela paralela; ciclo devolução alinhado com 67.
- **21** — checklist `(dupla,numero)` sobrevive remarcação; sugerir cap/rótulo no carry-over (>4 encontros vira ruído).
- **26** — trigger AFTER INS/UPD/DEL cobre os 3 caminhos; `encontro_reagendamentos` chaveado por numero.
- **33** — escopo B: inventário auditado + revisão jurídica do termo (peça mais frágil — `texto.ts:100-103` rascunho sem fonte oficial) + retenção escrita.
- **34** — builder como tela de revisão de graça; Gemini fallback com confiança; imagem cortada honestamente.
- **35** — identidade via sessionStorage (zero leak em URL); `solicitar_acesso` RPC; DNS=ops Thiago.
- **36** — 4 tipos; sanitizer server recalcula `visible_if`; grid Seg–Sex 09–20h verbatim (confirmar sáb/dom com coord).
- **37** — ViaCEP server-side; autofill nunca trava nem sobrescreve edição.
- **42** — decisão registrada (178/179/180 respondem); fechar.
- **47** — backfill cria turma "planejada" pra label divergente (não falha) + auditoria visível.
- **49** — grade = reuso RelatorioCanvas; e2e deve comparar célula-a-célula.
- **52** — metade sem LLM já entrega valor; narrativa gated (flag+jurídico); score nunca em coluna pública.
- **53** — Shared Drive org é a única opção estrutural.
- **54** — `ArquivoDaDupla` union anexo|pdm; audiência herda do card Instrumentos.
- **56** — dashboards com motivos visíveis; "remarcações" admite limitação no rodapé.
- **65** — gatilho ≥70% do GB; medir uso atual é o passo zero.
- **66** — canvas→webp fail-open pro original; zero lib nova.
- **67** — devolução "reabrir pra ajuste" no MVP, alinhado com 20.
- **68** — `encontros`=alias de `ciclo`; atividades explodidas; matching/presencas novos; matching sem sensíveis.
- **73** — contexto `?turma=`+cookie propagado; "Todas" óbvio.
- **98** — self-FK `dupla_dpp_id`: rematch para de perder linhagem DPP→esp (`0105:318-326` não carrega hoje); migração **0106** (0063 já ocupada).
- **144** — wizard por seção; etapas `hidden` preservam FormData; rascunho segue status quo até a 20.
- **166** — e2e-app push+PR+nightly vs staging; required check FALHA (não skipa) sem secrets.
- **167** — `relatorio_links` já nasce com o nome da 170; v1 inscrições via SQL.
- **168** — regra explícita no PR: registro nativo do mentor nunca pisado pelo import; piloto 1-2 mentores.
- **169** — Vercel Cron + ledger `trilha_lembretes`; sem auto-close.
- **170** — bcrypt pgcrypto + rate limit via `resumo_acessos` + revogação + cookie httpOnly path-scoped; `tipo=respostas` fora do público v1; seed T2 `senha_hash=null`.
- **173-177** — vereditos APROVADO: hub-por-encontro/cobertura (173), densidade nas visões não-coord + footers mortos (174), `?grupo=` server-side + modal right-sized (175), fila operacional no topo + gráficos na linguagem da casa (176), escala semântica 4 larguras + inventário real 51 dialogs (177).
- **178** — ondas exports→hub→digest→narrativa-gated; digest com primeiro nome de menor — validar template; `vercel.json` vs Ignored Build Step verificar.
- **179** — um registry/dois transportes; MCP auth: PAT `rlz_` ou JWT→`generateLink`+`verifyOtp` minta sessão real com RLS; BLOCKER provider DPA/retenção-zero.
- **180** — determinístico sempre primeiro; semântico nunca promove a `auto`; escrita só via RPC; BLOCKER doc-inteiro→provider (pode conter texto livre de menores).
- **181** — `pdm_itens` recursivo único servindo Metas+PDM; co-edição mentor+/jovem/pdm; respostas antigas = snapshot intacto; `revisao_pdm` segue manual.
- **182** — Vercel Cron `/api/jobs/`; backfill com `fonte='backfill'` honesto (não é snapshot real).
- **183** — IP hasheado com salt; só loga slug válido; append-only.

## Falhas transversais

1. **Decisões pendentes do Thiago** (BLOCKERs reais): 32, 51, 62, 70, 138, 159 + tier C (33/53/65/67) + jurídico IA (52/178/179/180 DPA+retenção-zero).
2. **Ausentes do `_issues.json`**: 39, 40 — escopo reconstruído; confirmar texto Jira.
3. **Verificações antes de fechar FEITO**: 27, 28, 64, 153, 162.
4. **Convergências boas**: Vercel Cron p/ 169/182/168; devolução 20↔67; absorções mapeadas com aceites cruzados.
5. **Copy pt-BR consistente** em voz do papel certo; nenhum critério de aceite vago encontrado no set.
