# Alinhamento final — plataforma × documentos do programa

Síntese do cruzamento entre os documentos-fonte (`docs/fontes/`) e o estado atual do código.
Gerado por 4 auditorias paralelas (DPP, Especialista, Matching/Forms, Operações/Termos).
**As decisões D1–D10 foram tomadas (Thiago, set/2026) e o plano de `docs/plano-implementacao.md` foi executado: matching (0034/0038), forms engine (0036), encerramento/especialista (0037), títulos oficiais (0035) e assinaturas (0033) estão aplicados no remoto. As pendências restantes estão na seção final.**

## Fontes vigentes

| Doc | Arquivo | Papel |
|---|---|---|
| Guia Mentor DPP (versão nova, Erlich/Top2You) | `guia-dpp-pdf.txt` / `guia-dpp-docx.txt` | normativo DPP |
| Guia Mentor Especialista (versão nova) | `guia-especialista-pdf.txt` / `guia-especialista-docx.txt` | normativo especialista |
| "Novo programa" (versão ANTIGA, 2025/2, Atados) | `novo-programa-dpp.txt` / `novo-programa-especialista.txt` | referência — diverge do vigente em pontos listados abaixo |
| Termo de Adesão de Voluntário | `termo-adesao-voluntario.txt` | contrato por pessoa |
| Forms Brasil Participativo (só perguntas) | `brasil-participativo-forms.txt` | referência de matching |
| Comparativos | `base-comparativa-*`, `plataforma-juventude-solidaria.txt` | benchmark |

## Estado geral

**A espinha dorsal está conforme.** Os 16 `ciclo_eventos` reproduzem o guia novo (6 fases, mesma distribuição 4+3+2+2+3+2, instrumentos por encontro fiéis). O registro semanal cobre os 5 campos do guia e vai além (avaliação, dificuldade, próximo passo, apoio — que alimentam o semáforo). Semáforo, nudges com log, comunicados, escopo de supervisor via RLS, trilha especialista com demanda→mural→aceite atômico: tudo funcionando.

**As lacunas se concentram em 4 blocos:**
1. **Fechamento do ciclo** — relatório final, avaliação 360º, avaliação pelo mentorado, checklist de encerramento/renovação, autoavaliação do mentor: nada existe.
2. **Dados civis + assinatura** — o termo exige nome civil, RG, CPF, endereço; `profiles` tem só nome/email/whatsapp. `termo_ok` é checkbox manual sem evidência.
3. **Matching por afinidade** — o guia manda curadoria por hobbies/valores/trajetória/preferência de gênero/disponibilidade; a plataforma não guarda nenhum desses insumos.
4. **Rituais institucionais** — anamnese estruturada, encontro de abertura, presença em formação, sessões de supervisão.

## Decisões editoriais necessárias (doc × doc ou doc × código)

| # | Tema | Em disputa | Decisão que falta |
|---|---|---|---|
| D1 | Cadência do ciclo | Guia: 6 meses · seed: semanal ~4 meses (cronograma Juventude Solidária) | ✅ Resolvido — cronograma oficial do ciclo (doc "Plataforma Juventude Solidária"): semanal em 13 dos 15 intervalos, **15 dias entre o 8º e o 9º encontro** (tempo de prática das submetas), recesso na virada da Fase 5→6. Total 30/jul→15/jan (~5,5 meses; mentoria ativa 4 meses e 1 semana). Seed e demo espelham 1:1; datas do `ciclo_eventos` remoto já coincidem. "Mês" do guia = fase |
| D2 | Avaliações | Guia novo: avaliação por sessão (mentor+mentorado) + 360º única no fim · Doc antigo: avaliações de relação nos meses 1/3/6 + grupos de discussão | ✅ Resolvido — guia novo (sessão + 360º única no fim) |
| D3 | EaD | Antigo: obrigatório 5h30 · Novo: opcional | ✅ Resolvido — opcional, não interfere no sistema; nada a modelar |
| D4 | Idade do mentorado | Guias: ≥18 anos · Código: `mentorados.documento_path` rotulado "autorização do responsável" (implica menor) | ✅ Resolvido — menores admitidos (raros, mentor ou mentorado): contrato do responsável via assinatura tokenizada + aviso "<18" na ficha e no matching |
| D5 | Canal do mentorado | Guias pedem avaliação por sessão, pedido de especialista e 360º pelo jovem · mentorado não tem login | ✅ Resolvido — sem login; forms engine nativa com links individuais por token (`/f/[token]`). Avaliação por sessão roda em outra plataforma por ora (fora de escopo aqui) |
| D6 | Origem do pedido de especialista | PDF: mentor DPP **ou o jovem** pela plataforma · hoje só mentor/coord criam | ✅ Resolvido — mentor ou coordenação (como implementado); jovem não pede |
| D7 | Relatório final — audiência | Antigo: só pro mentorado · Novo: mentorado **e** coordenação | ✅ Resolvido — guia novo: mentorado + coordenação (resumo da jornada print-friendly chega ao jovem pelo mentor/coord) |
| D8 | Plataforma × Top2You | Guia descreve mentoria.realiza.vc como plataforma oficial de agendamento/avaliação; nosso app aceita `origem='externo'` | ✅ Resolvido — somos a plataforma nova independente; `origem='externo'` só registra legados importados |
| D9 | E-mail de contato | Guias: `mentoria@realiza.vc` · app: `contato@realiza.vc` (footer + privacidade) | ✅ Resolvido — `mentoria@realiza.vc` |
| D10 | Roda da Vida | Inconsistência interna do próprio guia: cap.7 diz "início do sexto mês", cronograma põe nos encontros 12–14 (5º mês) | ✅ Resolvido — 5º mês (encontros 12–14), como o seed |

