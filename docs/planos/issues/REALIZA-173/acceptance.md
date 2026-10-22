# REALIZA-173 — aceite

- Dado `entrarNaDemo("coordenacao")` em `/materiais`, quando a página
  carrega, então vejo a trilha 1-16 e respondo em ≤5 s quais encontros têm
  material (lime) vs. vazios (tracejado) vs. parciais (amarelo, "em breve").
- Dado um encontro com materiais, quando clico no summary `Encontro N ·
  K materiais`, então o `<details>` expande com as linhas compactas e as
  `MaterialActions` funcionam (upload/edit/delete/send).
- Dado um encontro vazio, quando expando, então vejo "sem material ainda" +
  o CTA "adicionar aqui" abrindo `NovoMaterialDialog` com `encontro_num=N`.
- Dado materiais sem `encontro_num` (Guias/Modelos/Links), quando rolo ao
  fim, então estão numa seção/transversal própria — não misturados aos
  encontros.
- Dado papel `mentor`, quando abro `/materiais`, então o hub é read-only
  (sem `MaterialActions`/`NovoMaterialDialog`) e a trilha continua útil.
- Dado mobile (`<sm`), quando uso a página, então a trilha rola em
  `overflow-x-auto` e os `<details>` abrem em coluna única.
- Demo: a trilha acende com os materiais do dataset demo (a verificar
  cobertura do seed — se vazio, o cenário vazio deve mostrar tracejados +
  `EstadoVazio` só quando o catálogo inteiro está vazio).
