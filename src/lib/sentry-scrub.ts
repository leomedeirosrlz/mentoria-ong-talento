// Scrubbing compartilhado dos 3 runtimes do Sentry (client, node, edge).
// Dois tipos de segredo viajam na URL e precisam sair do evento:
// 1. bearer tokens no PATH — /f/<token>, /t/<token>, /assinar/<token>,
//    /avaliar/<token>, /resumo/<slug>, /api/assinar-token/<token>
// 2. credenciais de auth no QUERY/FRAGMENT — #access_token/#refresh_token do
//    magic link implícito, ?h= (nonce do handoff — bearer single-use grant
//    anon), ?code=/?token_hash= (pkce/otp), ?next= (path com token embutido
//    url-encoded), ?to= do /api/nudge (URL wa.me com celular do mentor).
// dataCollection.urlQueryParams só filtra query por nome de parâmetro —
// fragment e valores dentro de breadcrumbs/request.url passam crus. Por isso
// o scrub roda aqui, antes do envio, em qualquer runtime (edge-safe).
import type { Breadcrumb, Event } from "@sentry/nextjs";

const BEARER_PATH =
  /(\/(?:f|t|assinar|avaliar|resumo|api\/assinar-token)\/)[^/?#&\s'"]+/g;

const SECRET_PARAM =
  /(^|[?&#])(access_token|refresh_token|token_hash|id_token|code|h|state|next|to|error_code|error_description)=[^&#\s]*/g;

const scrubUrl = (url: string) =>
  url
    .replace(/#.*$/, "") // fragment nunca é necessário pra debugar
    .replace(BEARER_PATH, "$1[redacted]")
    .replace(SECRET_PARAM, "$1$2=[redacted]");

export function scrubSentryEvent<T extends Event>(event: T): T {
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url);
  }
  if (typeof event.request?.query_string === "string") {
    event.request.query_string = scrubUrl(event.request.query_string);
  }
  const headers = event.request?.headers;
  if (headers) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "referer" && typeof headers[key] === "string") {
        headers[key] = scrubUrl(headers[key]);
      }
    }
  }
  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction);
  }
  if (typeof event.message === "string") {
    event.message = scrubUrl(event.message);
  }
  // consoleIntegration (default) joga console.error em breadcrumbs — erros do
  // PostgREST ecoam o input inválido (uuid/token digitado) em data.arguments
  const raw: unknown = event.breadcrumbs;
  const crumbs: Breadcrumb[] = Array.isArray(raw)
    ? raw
    : ((raw as { values?: Breadcrumb[] } | undefined)?.values ?? []);
  for (const crumb of crumbs) {
    if (typeof crumb.message === "string") {
      crumb.message = scrubUrl(crumb.message);
    }
    if (!crumb.data) continue;
    for (const key of Object.keys(crumb.data)) {
      const value = crumb.data[key];
      if (typeof value === "string") {
        crumb.data[key] = scrubUrl(value);
      }
    }
  }
  // mesmo eco de input inválido nas mensagens de exceção
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === "string") {
      ex.value = scrubUrl(ex.value);
    }
  }
  return event;
}

// traceLifecycle 'stream' (default no SDK v11/Next 16): spans saem
// individualmente — beforeSendTransaction é ignorado, então o scrub de path
// também roda no name e nos atributos http/url do span (e dos links). O tipo
// real é StreamedSpanJSON do @sentry/core (não re-exportado pelo nextjs) — a
// assinatura estrutural casa com BeforeSendStreamedSpanCallback.
export function scrubSentrySpan<
  T extends {
    name?: string;
    attributes?: Record<string, unknown>;
    links?: { attributes?: Record<string, unknown> }[];
  },
>(span: T): T {
  if (span.name) {
    span.name = scrubUrl(span.name);
  }
  scrubAttrs(span.attributes);
  for (const link of span.links ?? []) {
    scrubAttrs(link.attributes);
  }
  return span;
}

function scrubAttrs(attrs: Record<string, unknown> | undefined) {
  if (!attrs) return;
  for (const key of Object.keys(attrs)) {
    const value = attrs[key];
    if (typeof value === "string") {
      attrs[key] = scrubUrl(value);
    }
  }
}
