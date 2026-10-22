# REALIZA-143 — Critérios de aceite

1. **Desktop mostra o mapa completo** — viewport ≥1280px: as 16 áreas
   nomeadas visíveis ao mesmo tempo (labels ao redor OU grade 2 col, pela
   variante do mockup), sem scroll pra descobrir a área seguinte.
2. **Ajuste por eixo preservado** — com o mapa completo visível, cada eixo
   continua ajustável (slider e/ou gesto) e o foco visual indica o eixo
   corrente.
3. **Mobile intacto** — <768px: experiência focada um-eixo-por-vez/
   lista idêntica à atual; zero regressão de navegação.
4. **Tela média** — 768–1024px: sem quebra/overflow horizontal; roda escala
   e labels não colidem (regra: labels só ≥lg ou variant B).
5. **Hierarquia** — título em bloco branco separado; setas em linha
   própria acima dos −/+; −/+/setas com tokens da marca (lime fundo, ink
   ícone).
6. **Payload imutável** — resposta submetida produz exatamente o mesmo
   `respostas` jsonb de antes (teste: mesmo input → mesmo output; spec
   e2e do instrumento roda verde).
7. **`instrumento-resultado`** — render de resposta compatível (labels
   aparecem também no resultado se a variante A for aplicada ao modo
   leitura; senão resultado mantém formato atual).
8. **Overlay REALIZA-18** — se 18 já mergeou: comparativo + labels não
   se sobrepõem (labels vivem fora do polígono).
9. **a11y** — `axe`/leitor: sliders cobrem todas as áreas; textos
   decorativos `aria-hidden`; foco visível nos controles.
10. **Qualidade** — `tsc`/`eslint` limpos; specs e2e do `/f` roda
    existentes passando.
