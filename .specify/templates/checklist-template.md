# Checklist — <tipo> · <feature>

**Propósito:** revisar a **qualidade dos requisitos**, não a implementação.
**Feature:** `specs/NNN-<slug>/spec.md` · **Revisor:** <nome>
**Semântica:** `[x]` = critério revisado e satisfeito. Não significa código pronto.

## Spec

- [ ] CHK001 Cada história tem teste independente declarado.
- [ ] CHK002 Todo `[NEEDS CLARIFICATION]` foi resolvido ou virou fora de escopo.
- [ ] CHK003 Critérios de sucesso são observáveis sem ler código.
- [ ] CHK004 O fora de escopo impede o épico acidental.

## Dados e RLS

- [ ] CHK005 Todo caminho de leitura/escrita tem papel definido na matriz.
- [ ] CHK006 Policy ou RPC nova tem caso de papel negado.
- [ ] CHK007 Migration tem número livre, ordem, retroativo e rollback.

## Auth e rotas públicas

- [ ] CHK008 Rota pública está em `isPublic` e usa token de posse.
- [ ] CHK009 Token inválido, expirado e de outro dono têm comportamento definido.
- [ ] CHK010 CSP e `frame-ancestors` continuam válidos.

## LGPD

- [ ] CHK011 Dado pessoal novo entrou no inventário e na retenção.
- [ ] CHK012 Menor de idade tem o fluxo do responsável descrito.

## Demo e UI

- [ ] CHK013 A feature funciona em `/demo` sem login.
- [ ] CHK014 Copy pt-BR sem travessão/jargão; status nunca só por cor.
- [ ] CHK015 Teclado, foco e piso de 12px no mobile.

## Testes e operação

- [ ] CHK016 Toda regra de domínio nova tem teste unitário.
- [ ] CHK017 E2E cobre o caminho principal e o negado.
- [ ] CHK018 DoD e ordem staging → produção estão no plano.

## Notas

- Achados, links e itens que voltam para `/speckit-clarify`.
