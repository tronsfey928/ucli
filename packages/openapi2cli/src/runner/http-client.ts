import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import chalk from 'chalk';
import * as http from 'http';
import * as https from 'https';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { RuntimeClient, RequestOptions, Middleware } from '../types/index';

export interface RuntimeAuth {
  bearer?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  basic?: string;
  extraHeaders?: Record<string, string>;
}

export interface RuntimeClientOptions {
  /** Request timeout in milliseconds. Default: 30 000 ms. */
  timeout?: number;
  /** Maximum number of retry attempts for retryable errors. Default: 3. */
  maxRetries?: number;
  /** Middleware functions applied to every request() call. */
  middleware?: Middleware[];
}

export { RequestOptions };

// Status codes that warrant a retry
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
// Node.js error codes that warrant a retry
const RETRYABLE_CODES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const axErr = err as { response?: { status: number }; code?: string };
      const status = axErr.response?.status;
      const code = axErr.code;
      const isRetryable =
        (status !== undefined && RETRYABLE_STATUS.has(status)) ||
        (code !== undefined && RETRYABLE_CODES.has(code));

      if (!isRetryable || attempt >= maxRetries) throw err;

      // Exponential backoff: 500 ms, 1 000 ms, 2 000 ms, … capped at 8 000 ms
      await sleep(Math.min(500 * Math.pow(2, attempt), 8_000));
    }
  }
}

function buildAuthHeaders(auth: RuntimeAuth): Record<string, string> {
  const headers: Record<string, string> = {};
  if (auth.bearer) {
    headers['Authorization'] = `Bearer ${auth.bearer}`;
  } else if (auth.apiKey) {
    headers[auth.apiKeyHeader ?? 'X-Api-Key'] = auth.apiKey;
  } else if (auth.basic) {
    headers['Authorization'] = `Basic ${Buffer.from(auth.basic).toString('base64')}`;
  }
  for (const [k, v] of Object.entries(auth.extraHeaders ?? {})) {
    headers[k] = v;
  }
  return headers;
}

function buildUrl(pathTemplate: string, pathParams: Record<string, string>): string {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = pathParams[key];
    if (val === undefined) throw new Error(`Missing required path parameter: ${key}`);
    return encodeURIComponent(val);
  });
}

function parseLinkNext(linkHeader: string | undefined): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

// Shared keep-alive agents so connections are reused across paginated requests.
const sharedHttpAgent  = new http.Agent({ keepAlive: true });
const sharedHttpsAgent = new https.Agent({ keepAlive: true });

// Safety limit for allPages pagination to prevent infinite loops.
const MAX_PAGES = 1000;

/**
 * Compose an array of middleware into a single function that wraps `coreFn`.
 *
 * Middleware is applied in order: the first middleware in the array is the
 * outermost wrapper (runs first on the way in, last on the way out).
 */
function composeMiddleware(
  middleware: Middleware[],
  coreFn: (opts: RequestOptions) => Promise<unknown>,
): (opts: RequestOptions) => Promise<unknown> {
  return middleware.reduceRight<(opts: RequestOptions) => Promise<unknown>>(
    (next, mw) => (opts) => mw(opts, next),
    coreFn,
  );
}

export function createRuntimeClient(
  baseURL: string,
  auth: RuntimeAuth,
  options: RuntimeClientOptions = {},
): RuntimeClient {
  const timeout    = options.timeout    ?? 30_000;
  const maxRetries = options.maxRetries ?? 3;
  const middleware  = options.middleware ?? [];

  const instance: AxiosInstance = axios.create({
    baseURL,
    proxy: false,
    timeout,
    httpAgent:  sharedHttpAgent,
    httpsAgent: sharedHttpsAgent,
  });

  // Core request implementation (before middleware).
  const coreRequest = async ({
    method, path, pathParams, queryParams, headers: extraReqHeaders, body, verbose, allPages,
  }: RequestOptions): Promise<unknown> => {
    const url = buildUrl(path, pathParams);
    const authHeaders = buildAuthHeaders(auth);
    const mergedHeaders = { ...authHeaders, ...extraReqHeaders };
    const config: AxiosRequestConfig = {
        method,
        url,
        params: Object.keys(queryParams).length ? queryParams : undefined,
        data: body,
        headers: mergedHeaders,
      };

      if (verbose) {
        console.error(chalk.dim('→'), chalk.bold(method.toUpperCase()), baseURL + url);
        if (body !== undefined) console.error(chalk.dim('  body:'), JSON.stringify(body));
      }

      if (allPages) {
        const results: unknown[] = [];
        let nextUrl: string | null = url;
        let isFirst = true;
        const visited = new Set<string>();
        let pageCount = 0;
        while (nextUrl) {
          if (++pageCount > MAX_PAGES) {
            throw new Error(`Pagination limit exceeded (${MAX_PAGES} pages). Use --query or filters to reduce results.`);
          }
          if (visited.has(nextUrl)) {
            throw new Error(`Pagination loop detected: ${nextUrl} was already visited.`);
          }
          visited.add(nextUrl);
          const pageConfig: AxiosRequestConfig = isFirst
            ? { ...config }
            : { method, url: nextUrl, headers: mergedHeaders, timeout };
          isFirst = false;
          const response: AxiosResponse = await withRetry(
            () => instance.request(pageConfig),
            maxRetries,
          );
          if (verbose) console.error(chalk.dim('←'), chalk.bold(String(response.status)), response.statusText);
          const data = response.data;
          if (Array.isArray(data)) results.push(...data);
          else results.push(data);
          nextUrl = parseLinkNext(response.headers['link'] as string | undefined);
        }
        return results;
      }

      const response: AxiosResponse = await withRetry(
        () => instance.request(config),
        maxRetries,
      );
      if (verbose) console.error(chalk.dim('←'), chalk.bold(String(response.status)), response.statusText);
      return response.data;
    };

    // Wrap core request with middleware chain.
    const wrappedRequest = middleware.length > 0
      ? composeMiddleware(middleware, coreRequest)
      : coreRequest;

    return {
      request: wrappedRequest,

      async *requestStream({
      method, path, pathParams, queryParams, headers: extraReqHeaders, body, verbose,
    }: RequestOptions): AsyncGenerator<string, void, unknown> {
      const url = buildUrl(path, pathParams);
      const qs = new URLSearchParams(queryParams).toString();
      const fullUrl = baseURL + url + (qs ? `?${qs}` : '');
      const authHeaders = buildAuthHeaders(auth);
      const fetchHeaders: Record<string, string> = {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...authHeaders,
        ...extraReqHeaders,
      };
      if (body !== undefined) {
        fetchHeaders['Content-Type'] = 'application/json';
      }

      if (verbose) console.error(chalk.dim('→ SSE'), chalk.bold(method.toUpperCase()), fullUrl);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      let response: Response;
      try {
        response = await fetch(fullUrl, {
          method,
          headers: fetchHeaders,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      if (!response.body) return;

      if (verbose) console.error(chalk.dim('← SSE'), chalk.bold(String(response.status)), response.statusText);

      const eventStream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());

      for await (const event of eventStream) {
        if (event.data && event.data !== '[DONE]') {
          yield event.data;
        }
      }
    },
  };
}