## Correções pequenas (quase bugs)

| Item | Evidência |
|---|---|
| Seed inverte encontros 8↔9 do guia (revisão de meio de percurso é o 9º; "transferência de condução" é o 8º "monitoramento e responsabilidade") | `seed.sql` vs `guia-dpp` §10 |
| Título do 10º mistura "rede de apoio" (que é do 11º) | idem |
| `encontros.duracao_min` existe mas nunca é coletado (sempre 60) | `registro-form.tsx` |
| `Notificacao.tipo` não inclui os 4 tipos do fluxo especialista → ícone genérico | `types.ts`, `notificacoes.tsx` |
| Export CSV sem coluna `trilha` — registro de especialista indistinguível de DPP | `api/export/route.ts` |
| Especialista sem dupla vê agenda/banner de terças DPP (`soEspecialista` exige dupla>0) | `agenda/page.tsx`, `mentor-home.tsx` |
| Ficha DPP mostra chip da solicitação mas não a devolutiva da trilha especialista encerrada | `solicitacao-status-chip.tsx` |
| 10 materiais do seed sem `path`/`url` → todos "em breve"; falta row "Avaliação 360º" e doc "Perguntas Eficazes" | `seed.sql` |
| AGENTS.md/BACKLOG desatualizados: trilha especialista **já está modelada** (0027) — o aviso "cai num ciclo de 16" é obsoleto | AGENTS.md, BACKLOG.md |

## Propostas priorizadas

### P0 — decisões de produto (destravam o resto)
1. **Canal do mentorado** (D5): a decisão mais estrutural. Sem ela, avaliação bilateral, 360º pelo jovem, pedido de especialista e autorização ficam fora.
2. **Assinatura nativa do termo** (conversa anterior + auditoria): campos civis (`nome_civil`, `cpf`, `rg`, `data_nascimento`, `endereco`) + tabela `assinaturas` (versão do documento, status, evidência hash/IP/UA, pdf_path). `termo_ok` vira derivado de `assinaturas.status='assinado'`. `data_nascimento` também resolve a validação de idade (D4).
3. **Encerramento completo**: `encerramentos` (checklist: feedback final, feedback mútuo, revisão PDM/RdV, 360º, decisão encerrar/renovar) + autoavaliação do mentor + disponibilidade pro próximo ciclo.

### P1 — alto valor, baixo risco
4. **Campos de matching/afinidade** em `profiles` e `mentorados`: `nome_social`, `data_nascimento`, `genero`, `cidade/uf`, `interesses`, `motivacao`, `pref_genero_par`, `disponibilidade` (dias×períodos, não hora a hora), `cargo/empresa`, `experiencia_previa`, `origem`. Perguntas prontas na auditoria C.
5. **Consentimento LGPD digital**: `consentiu_em` + versão — no onboarding ou no ato da assinatura.
6. **Relatório final**: visão compilada/print da ficha da dupla (registros + trajetória + marcos) — barato, dá ao mentor a base do relatório sem feature pesada.
7. **Encerramento antecipado da trilha especialista** + prazo de 3 meses visível + `devolutiva_pdm` pro mentor DPP (fecha o loop que hoje termina em chip morto).
8. **Correções pequenas** da tabela acima (títulos do seed, duracao_min, tipos de notificação, CSV com trilha, materiais "em breve", fix de docs).

### P2 — estrutural, avaliar demanda real
9. **Form público de inscrição** (`/inscricao` → `inscricoes` → triagem → promove a profile/mentorado). Trade-offs: spam/abuse, uploads anônimos frágeis, LGPD no ato. Alternativa intermediária: form público só com dados de matching, documentos seguem manuais.
10. **Anamnese Social estruturada** (`anamneses` jsonb, coord-only) em vez de `mentorados.notas` livre.
11. **Presença em formação** (`formacao_presencas`) em vez de `formacao_ok` booleano; sessões de supervisão como `interacoes` tipo `apoio` registráveis.
12. **Visão por `ong_origem`** + métricas de ciclo pro relatório institucional.
13. **Mural de especialistas com match de área** (catálogo fechado de áreas, ordenação por afinidade).

### Deliberadamente fora (não construir)
- PDM e Roda da Vida como dados estruturados — o guia os define como documentos de trabalho da dupla, fora da plataforma.
- Avaliação 360º hospedada — o guia a define como formulário enviado pela coordenação; basta material/link.
- Conteúdo/dinâmica do encontro, grupos de troca, EaD — vivem fora (guia, WhatsApp, ead.realiza.vc).
- Matching algorítmico — curadoria humana é decisão registrada.
- Dados bancários/renda/estado civil do form BP — o programa é voluntariado puro, sem bolsa.
