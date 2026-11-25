---
description: Checa consistência entre spec, plano e tasks antes de implementar
---

Analise a spec ativa, o `plan.md` e o `tasks.md` (não escreva código).

Procure e reporte, com citação do arquivo:

1. **Cobertura:** todo requisito funcional e NFR tem task? Toda história tem teste independente?
2. **Contradição:** plano ou task contradiz a spec, a constituição ou `docs/convencoes/*`.
3. **Migration:** número livre, ordem, retroativo, rollback e imutabilidade de migrations já existentes.
4. **Autorização:** matriz papel × operação presente, com caso negado para cada policy/RPC nova.
5. **Rota pública:** entrada em `isPublic`, token de posse, token inválido e CSP.
6. **LGPD:** dado pessoal novo no inventário; menor de idade com fluxo do responsável.
7. **Demo:** paridade prevista; mutação bloqueada.
8. **DoD:** comandos de verificação presentes e executáveis neste repo.
9. **Burocracia:** task que não muda comportamento ou requisito que não é observável.

Saída: lista priorizada (bloqueia / corrige / opcional) e o passo do fluxo para onde voltar (clarify, plan ou tasks). Não grave arquivo.
