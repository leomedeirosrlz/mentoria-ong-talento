# REALIZA-162 — aceite (verificação do entregue + resíduo possível)

- Dado o demo `mentorado` em `/jovem/materiais` com jornada ativa, quando a
  página carrega, então a ordem é: hero (progresso + "Próxima parada") →
  "A fazer agora" (estações abertas) → trilha → Acervo.
- Dado ≥1 estação `a_fazer`, quando olho a trilha, então as abertas **não**
  se repetem lá (estão só no bloco de ação) — decisão registrada em
  `page.tsx:293-298`.
- Dado viewport `≥1280px`, quando rolo até o Acervo, então os materiais
  aparecem em grade de 3 colunas (`xl:grid-cols-3`); em 640-1279px, 2
  colunas; em mobile, 1.
- Dado material sem `path`/`url`, quando listo o acervo, então o card mostra
  estado "em breve" (não quebra a grade).
- Dado a RPC `jovem_jornada` fora (ou sem dupla/cronograma), quando a página
  cai no fallback `BibliotecaJovem`, então **a verificar**: o acervo do
  fallback deve usar o mesmo grid — se ainda for coluna única, abrir
  follow-up micro dentro da própria issue.
- Dado `prefers-reduced-motion`, quando navego, então nenhuma animação de
  entrada bloqueia a leitura (os cards usam `animate-enter`).
