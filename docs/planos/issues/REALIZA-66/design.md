# REALIZA-66 — design.md

## Persona & JTBD

- **Mentor no celular**: fotografa o quadro/evidência do encontro e anexa
  no registro — hoje uma foto de 8MB gasta storage e sobe devagar no 4G.
- **Coordenação**: anexos de documento/currículo pesados.

Nada muda visualmente — a entrega é **invisível e honesta**.

## Regras

- O campo de arquivo aceita e lista normalmente; o tamanho exibido é o do
  arquivo **final** (webp). Sem banner "comprimimos pra você" — ruído.
- Erro de tamanho só se o arquivo **comprimido** passar do cap (mensagens
  atuais "Envie … até N MB" permanecem corretas).
- Compressão <1s não ganha spinner; se passar disso (arquivo gigante),
  reutilizar o `CircleNotch`+desabilitar anexar até terminar — padrão
  dos uploads existentes.
- Falha de compressão é **silenciosa** pro usuário (original sobe); log
  `console.warn` dev-side só.

## Microcopy (existente, sem adição)

"Envie PDF, PNG, JPG ou WebP até {N} MB." — segue verdadeira.

## Mobile

- `accept` inalterado — a câmera do iOS/Android continua oferecida pra
  `image/*`→ jpeg/png/webp. HEIC segue fora (decisão já tomada:
  "não renderiza").
- Canvas em worker? Não — `OffscreenCanvas` quando disponível com
  fallback pro canvas DOM; a operação é <1s e não justifica worker.

## Estados

- Comprimindo (raro >1s): chip do anexo com spinner, nome já visível.
- Erro: toast existente de tamanho/tipo — sem novo estado.

## A11y

- O input file e o foco não mudam; `aria-busy` no chip enquanto comprime.
