# Decisões do Thiago — rodada de destravamento (pós-review)

Respostas dadas diretamente ao orquestrador. Cada uma fecha o BLOCKER
correspondente nos planos.

| Issue | Decisão |
|---|---|
| **32** | Auxiliar vê **turma inteira por default**; ambas opções ficam acessíveis à coord — a designação individual por dupla pode vir depois como refinamento, mas o escopo padrão é a turma. |
| **51** | E-mail do lote vai pro **mentorado** (`mentorados.email`) com **fallback pro mentor repassar**. |
| **55/67** | Editor de PDF **SUSPENSO** (não morto): instrumentos nativos + forms públicos cobrem o caso de uso; volta se surgir necessidade real (ex.: anotação em materiais). Não implementar agora. |
| **143** | **Variante A** — labels ao redor da roda (escolha do Thiago sobre a recomendação técnica de B). |
| **138** | **Opção A confirmada** — viewer de mockups na demo (26 HTMLs navegáveis); sem modos reais paralelos. Artefato temporário, remove ao fim da validação. |
| **70** | **1 grade de disponibilidade só** — a duplicata no Google Form era artefato de cópia. |
| **159** | Elegibilidade alumni→mentor: **só `situacao='concluido'`**. Desistentes não entram. |
| **170** | **v1 confirmada**: audiência = link+senha (parceiro/diretoria); respostas brutas de instrumentos (anamnese, 360, avaliações) **fora da v1** — só dados operacionais. |
| **183** | Retenção **13 meses**; **produção falha visível sem `RESUMO_SALT`** (sem fallback de salt público em prod). |
| **33** | **Escopo B aprovado** (inventário + base legal + política escrita, sem automação de expurgo); **Thiago revisa as cláusulas de autorização com o jurídico** — o texto atual é rascunho sem fonte oficial (gap #1 do inventário). |
| **53** | Shared Drive nonprofit **postergado** — documentado, não é prioridade agora. |
| **65** | Offload frio: ativar **quando storage passar de ~70% do 1GB** (monitorar no dashboard Supabase); depende da 53. |
| **52/178/179/180** | Provider de IA: **OpenCode** (gateway Zen, API OpenAI-compatible). Gate das specs mantém-se: confirmar retenção/DPA do upstream do modelo escolhido antes de ligar qualquer flag — `provider.ts` nasce agnóstico, OpenCode é o alvo concreto. |
| **Jira** | Autorizado **fechar as ~25 issues FEITO** com comentário citando a evidência (arquivo/migration). |

## Ajustes derivados

- **62**: o literal `a partir de —` já não nasce mais (`format*` retornam "a
  definir" para null — `ciclo.ts:1892-1947`); residual é a convenção
  prazo×data por superfície — sweep `rg` já documentado no plano. Sem decisão
  externa pendente.
- **67** suspenso ⇒ sabor "reabrir p/ ajuste" não precisa ser decidido agora.
