# Plano de implementação — alinhamento final

Plano detalhado derivado de `docs/alinhamento-final.md` + decisões do Thiago.
Execução delegada a subagentes em waves; Devin valida e integra.

## Decisões travadas (Thiago)

| # | Decisão | Consequência |
|---|---|---|
| 1 | Docs novos são a referência (`guia-*-pdf/docx`, 2026-07) | Onde doc antigo diverge, segue o novo (avaliação 360 única no fim, EaD opcional, etc.) |
| 2 | Assinatura de termo: agente separado, com link tokenizado | **Fora do nosso escopo.** Campos civis do termo (`cpf`, `rg`, `endereco`, `nome_civil`) pertencem à trilha de assinatura — nossas migrations não criam esses campos |
| 3 | Mentorado sem acesso à plataforma | Sem login/conta. Interação só via **formulários com links individuais** gerados quando necessário |
| 4 | Forms: nativo, não Google Forms API | Construir um **gerador de formulários próprio, facilitado pra coordenação** |
| 5 | Ciclo: semanal, 1 encontro/semana, ~6 meses total por pessoa | 16 encontros semanais (~4 meses) + inscrição/matching/formação/encerramento (~2 meses). Seed ajusta datas pra refletir a jornada de 6 meses |
| 6 | Menores de idade existem (minoria) | `data_nascimento` em pessoas; <18 → exige responsável/autorização (mesmo conceito do `documento_path` atual do mentorado). Vale pra qualquer pessoa, não só mentorado |

## Arquitetura nova

### Tabelas novas

```sql
-- 0033: campos de matching/perfil (WS-S)
profiles      + nome_social, data_nascimento, genero, cidade, uf,
                interesses text[], motivacao, pref_genero_par,
                cargo, empresa, origem, consent_lgpd_em
mentorados    + nome_social, data_nascimento, genero, cidade, uf,
                interesses text[], motivacao, pref_genero_par,
                objetivos, escolaridade, origem
mentor_profiles + experiencia_previa, formacao_externa, disponibilidade jsonb

-- 0034: engine de formulários (WS-F)
formularios        id, titulo, descricao, campos jsonb, ativo, versao, created_by, timestamps
  campos: [{id, tipo, label, obrigatorio, opcoes?}] — tipos: texto, texto_longo,
          select, multi_select, escala_1_5, data, checkbox, sim_nao
formulario_links   id, formulario_id, token unique, dest_profile_id?, dest_mentorado_id?,
                   dupla_id?, contexto jsonb, usado_em, expira_em, created_by
formulario_respostas id, link_id, respostas jsonb, respondido_em, ip?, ua?

-- 0035: encerramento (WS-E)
encerramentos      id, dupla_id, tipo ('concluida'|'encerrada'), checklist jsonb,
                   autoavaliacao_mentor, disponivel_proximo_ciclo bool,
                   relatorio_resumo text?, decidido_por, decidido_em
trilha_especialista + encerrada_em, motivo_encerramento, devolutiva_pdm
```

### Rotas novas

- `/f/[token]` — pública (middleware allowlist), sem login. Renderiza o form, submit valida token/ativo/expiração/single-use. Visual próprio, minimal, marca Realiza.
- `/formularios` — coordenação: lista, builder, gerar links individuais (escolhe destinatários → token por pessoa, botão copiar link + waLink), respostas (por link + agregadas).

### Regras transversais

- RLS segue `my_role()`/`my_profile_id()`: formularios/links/respostas = coord-only (leitura pública da definição via link token só pela server action, nunca por grant).
- Grants de coluna seguem padrão 0026/0030. Sensíveis (`data_nascimento`, `genero`, `pref_genero_par`, `motivacao`) → revogados de `authenticated`, expostos a coord via view dedicada (padrão `profiles_contato`).
- Demo: datasets novos em `src/lib/demo/` (arquivo próprio por domínio); actions retornam `DEMO_MSG`; `/f/*` em demo → mensagem "disponível fora da demo".
- Copy pt-BR; SLC; server actions `{error}/{ok}`; `React.cache`+`getClaims()` nas queries.

## Workstreams e donos de arquivo

### Wave 1 — paralelo (arquivos disjuntos)

