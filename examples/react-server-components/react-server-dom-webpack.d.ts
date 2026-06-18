declare module "react-server-dom-webpack/server.node" {
  import type { ReactNode } from "react";

  export interface ClientManifestEntry {
    async?: boolean;
    chunks: Array<string>;
    id: string;
    name?: string;
  }

  export function registerClientReference<T>(
    proxyImplementation: T,
    id: string,
    exportName: string,
  ): T;

  export function renderToReadableStream(
    model: ReactNode,
    webpackMap: Record<string, ClientManifestEntry>,
    options?: {
      onError?: (error: unknown) => string | undefined;
    },
  ): Promise<ReadableStream<Uint8Array>>;
}
