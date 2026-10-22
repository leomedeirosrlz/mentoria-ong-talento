// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent, scrubSentrySpan } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: "https://f281267762c5b87ff76232766db6ff08@o4512297444048896.ingest.us.sentry.io/4512297493200896",

  // NEXT_PUBLIC_VERCEL_ENV é injetada pela Vercel no bundle do browser
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,

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

  // ruído de browser que nunca é bug nosso
  ignoreErrors: [
    "ResizeObserver loop completed with undelivered notifications",
    "ResizeObserver loop limit exceeded",
    "AbortError: The operation was aborted",
    "AbortError: Fetch is aborted",
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
  ],

  beforeSend: scrubSentryEvent,
  beforeSendSpan: scrubSentrySpan,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