**WS-S · Schema de matching + tipos** — agente `schema-matching`
- `supabase/migrations/0033_campos_matching.sql` (criar arquivo; **não aplicar no remoto** — Devin aplica)
- `src/lib/types.ts`: novos campos nos tipos + `Notificacao.tipo` union com os 4 tipos do fluxo especialista
- `src/lib/ciclo.ts`: labels/opções dos enums novos (genero, origem, escolaridade, pref_genero_par, disponibilidade dias×períodos)
- `src/lib/demo/data.ts`: enriquecer personas com os campos novos (pt-BR verossímil)
- Não toca: actions.ts, queries.ts, components

**WS-F · Forms engine** — agente `forms-engine`
- `supabase/migrations/0034_formularios.sql` (arquivo; não aplicar)
- `src/lib/forms/queries.ts`, `src/lib/forms/actions.ts`, `src/lib/forms/schema.ts` (tipos de campo, validação)
- `src/app/f/[token]/page.tsx` + submit action (público, sem shell do app)
- `src/app/(app)/formularios/*` — builder + lista + links + respostas
- `src/lib/demo/forms-data.ts` + wiring demo nas queries próprias
- `src/middleware.ts`: allowlist `/f/*`
- Nav: item "Formulários" só pra coordenação
- Não toca: types.ts (importa e estende localmente se precisar), actions.ts, demo/data.ts

**WS-Q · Correções rápidas** — agente `quick-fixes`
- `supabase/seed.sql`: títulos encontros 8↔9, 10/11; ajustar datas do ciclo pra jornada ~6 meses; rows de materiais faltantes ("Avaliação 360º", "Perguntas Eficazes") — sem path → "em breve"
- `supabase/migrations/0035_corrige_titulos_e_datas.sql`: UPDATEs idempotentes nos `ciclo_eventos` do remoto
- `src/components/registro-form.tsx`: campo `duracao_min` (coleta real)
- `src/app/api/export/route.ts`: coluna `trilha`
- `src/app/(app)/agenda/page.tsx` + `src/components/mentor-home.tsx`: especialista sem dupla não vê agenda/banner DPP
- E-mails: `contato@` → `mentoria@realiza.vc` (footer, privacidade)
- `AGENTS.md`/`BACKLOG.md`: remover aviso obsoleto da trilha especialista (já modelada, 0027); registrar forms engine + campos novos

### Wave 2 — paralelo, após WS-S integrado

**WS-C · Cadastro/onboarding/matching UI** — agente `cadastro-matching`
- `pessoa-dialogs` + forms de mentorado: novos campos
- Onboarding: passo extra (interesses, motivação, disponibilidade, experiência prévia)
- Matching board: chips de afinidade, alerta `pref_genero_par`, overlap de disponibilidade
- Import CSV: novas colunas
- Perfil self-edit: novos campos
- Dono de `src/lib/actions.ts` (seções createPessoa/updatePessoa)

**WS-E · Encerramento + especialista** — agente `encerramento`
- `supabase/migrations/0036_encerramentos.sql`
- `src/lib/actions-encerramento.ts` (arquivo próprio, padrão actions-especialista)
- Ficha da dupla: seção de encerramento (checklist + decisão) + "resumo da jornada" print-friendly (registros + marcos)
- Especialista: encerrar antecipado + badge de prazo 3 meses + `devolutiva_pdm` visível pro mentor DPP
- Avaliação de sessão/360 via WS-F: botão "gerar link de avaliação" no encontro/encerramento (depende WS-F integrado)

### Wave 3 — validação

- Agente `validacao` (read-only): `tsc`+`eslint`, diff review contra spec, checklist demo (cookies por papel, sem localStorage, actions bloqueadas), checklist RLS/escopo, inconsistências pt-BR.
- Devin: aplica migrations 0033–0036 via MCP supabase em ordem, corrige integração, verificação final.

## Fora de escopo (outras trilhas / não construir)

- Assinatura/termo + campos civis (cpf/rg/endereco/nome_civil): agente separado.
- Login do mentorado, PDM/RdV estruturados, 360 hospedado interno (é form via engine), matching algorítmico, EaD, grupos de troca, dados bancários.
