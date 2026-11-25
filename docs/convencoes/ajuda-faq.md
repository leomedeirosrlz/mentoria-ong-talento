# Ajuda e FAQ viva

Toda mudança de fluxo ou de copy que altera o que a pessoa vê fecha a PR
com a Ajuda atualizada. Não é tela nova: é conteúdo, na mesma PR.

## Quando atualizar

- Rota, botão ou rótulo mudou.
- Nasceu um estado vazio, de erro ou de espera.
- Uma regra de prazo, de registro ou de combinado mudou.
- O suporte respondeu a mesma dúvida mais de uma vez.
- O fluxo da demo ou de staging ficou diferente do real.

## Onde

- `src/lib/ajuda/conteudo.ts` → `PERGUNTAS`.
- `TEMAS_AJUDA` só ganha item quando o assunto não cabe em nenhum tema.
- `papeis`: `mentorado`, `mentor_dpp`, `mentor_especialista`, `coordenacao`,
  `supervisor`.
- `links` leva `papeis` quando o destino muda por papel (a Agenda do mentor é
  `/agenda`; a do jovem, `/jovem/agenda`).
- `COMO_FUNCIONA` muda quando o mapa do programa muda, não a cada ajuste de
  tela.

## Como escrever

- Pergunta na voz de quem usa, não na voz do sistema.
- Resposta começa pela ação: onde clicar e o que acontece.
- Duas a quatro frases. Uma ideia por pergunta.
- Sem jargão interno, sem travessão, sem “basta” ou “simplesmente”.
- Um link por destino, só quando a resposta manda a pessoa para uma tela.
- Nada de dado pessoal de outra pessoa. Documento e dado de coordenação não
  entram na Ajuda do jovem.

## Fechamento da PR

- [ ] A pergunta nova existe em `PERGUNTAS` com `papeis` correto.
- [ ] A resposta foi lida em `/ajuda` e na Ajuda do jovem, quando couber.
- [ ] O link abre a rota certa para cada papel.
- [ ] A busca encontra a pergunta por uma palavra que a pessoa usaria.
- [ ] A copy antiga que ficou errada foi removida ou reescrita.
