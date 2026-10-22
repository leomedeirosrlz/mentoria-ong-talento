# REALIZA-56 — security & data review (leve — agregados internos)

## Superfície

- Dashboards agregam dados já acessíveis à coordenação nas telas existentes
  (semáforo, agenda, assinaturas, presenças). Nenhuma categoria nova de dado,
  nenhum destinatário novo — **coord-only**, mesma página que já é.
- Única ampliação real: **correlação** — um card cruza "falta em formação +
  doc pendente + sem registro" num mesmo recorte. Pra coord é o trabalho
  dela; não é vazamento (mesma audiência).

## Ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| Mentor/jovem enxerga agregado de si ou de outros | `/relatorios` já é coord-only (page gate); nada muda — verificar no PR que os componentes novos não vazam pra outras rotas (são scoped em `(app)/relatorios/`). |
| Dado de menor em card público | Não há canal público — o digest copiável vai por **ação humana** (coord cola no WhatsApp); o texto de `textoResumoSemana` já é pensado pra consumo interno (primeiro nome apenas — relatorios-inteligencia.md:114). Sem link público novo. |
| Snapshot vaza pra quem não devia | Leitura de `dupla_saude_snapshots` obedece à RLS dela (coord ∪ supervisor) — a query da página roda como coord. Supervisor não acessa `/relatorios` de qualquer forma. |
| `motivo_reagendamento` expõe motivo pessoal | O motivo é texto curto do mentor (ex.: "trabalho") — coord já vê na ficha; agregação por texto normalizado não adiciona exposição. |
| Filtros por searchParams vazam URL com nomes | Params são `turma/cronograma/dupla_id/status` — `dupla_id` é uuid, sem nome; compartilhar o link só funciona pra quem já tem acesso (RLS). |

## LGPD

- Mesma base dos dados originais; agregação não muda finalidade (gestão do
  programa). Sem transferência externa (o digest é copia-e-cola humano).
- Minimização: cards mostram contagens + identificação **só** onde a ação
  exige (lista de atenção nomeia a dupla — é o ponto de entrada pro caso).
- Retenção: nada persistido — compute em request, sem cache de métricas.

## Checklist

- Sem migration/tabela nova → sem grants novos; reusa RLS existente
- Queries pelo client normal (RLS do coord) — `createAdminClient` **não**
  entra aqui (diferente do `/resumo` público)
- Sem PII em URL (só ids)
- Demo: mesmos dados canned do papel coord — nada real
