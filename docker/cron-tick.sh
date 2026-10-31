#!/bin/sh
# Chama /api/jobs/tick com o mesmo bearer que a Vercel injetava.
# "app" resolve pelo nome do service no compose. Falha vai pro log do
# container (docker logs), não derruba o daemon.
wget -qO- --header="Authorization: Bearer $CRON_SECRET" --timeout=90 \
  "http://app:3000/api/jobs/tick" >/dev/null 2>&1 \
  || echo "[cron] tick falhou" >&2
