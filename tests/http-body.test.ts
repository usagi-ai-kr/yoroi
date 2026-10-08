import assert from "node:assert/strict";
import test from "node:test";
import { SourceError } from "../src/app/usage-source.js";
import { MAX_HTTP_BODY_BYTES, readLimitedBody } from "../src/infra/http-body.js";

const encoder = new TextEncoder();

const streamOf = (bytes: Uint8Array, sliceBytes: number, onCancel?: () => void): ReadableStream<Uint8Array> => {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.byteLength) { controller.close(); return; }
      controller.enqueue(bytes.subarray(offset, offset + sliceBytes));
      offset += sliceBytes;
    },
    cancel() { onCancel?.(); },
  });
};

const response = (body: ReadableStream<Uint8Array> | null, declared?: string): Response => {
  const headers = new Headers();
  if (declared !== undefined) headers.set("content-length", declared);
  return { status: 200, headers, body } as unknown as Response;
};

const rejectsUnavailable = (run: () => Promise<unknown>): Promise<void> => assert.rejects(
  run, (error: unknown) => error instanceof SourceError && error.code === "unavailable");

test("accepts exactly 1 MiB and rejects one byte over", async () => {
  const exact = new Uint8Array(MAX_HTTP_BODY_BYTES).fill(0x61);
  assert.equal((await readLimitedBody(response(streamOf(exact, 65536)))).length, MAX_HTTP_BODY_BYTES);

  const over = new Uint8Array(MAX_HTTP_BODY_BYTES + 1).fill(0x61);
  await rejectsUnavailable(() => readLimitedBody(response(streamOf(over, 65536))));
});

test("declared Content-Length above the limit is rejected before reading and cancels the stream", async () => {
  let cancelled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { pulls += 1; controller.enqueue(encoder.encode("x")); },
    cancel() { cancelled = true; },
  });

  await rejectsUnavailable(() => readLimitedBody(response(body, String(MAX_HTTP_BODY_BYTES + 1))));
  assert.equal(cancelled, true);
  assert.equal(pulls, 0);
});

test("false or missing Content-Length is ignored while chunks accumulate", async () => {
  const bytes = encoder.encode('{"ok":true}');
  assert.equal(await readLimitedBody(response(streamOf(bytes, 1), "3")), '{"ok":true}');
  assert.equal(await readLimitedBody(response(streamOf(bytes, 1))), '{"ok":true}');
});

test("accumulated chunks over the limit are rejected and the reader cancels the stream", async () => {
  let cancelled = false;
  const over = new Uint8Array(MAX_HTTP_BODY_BYTES + 10).fill(0x61);

  await rejectsUnavailable(() => readLimitedBody(response(streamOf(over, 8192, () => { cancelled = true; }))));
  assert.equal(cancelled, true);
});

test("UTF-8 multibyte characters split across chunk boundaries survive decoding", async () => {
  const text = "사용량 100% ✅";
  const bytes = encoder.encode(text);
  assert.equal(await readLimitedBody(response(streamOf(bytes, 3))), text);
  assert.equal(await readLimitedBody(response(streamOf(bytes, 1))), text);
});

test("null body is empty and still honors an oversize declared length", async () => {
  assert.equal(await readLimitedBody(response(null)), "");
  await rejectsUnavailable(() => readLimitedBody(response(null, String(MAX_HTTP_BODY_BYTES + 1))));
});

test("abort while a body read is pending cancels the reader and reports cancelled", async () => {
  let cancelled = false;
  let sent = false;
  const controller = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    pull(stream) { if (!sent) { sent = true; stream.enqueue(encoder.encode("partial")); } },
    cancel() { cancelled = true; },
  });
  const running = readLimitedBody(response(body), controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(running,
    (error: unknown) => error instanceof SourceError && error.code === "cancelled");
  assert.equal(cancelled, true);
});

test("an already aborted signal cancels the reader without reading a chunk", async () => {
  let cancelled = false;
  const controller = new AbortController();
  controller.abort();
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  await assert.rejects(readLimitedBody(response(body), controller.signal),
    (error: unknown) => error instanceof SourceError && error.code === "cancelled");
  assert.equal(cancelled, true);
});
