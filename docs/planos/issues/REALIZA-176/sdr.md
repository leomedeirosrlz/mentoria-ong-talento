# REALIZA-176 — nota de dados sensíveis

- A agenda coordenada agrega nomes de duplas (mentor+mentorado menor) e
  sinais — escopo coord-only já garantido pelo gate em
  `src/app/(app)/agenda/page.tsx` por `me.role`. O redesign não muda quais
  dados são exibidos, só a ordem/densidade — sem disclosure novo.
- "Lembrar" dispara notificação/WhatsApp pra dupla — ação já existente;
  sem novo canal.
