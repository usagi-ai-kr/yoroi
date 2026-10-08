import { SourceError } from '../app/usage-source.js';

export interface HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
}
export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}
export interface HttpClient {
  request(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse>;
}
export class NodeHttpClient implements HttpClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async request(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse> {
    if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0 || request.timeoutMs > 86400000) {
      throw new SourceError('unavailable');
    }
    if (signal?.aborted) throw new SourceError('cancelled');
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, request.timeoutMs);
    try {
      const init: RequestInit = { method: request.method, signal: controller.signal,
        redirect: 'error' };
      if (request.headers !== undefined) init.headers = { ...request.headers };
      if (request.body !== undefined) init.body = request.body;
      const response = await this.fetcher(request.url, init);
      return { status: response.status, headers: Object.fromEntries(response.headers),
        body: await response.text() };
    } catch {
      throw new SourceError(signal?.aborted ? 'cancelled' : timedOut ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}
