# SQL sugerido — issue 027 (privacidade, staging e notificações)

Alçada do lead: agentes não criam nem aplicam migration (`AGENTS.md`).
Sugestão de conteúdo — conferir a função vigente no remoto antes de escrever
o arquivo (a 0086 já pode ter sido re-emitida por migrations posteriores).

## FR-011(a): título contextual de "Sugestão confirmada"

Mint atual em `confirmar_sugestao_especialista`
(`supabase/migrations/0086_especialista_sugestao_devolutivas.sql:271-276`):

```sql
if s.created_by is not null then
  perform public.sol_notificar(s.created_by, 'solicitacao_registrada',
    'Sugestão confirmada',
    v_nome || ' confirmou a sua sugestão de especialista — o pedido seguiu.',
    '/duplas/' || s.dupla_dpp_id);
end if;
```

Substituição sugerida (mesma assinatura; `v_nome` já carrega o nome do
mentorado em `select m.nome into v_nome ... where m.id = s.mentorado_id`,
linha 257 da função):

```sql
if s.created_by is not null then
  perform public.sol_notificar(s.created_by, 'solicitacao_registrada',
    v_nome || ' confirmou a sua sugestão de especialista',
    coalesce('O pedido seguiu pra coordenação (tema: ' || s.demanda || ').',
             'O pedido seguiu pra coordenação. Você recebe o retorno por aqui.'),
    '/duplas/' || s.dupla_dpp_id);
end if;
```

Notas:

- `demanda` pode ser `null`/`''` — o `coalesce` cobre; se preferir tratar
  string vazia, usar `nullif(btrim(s.demanda), '')` no teste.
- Alternativa mais simples para o corpo, se o tema redundar com a ficha:
  `'O pedido seguiu pra coordenação. Você recebe o retorno por aqui.'`
- `p_solicitacao` da spec era rascunho — o mint vigente usa href para a
  ficha da dupla (`'/duplas/' || s.dupla_dpp_id`), mantido acima.
- Mesmo passe recomendado nas vizinhas da mesma função, se o lead quiser
  já corrigir na mint em vez de depender só da reescrita na leitura:
  - `:266-268` 'Pedido de especialista em aberto' →
    `v_nome || ' confirmou a sugestão do mentor'` /
    corpo `'O mural decide.'`;
  - `:306-308` 'Sugestão dispensada' →
    `v_nome || ' dispensou a sua sugestão de especialista'` /
    corpo `'O pedido não segue adiante por enquanto.'`

## Independente da migration

A reescrita na leitura (FR-011(b) + FR-012) foi implementada em
`src/lib/notificacao-releitura.ts` e cobre rows antigas, que o guard da
0019 torna imutáveis — então a migration acima é opcional e só simplifica
os mints futuros.
