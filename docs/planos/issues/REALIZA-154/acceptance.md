# REALIZA-154 — aceite (verificação do entregue)

- Dado uma dupla com **zero** `encaminhamentos` (ex.: dupla nova criada no
  demo/app), quando abro `/duplas/[id]`, então **não** existe heading
  "Combinados" nem card vazio no lugar.
- Dado uma dupla com encaminhamentos (pendentes ou feitos), quando abro a
  ficha, então a seção "Combinados" aparece com a lista e o CTA
  "Enviar combinados".
- Dado encaminhamentos todos marcados "feito", quando abro a ficha, então a
  seção continua visível (o guard é `length > 0`, não `pendentes > 0`) —
  comportamento registrado como decisão, não bug.
- Demo: `entrarNaDemo("coordenacao")` → ficha de dupla sem combinados →
  `expect(page.getByText("Combinados")).toHaveCount(0)`.
