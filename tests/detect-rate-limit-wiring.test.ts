import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { runDetectCycle, type DetectCycleDeps } from '../src/composition/detect.js';
import { loadConfig } from '../src/config/load-config.js';
import { rateLimitDelayMs } from '../src/domain/errors.js';
import { SourceError } from '../src/app/usage-source.js';
import { OpenCodeGoSource } from '../src/infra/opencode-go-source.js';
import { ClaudeSource } from '../src/infra/claude-source.js';
import { OllamaSource } from '../src/infra/ollama-source.js';
import type { HttpClient, HttpResponse } from '../src/infra/http-client.js';

const T0 = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000;

/** Fake HttpClient that always answers with the given status/headers. Counts calls. */
function fake(status: number, headers: Record<string, string> = {}): HttpClient & { calls: number } {
  return { calls: 0, async request(): Promise<HttpResponse> { this.calls++;
    return { status, headers, body: '{}' }; } };
}

function harness(t: TestContext, client: HttpClient) {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-wire-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dataEnv = { YOROI_DATA_DIR: dir }, env = { ...dataEnv, YOROI_PROVIDERS: 'opencode-go', HOME: dir };
  const sim = { now: T0 };
  const factories = { 'opencode-go': () => new OpenCodeGoSource(client, 'k', 10_000,
    () => new Date(sim.now).toISOString()) };
  const deps = (): DetectCycleDeps => ({ config: loadConfig(env), env, dataEnv, now: () => sim.now,
    owner: 'detector-a', intervalMs: 5 * MIN, platform: 'linux', factories,
    thresholds: { surgePercentPoints: 20, staleAfterMs: 45 * MIN, pluginStaleGraceMs: 10 * MIN } });
  const at = async (minutes: number) => { sim.now = T0 + minutes * MIN; return runDetectCycle(deps()); };
  return { at, sim };
}

test('D1 wiring: the real opencode-go adapter turns 429 + Retry-After 3600 into a 60-minute cooldown',
  async t => {
    const client = fake(429, { 'retry-after': '3600' });
    const h = harness(t, client);
    const first = await h.at(0);
    assert.deepEqual(first.errors, ['usage:opencode-go:unavailable'],
      'the first attempt fails loudly; the marker is what pushes the next one out');
    assert.equal(client.calls, 1, 'the adapter really was called');
    for (const minutes of [5, 10, 14, 15, 29]) {
      await h.at(minutes);
      assert.equal(client.calls, 1, `no real HTTP call at +${minutes}m; the server asked for 60 minutes`); }
    await h.at(60);
    assert.equal(client.calls, 2, 'the adapter is called again once the server delay has passed'); });

test('F4/F5 wiring: an absurd Retry-After keeps the SourceError and the stored cooldown is capped at 24 hours',
  async t => {
    for (const value of ['99999999999999999999', '9007199254740']) {
      await assert.rejects(() => new OpenCodeGoSource(fake(429, { 'retry-after': value }), 'k').read(), (error: unknown) => {
        assert.ok(error instanceof SourceError && error.code === 'unavailable', `${value}: still a SourceError`);
        assert.equal(rateLimitDelayMs(error), 86_400_000); return true; }); }
    const client = fake(429, { 'retry-after': '99999999999999999999' }), h = harness(t, client);
    assert.deepEqual((await h.at(0)).errors, ['usage:opencode-go:unavailable'], 'diagnostics keep the SourceError code, not "error"');
    for (const minutes of [60, 12 * 60, 23 * 60 + 50]) { await h.at(minutes); assert.equal(client.calls, 1, `+${minutes}m`); }
    await h.at(24 * 60 + 1); assert.equal(client.calls, 2, 'the cooldown ends after the 24 hour cap, not never'); });

test('D1 wiring: every adapter keeps its SourceError code and only gains the marker', async () => {
  const go = fake(429, { 'retry-after': '3600' });
  await assert.rejects(() => new OpenCodeGoSource(go, 'k').read(), (error: unknown) => {
    assert.ok(error instanceof SourceError);
    assert.equal(error.code, 'unavailable', 'the normalized code is unchanged');
    assert.equal(rateLimitDelayMs(error), 3_600_000);
    return true; });
  const claude = fake(429, { 'Retry-After': '120' });
  await assert.rejects(() => new ClaudeSource(claude, async () => 'tok').read(), (error: unknown) => {
    assert.equal((error as SourceError).code, 'unavailable');
    assert.equal(rateLimitDelayMs(error), 120_000, 'header lookup is case-insensitive');
    return true; });
  const ollama = fake(429, { 'retry-after': '60' });
  await assert.rejects(() => new OllamaSource(ollama, async () => 'auth').read(), (error: unknown) => {
    assert.equal((error as SourceError).code, 'unavailable');
    assert.equal(rateLimitDelayMs(error), 60_000);
    return true; }); });

test('D1 wiring: a 429 without Retry-After is left unmarked, so behaviour does not change', async () => {
  for (const headers of [{}, { 'retry-after': 'not-a-number' }, { 'retry-after': '-5' }]) {
    const client = fake(429, headers);
    await assert.rejects(() => new OpenCodeGoSource(client, 'k').read(), (error: unknown) => {
      assert.equal((error as SourceError).code, 'unavailable');
      assert.equal(rateLimitDelayMs(error), undefined, `unmarked for ${JSON.stringify(headers)}`);
      return true; }); } });

test('D1 wiring: non-429 failures are never marked as rate limits', async () => {
  for (const status of [401, 403, 500, 503]) {
    const client = fake(status, { 'retry-after': '3600' });
    await assert.rejects(() => new OpenCodeGoSource(client, 'k').read(), (error: unknown) => {
      const code = (error as SourceError).code;
      assert.equal(code, status === 401 || status === 403 ? 'authentication' : 'unavailable', `status ${status}`);
      assert.equal(rateLimitDelayMs(error), undefined, `status ${status} carries no rate-limit marker`);
      return true; }); } });