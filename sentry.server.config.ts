// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: "https://f281267762c5b87ff76232766db6ff08@o4512297444048896.ingest.us.sentry.io/4512297493200896",

  // VERCEL_ENV separa production/preview/development; fora da Vercel cai no NODE_ENV
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,

  // Turns off collection of data that could identify users. Adjust per category:
  // https://docs.sentry.io/platforms/javascript/configuration/options/#dataCollection
  dataCollection: {
    userInfo: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    // locais de stack frame carregam dados sensíveis (dados_civis, tokens)
    stackFrameVariables: false,
    httpBodies: [],
    httpHeaders: {
      deny: [
        "forwarded",
        "-ip",
        "remote-",
        "via",
        "-user",
        "cookie",
        "authorization",
        "referer",
        "bypass",
        "protection",
      ],
    },
    cookies: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    urlQueryParams: {
      deny: ["forwarded", "-ip", "remote-", "via", "-user", "next", "token", "code", "bypass", "protection"],
    },
  },

  // bearer tokens moram no path (/f/, /t/, /assinar/, ...) — redacta antes do envio
  beforeSend: scrubSentryEvent,
  // traceLifecycle 'stream' (default): beforeSendTransaction é ignorado — o
  // scrub de path roda por span
  beforeSendSpan: scrubSentrySpan,

  // SENTRY_DEBUG=1 loga o envio de envelopes — útil pra diagnóstico
  debug: process.env.SENTRY_DEBUG === "1",
});
