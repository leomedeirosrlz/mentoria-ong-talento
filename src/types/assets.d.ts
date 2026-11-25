// Declarações dos imports-asset do explorador (REALIZA-417 fase B): as
// regras turbopack do next.config (`type: "asset"`) fazem o import desses
// arquivos devolver a URL emitida como string — não o conteúdo.

declare module "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm" {
  const url: string;
  export default url;
}

declare module "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm" {
  const url: string;
  export default url;
}

declare module "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js" {
  const url: string;
  export default url;
}

declare module "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js" {
  const url: string;
  export default url;
}
