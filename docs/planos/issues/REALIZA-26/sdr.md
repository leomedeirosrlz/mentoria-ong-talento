# REALIZA-26 — Security & data review

`encontro_reagendamentos` guarda **metadados de agendamento** (datas, motivo
selecionado, ator, origem) — não é `*_pessoal` nem `dados_civis`. O motivo
pode carregar texto livre (`"outro"` → `motivo_detalhe`) que menciona o
mentorado (menor) — tratar como dado operacional interno, mesma classe de
`encontros.motivo_reagendamento` que já existe.

## Superfície de ataque

| Vetor | Avaliação |
|---|---|
| Leitura indevida pelo mentorado | **Fechada por omissão**: a policy `select` lista coord/mentor/sup explicitamente — sem ramo `mentorado`/`jovem_duplas`. O jovem continua vendo só o motivo atual via `encontros` (como hoje). |
| Escrita/forja pela aplicação | **Fechada por omissão**: nenhuma policy de insert/update/delete + nenhum grant de insert pra `authenticated`. Só o trigger (security definer) escreve — **impossível** um client criar linha de histórico falsa ou apagar uma real. |
| Escrita em dupla alheia | O trigger usa `new.dupla_id`/`old.dupla_id` do write — a policy de `encontros` já impede o mentor de escrever na dupla de outro. |
| XSS via `motivo`/`motivo_detalhe` | React escapa; sem `dangerouslySetInnerHTML`. |
| `anon`/público | Zero grants pra `anon`; nenhuma rota pública lê a tabela. |
| Trigger bypass RLS | Correto — é o ponto: security definer escreve sem depender de policy. A função não aceita input do caller (só `NEW`/`OLD`/`TG_OP`) — não há injeção via parâmetro. |
| Delete cascata | `dupla_id on delete cascade` — a dupla morre, o histórico morre. `encontros` DELETE → `desmarcado` logado, **não** cascade do histórico (a chave é `(dupla_id,numero)`, não `encontro_id`). |

## LGPD / minimização

- **Finalidade**: auditoria operacional de agendamento — legítimo (mesma base
  de `encontros`). O histórico é necessário pra gestão da dupla e pro
  acompanhamento da coordenação.
- **Mínimo**: datas + motivo (enum ou texto curto) + ator/papel. Sem IP, sem
  user-agent, sem device — não é trilha de segurança, é trilha de negócio.
- **Retenção**: morre com a dupla (`cascade`). Sem expurgo próprio — segue a
  revisão LGPD estrutural (REALIZA-33) como as demais tabelas penduradas.
- **Acesso a agregado**: o chip "N remarcações" só expõe contagem — o detalhe
  fica no dialog pra quem tem policy de leitura.
- **Decisão explícita: mentorado não lê histórico nesta versão.** O jovem já
  vê o motivo atual (`motivo_reagendamento`) — transparência suficiente pro
  caso de uso dele ("por que mudou?"). O histórico completo ("quantas vezes,
  quem remarcou") é informação de gestão — útil pra staff, potencialmente
  ruído/constrangedor pro jovem ("o mentor remarcou 3 vezes por causa sua").
  Se surgir necessidade, é uma policy a mais — modelado pra isso.

## Auditoria

- `ator_id` + `ator_papel` + `origem` + `created_at` = quem, com que papel,
  por qual caminho, quando — suficiente pra reconstruir cada evento.
- `origem='sql_direto'` + ator null marca explicitamente writes fora do app
  (seed, fix manual) — honesto, não finge.
- A própria natureza append-only é a auditoria: não existe caminho de edição.

## Ameaças residuais aceitas

- Alguém com acesso SQL direto (service role) pode apagar linhas — é poder
  administrativo já concedido no banco inteiro; não é ameaça nova.
- `motivo_detalhe` com dado sensível digitado pelo mentor no `"outro"` —
  mitigado por convenção (o campo já existia em `motivo_reagendamento`); sem
  enforcement técnico novo. Documentado pra revisão LGPD estrutural.
