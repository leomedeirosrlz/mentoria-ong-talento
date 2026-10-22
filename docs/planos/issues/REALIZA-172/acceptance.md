# REALIZA-172 — aceite (7 casos, um por item)

1. **atribuido_nome**: dado um chamado aberto do jovem com `atribuido_a`
   preenchido, quando abro `/jovem/perfil` → chamados, então vejo
   "Responsável: {primeiro nome}" — ou, se a decisão for esconder, o payload
   jovem não carrega `atribuido_nome` (assert de ausência no spec de
   segurança).
2. **getCicloEventos**: dado a agenda do jovem, quando a página carrega,
   então `getCicloEventos` não é chamada (greppável: sem import em
   `jovem/agenda/page.tsx`) e o select de números livres continua listando
   os encontros sem data oficial.
3. **CTA encerramento**: dada uma dupla `concluida` com `encerramentos`
   pendente, quando a coordenação abre `/agenda`, então a fila "Para
   acompanhar" mostra "Rito de encerramento pendente" com link pra ficha.
   (Se a decisão for a ficha, o CTA é `/duplas/[id]` — testar que o link
   chega na `EncerramentoDupla`.)
4. **faixa demo**: dado `entrarNaDemo`, quando abro `/assinar/[token-demo]`,
   então uma faixa "Demonstração — nada aqui é assinado de verdade" aparece
   no topo; numa rota real (não-demo), ela não aparece.
5. **outra_pessoa demo**: dado o token-fixture `outra_pessoa`, quando abro
   `/assinar/<token>` em demo, então o card "Este link é para outra pessoa"
   renderiza (caminho `page.tsx:169`).
6. **cronograma_id esp**: verificação — `pg_get_functiondef` ou leitura de
   `salvarEventoCronograma`/`rascunhoDe` mostram `cronograma_id` preservado
   no update; se bug confirmado, e2e: editar um evento do cronograma esp no
   admin e conferir `cronograma_id` intacto no banco.
7. **expirado terceiros**: verificação da RPC `terceiro_por_token`; se o
   flip lazy estiver na função, e2e: `entrarNaDemo` → `/t/<token vencido>`
   → card "Este link expirou" visível; se o bug for confirmado e corrigido
   na RPC, o mesmo caso deve passar.

Gate comum: `tsc --noEmit`, `eslint`, `pnpm test`, e2e demo verde.
