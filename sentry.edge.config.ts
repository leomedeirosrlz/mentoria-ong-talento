// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: "https://f281267762c5b87ff76232766db6ff08@o4512297444048896.ingest.us.sentry.io/4512297493200896",

  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,

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

  beforeSend: scrubSentryEvent,
  beforeSendSpan: scrubSentrySpan,
});
