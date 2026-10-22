# Brief — auditoria mobile-first (sessão de otimização de UI)

Sessão de otimização mobile-first do realiza.vc. Você é um agente AUDITOR:
leia o código, aplique o checklist, escreva achados concretos. NÃO edite
src/ nesta fase — só escreva seu relatório em `docs/planos/mobile/<grupo>.md`.

## Skills — LEIA antes de auditar (arquivos, não invocações)

- `/home/thiago/nb/realiza.vc/.devin/skills/ux-review/SKILL.md` — o framework
  de review da casa (hierarquia, Gestalt, estados, espaçamento, cor, valor).
  Aplique-o com o recorte mobile: a persona dominante usa celular.
- `/home/thiago/.config/devin/skills/accessible-animation/SKILL.md` — gates de
  reduced-motion (prefers-reduced-motion, tiered).
- `/home/thiago/.config/devin/skills/60fps-animation/SKILL.md` — transform/
  opacity only, sem layout thrash.
- `docs/planos/issues/_recon/telas-mapa.md` — inventário das telas (use como
  mapa; audite o código atual, não a descrição).
- `docs/planos/issues/_contexto-agentes.md` — domínio e personas.

## Checklist mobile-first (por tela)

Para CADA tela/rota do seu grupo, verifique no código (Tailwind classes,
estrutura JSX) e registre com `arquivo:linha`:

1. **Touch targets** — todo elemento clicável ≥44px (min-h-11/min-h-9+pading,
   hit-slop); ícone-only sem label acessível; links inline vs. botão real.
2. **Overflow horizontal** — `w-[Npx]`/grids sem quebra, tabelas sem
   `overflow-x-auto`, textos longos sem truncate/break, grid de colunas
   fixas que estoura <360px.
3. **Densidade legível** — padding externo mobile (px-4 vs px-6), text-xs
   demais em conteúdo decisório, hierarquia que exige scroll pra achar a
   ação primária; gutters mortos; colunas laterais que vazam.
4. **Padrão lista↔card** — tabelas desktop sem versão card no mobile;
   linhas com ações empilhadas corretas (footer morto, cluster de ações).
5. **Modais/drawers no pequeno** — `sm:max-w-*` correto (a base já cobre
   `calc(100%-2rem)`); full-height ok; form com teclado (sticky submit?).
6. **Estado vazio/erro/loading mobile** — skeleton existe e espelha a
   anatomia real; empty state com CTA alcançável; erro não é banner fino.
7. **Header/nav mobile** — sticky ocupa demais? navegação inferior/tab bar
   consistente; breadcrumbs que não cabem.
8. **Safe areas e gestos** — elementos fixed/bottom respeitam
   `env(safe-area-inset-bottom)`; swipe não conflita; long-press.
9. **Inputs mobile** — inputMode/type correto (tel, numeric, email),
   autocomplete, iOS zoom (font-size <16px em input dá auto-zoom).
10. **Animações** — reduced-motion respeitado (guard de globals.css cobre
    animate-enter?), transform-only, sem jank de layout.
11. **Permissões por papel** — a tela serve quem no celular? Mentorado é
    mobile-majoritário; coord usa desktop mas consulta no celular.

## Formato do relatório — `docs/planos/mobile/<seu-grupo>.md`

```md
# Mobile audit — <grupo>
## Cobertura: <rotas auditadas>

### <rota ou componente>
- **Bloqueante** (quebra impede uso): achado, arquivo:linha, fix concreto
- **Importante** (dói no uso diário): idem
- **Polish** (melhoria): idem
- OK: o que já está bom (1 linha, pra não re-tocar)
```

Severidade real: "bloqueante" = fluxo impossível/inacessível no celular;
"importante" = esforço/erro frequente; "polish" = conforto. Todo achado cita
arquivo:linha e a classe/prop concreta do fix — nada de "melhorar espaçamento".

## Regras

- Read-only em src/: você só escreve o seu .md de relatório.
- NÃO audite arquivos que a onda 4 está tocando (ficha dupla [id], roda da
  vida, forms de intake, LGPD docs) — marque como "em edição paralela".
- PRs grandes são inimigos: prefira 10 achados cirúrgicos a 1 redesign.
