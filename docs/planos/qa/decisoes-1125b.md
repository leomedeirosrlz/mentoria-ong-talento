# Decisões do lead — rodada 1125b (valem por cima do brief)

Estas três decisões fecham perguntas que estavam abertas no brief. Ajuste o
`rodada-1125b.md` a elas: onde a sua recomendação divergir, a decisão ganha.

## 1. Liza com dados pessoais (item 6)

Não é problema de acesso: **coordenação já tem RLS com o token dela**. A Liza
age com a sessão de quem pergunta, então quando quem pergunta é coord ela pode
consultar dados pessoais (estado, sexo, idade etc.) porque a RLS já autoriza.

- **Escopo:** coord/equipe → pode. Mentor, mentorado e especialista → continua
  bloqueado, sem exceção e sem bypass de RLS.
- **Desenho:** ferramenta roda com o client do próprio usuário (nunca
  service role), respeitando RLS; pergunta de BI devolve agregado + as linhas
  que a RLS daquele papel permite.
- **Continua obrigatório:** log de consulta e não montar prompt com PII além do
  que a resposta precisa. Não é justificativa pra "dar acesso ao modelo" — é
  autorização que já existe no banco.
- **Não é issue de produto** decidir "se" pode; é issue de implementação
  (ferramenta + testes de RLS por papel) e de copy ("a Liza pode ver isso
  porque você é da coordenação").

## 2. Ficha da dupla para o jovem (item 23)

**Sim, mas muito adaptada.** Não é a ficha da equipe/mentor com outro rótulo:
é uma leitura própria do jovem (quem é o mentor, encontros, combinados, o que
ele precisa fazer), sem notas privadas, sem ações de staff, sem semáforo
interno. Trate como tela nova de leitura, reusando componentes de apresentação,
não como permissão a mais na tela existente.

## 3. PDM: um só (itens 9, 13, 14, 24)

**Um único PDM.** Não quero dois, nem quatro, nem "view do mentor" separada da
"view do jovem". O mesmo documento, com as mesmas peças (visão, metas, passos),
mudando só:

- **permissão** (quem edita o quê, quando);
- **copy** (o que cada papel lê sobre a mesma coisa).

Se a implementação atual tem um form e uma view, o alvo é **um componente de
documento vivo** com modo leitura/edição e lentes por papel — não dois
artefatos sincronizados. A "view que o usuário gostou" é a referência de
qualidade, não um segundo produto.

Consequência para as issues: qualquer proposta que crie tela/rota/registro
paralelo de PDM está fora. O que entra é consolidar o que existe.

## Já corrigido (não reabrir como issue)

- Roteiro do jovem entregava conteúdo do mentor (lado `null` na demo) —
  corrigido em `f995aede`, no ar no staging: `/jovem/roteiro/6` não tem mais
  "Preparação", "Depois do encontro" nem "Nota ao mentor".
- Convite do plano saía com `http://localhost:3000` e em terceira pessoa —
  corrigido em `67301c20`: base cai para `VERCEL_PROJECT_PRODUCTION_URL` /
  `VERCEL_URL`, e o mentor manda em primeira pessoa ("eu combinei").

O choque de data (confirmar plano × "Próximos") **continua aberto** — esse é
issue de verdade.
