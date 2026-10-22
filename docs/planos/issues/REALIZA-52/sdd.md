# REALIZA-52 — software design

## 1. Score — `src/lib/score.ts` [NOVO] (puro, Vitest)

```ts
export type ScoreComponente = {
  nome: string;          // 'aderência' | 'avaliações' | 'engajamento' | 'sinais' | 'tendência'
  peso: number;          // fração que entra no total (soma = 1 com os ativos)
  pontos: number;        // 0–100 nesta componente
  detalhe: string;       // "2 encontros atrasados" — sempre explica
};
export type ScoreDupla = {
  score: number;                    // 0–100 (100 = saudável)
  componentes: ScoreComponente[];   // só os com dado — score explica a si mesmo
  semaforo: Semaforo;               // a cor do saudadeDaDupla, pra coerência
};
export function scoreDupla(
  dupla: Dupla, eventos: CicloEvento[],
  opts?: { snapshots?: DuplaSaudeSnapshot[]; hoje?: Date }
): ScoreDupla;
```

### Pesos (v1 — documentados no próprio arquivo, ajustáveis)

| componente | peso | `pontos` |
|---|---|---|
| **sinais** (semáforo) | 0.35 | `saudadeDaDupla` → `sinais` ponderados por tom (`risco` -25, `atencao` -10 a partir de 100) — reuso, não recalculo |
| **aderência** | 0.25 | `feitos/esperado * 100` (dupla nova sem esperado → componente sai) |
| **avaliações** | 0.20 | `mediaAvaliacao`-like com `PESO_AVALIACAO` (encerramento.ts:54) — 4 níveis → 0-100 |
| **engajamento** | 0.20 | registros na janela × esperado + `diasAtrasoRegistro` médio invertido |
| **tendência** (opt.) | repondera | com snapshots (182): delta da série (`count(risco)` 4 semanas) ±10 no total; **sem snapshots a componente sai e os pesos renormalizam** |

Regras: componentes sem dados **saem** e os pesos renormalizam (score nunca
é "0 por falta de dado"); dupla pausada/concluída → `score=null` com
`semaforo` da ficha (não pontuar congelado); `hoje` injetável pra teste.

`scoreTurma(duplas, ...)`: `{media, mediana, distribuicao, porDupla}` —
agregado pra narrativa/filtros.

## 2. Superfície de leitura (v1)

- Coluna `score` no catálogo `COLUNAS`/`catalogoDe` do relatorio.ts +
  render na linha: número + tooltip com `componentes` (o popover de
  detalhe — `Tooltip` do ui/). Default **off** nas colunas públicas (o
  score **não** vai pra `/resumo`/relatorio_links — decisão LGPD: índice
  derivado de sinais internos é dado operacional, não prestação externa —
  `COLUNAS_PUBLICAS` nunca o lista, mesmo com allowlist; sdr §3).
- `getDuplaIa`-style? Não — score computa no server da página (mesma fonte
  do semáforo — `DUPLA_SELECT` + eventos).

## 3. Narrativa — duas entregas

### 3a. Template (sempre disponível, zero LLM)

`src/lib/narrativa.ts` [NOVO]: `narrativaTurma(agg: ScoreTurma & stats) →
string` — prosa determinística na linha de `textoResumoSemana`
(ciclo.ts:1227): parágrafos com aderência, distribuição, destaques
contábeis ("6 duplas pediram atenção"), presenças e docs. Botão "Gerar
resumo do período" no `/relatorios` (card do digest, 56) ou action coord.
**É o fallback permanente** — o LLM só substitui a prosa, nunca os números.

### 3b. LLM (gated)

`gerarNarrativaLlm(agg)` [NOVO, `src/lib/ia/narrativa.ts`]:

- **Gate triplo:** `IA_NARRATIVA_ENABLED` env flag **e** provider
  configurado **e** a decisão jurídica (BLOCKER — sdr §gate). Sem qualquer
  um → cai no template.
- **Payload allowlist literal** (o sdr tem o schema): `turma_label`, nº de
  duplas ativas/pausadas, distribuição semáforo (counts), aderência %,
  média avaliações, % presenças formação, docs por status (counts),
  `score_medio`, `score_mediana`, nº de atenção/risco, periodo. **Sem
  nomes, sem ids, sem texto livre, sem data exata de pessoas.**
- Provider: o que a 178 definir (o plano de IA fala em provider com
  retenção zero — Anthropic é o candidato do registry; a função recebe um
  `callModel(prompt)` injetável pra não acoplar).
- **Auditoria:** `registrar_ia_evento` (0083) — mas `profile_id =
  my_profile_id()` (a coord que clicou — certo) e `canal` CHECK atual só
  tem `'chat','mcp'` → **`alter` no CHECK adiciona `'relatorio'`**
  (migration pequena; documenta que narrativa não é chat).
- Saída: `text` exibido como **rascunho** com badge "gerado por IA —
  revisar antes de enviar"; botão "Usar texto" copia; a ação de envio é
  sempre humana.

## 4. Não-objetivos

- Sem score pra jovem/mentor (índice interno).
- Sem texto livre em LLM **nunca** nesta issue (gate jurídico separado —
  rel-inteligencia.md:129).
- Sem treino/ML — score é regra ponderada, explicável por construção.
- Sem cron/auto-narrativa — geração é on-demand por clique da coord (custo
  e risco mínimos; digest automático é follow-up, rel-inteligencia.md:114).

## 5. Migration (só pra metade 2)

`0110_ia_canal_relatorio.sql` [NOVO]: `alter table ia_eventos drop
constraint ia_eventos_canal_check; add check (canal in
('chat','mcp','relatorio'))`. Nada mais — score não persiste (deriva por
request; se a 56 quiser histórico, os snapshots da 182 já cobrem tendência
— score histórico é follow-up).

## 6. Alternativas

- **Score em SQL view?** — a lógica mora em TS (`saudadeDaDupla`); SQL
  duplicaria (mesmo argumento da 182 contra pg_cron).
- **Persistir score?** — deriva de dados vivos; persistir cria "verdade"
  stale. Os snapshots (182) já são o histórico do insumo.
- **LLM escreve direto no relatório exportável?** — nunca; rascunho →
  humano copia.
- **`ia_eventos` sem coluna de output** — o texto não se grava (mesmo
  motivo do "a ação fica, a resposta não" do 0083); quem quiser o texto,
  re-gera.
