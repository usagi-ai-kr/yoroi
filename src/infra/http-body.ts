import { SourceError } from '../app/usage-source.js';

export const MAX_HTTP_BODY_BYTES = 1024 * 1024;

function declaredBytes(headers: Headers): number | null {
  const raw = headers.get('content-length');
  if (raw === null) return null;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return null;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) ? bytes : null;
}

function tooLarge(): SourceError {
  return new SourceError('unavailable');
}

async function cancelQuietly(body: ReadableStream<Uint8Array> | null): Promise<void> {
  if (body === null) return;
  try { await body.cancel(); } catch { /* stream already closed or errored */ }
}

export async function readLimitedBody(response: Response, signal?: AbortSignal): Promise<string> {
  const declared = declaredBytes(response.headers);
  if (declared !== null && declared > MAX_HTTP_BODY_BYTES) {
    await cancelQuietly(response.body);
    throw tooLarge();
  }
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const aborted = (): SourceError => new SourceError('cancelled');
  const onAbort = (): void => { void reader.cancel().catch(() => { /* pending read settles below */ }); };
  if (signal?.aborted) onAbort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal?.aborted) throw aborted();
      const { done, value } = await reader.read();
      if (signal?.aborted) throw aborted();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTTP_BODY_BYTES) {
        try { await reader.cancel(); } catch { /* already cancelled */ }
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
