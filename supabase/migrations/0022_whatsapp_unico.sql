-- WhatsApp é a identidade de contato operacional (nudge, "falar com",
-- envio de combinados). Duas pessoas com o mesmo número tornam ambíguo pra
-- quem cada conversa vai — melhor falhar no cadastro do que mandar errado.
-- Índice parcial: null/'' não participam (mentorado sem zap é legítimo).
create unique index mentorados_whatsapp_key
  on public.mentorados (whatsapp)
  where whatsapp is not null and whatsapp <> '';

create unique index profiles_whatsapp_key
  on public.profiles (whatsapp)
  where whatsapp is not null and whatsapp <> '';
