# REALIZA-62 — Critérios de aceite

Formato: **dado** → **quando** → **esperado**.
Papéis: mentor (M), coord (C), mentorado (J).

## Auditoria (o que a issue confirma)

1. **Dado** o código atual → **quando** `rg "a partir de —"` no `src/` →
   **esperado** 0 ocorrências (o literal original já não existe).
2. **Dado** o mesmo → **quando** `rg "a partir de"` → **esperado** as únicas
   ocorrências são frases com timestamp real (`api/nudge/route.ts` cooldown)
   — nenhuma interpola placeholder vazio.
3. **Dado** `formatDate`/`formatDateTime`/`formatDiaHora`/`formatDiaMes` →
   **quando** chamados com `null` → **esperado** `"a definir"` (fallback
   vigente de data de evento — inalterado, é correto pra esse uso).

## Regra de prazo nulo — superfícies existentes

4. **Dado** encaminhamento com `prazo=null` na lista do mentor
   (`encaminhamentos-list`) → **quando** M abre a ficha → **esperado**
   nenhuma linha de prazo renderizada (a linha é omitida, não "a partir de
   a definir" nem dash).
5. **Dado** combinado com `prazo=null` na visão do jovem
   (`jovem-combinados`) → **quando** J abre `/jovem` → **esperado** nenhuma
   linha "até —" / placeholder.
6. **Dado** `combinadosVencidos` em `agenda-por-mentorado` → **quando** C
   abre a aba → **esperado** cada linha mostra `prazo era {data real}` —
   só entram vencidos (non-null); se `prazo` fosse null a linha não estaria
   na lista (o filtro garante).

## Regra de prazo nulo — superfície nova / genérica

7. **Dado** qualquer `.tsx` novo/editado que exibe campo `prazo` →
   **quando** o prazo é `null` e a data **não** é o ponto → **esperado** a
   linha omitida (`t.prazo && …`).
8. **Dado** o mesmo → **quando** o prazo **é** a informação primária →
   **esperado** `sem prazo definido` — nunca `—`, `a definir` ou frase
   gramatical com placeholder.
9. **Dado** a convenção → **quando** se lê o cabeçalho de `ciclo.ts` (ou
   onde a regra foi escrita) → **esperado** o comentário explicitando a
   distinção data-de-evento (`a definir`) × prazo (`sem prazo definido`).

## Casos de borda de data

10. Prazo `null` → omitido / `sem prazo definido` (acima).
11. Prazo válido futuro → `até {formatDate}` / `vence em {formatDate}` —
    render normal, inalterado.
12. Prazo vencido → `venceu em {formatDate}` / `prazo era {formatDate}` —
    render normal, inalterado.
13. Prazo inválido (string corrompida) → `formatDate` devolve `"a definir"`
    — aceitável como fallback genérico de data malformada (caso patológico,
    não o da issue); se uma superfície de prazo quiser distinguir, usa
    `sem prazo definido` via check `isValid`.

## Se `formatPrazo` for criado (só se o passo 0 achar caso de "prazo é o ponto")

14. `formatPrazo(null)` → `"sem prazo definido"`.
15. `formatPrazo(data válida)` → `formatDate(data)` (delega).
16. `formatPrazo("lixo")` → `"sem prazo definido"` (inválido = sem prazo).

## Gates

17. `npx tsc --noEmit` limpo; `npx eslint src/` limpo; `pnpm test` verde
    (teste novo só se `formatPrazo` existir — critérios 14–16).
18. O comentário da regra está no código (critério 9) — a issue fecha com a
    convenção escrita, mesmo sem nenhuma linha de runtime alterada.
