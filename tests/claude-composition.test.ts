import assert from 'node:assert/strict';
import test from 'node:test';
import { compose } from '../src/composition-root.js';
import { defaultFactories } from '../src/composition/sources.js';
import type { HttpRequest } from '../src/infra/http-client.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('production Claude registry uses usage GET for once without any process invocation', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'yoroi-claude-composition-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const requests: HttpRequest[] = [], stdout: string[] = [];
  let processCalls = 0;
  const factories = defaultFactories({
    runner: { run: async () => { processCalls++; throw new Error('process forbidden'); } },
    http: { request: async request => {
      requests.push(request);
      return { status: 200, headers: {}, body: JSON.stringify({
        five_hour: { utilization: 20, resets_at: '2026-10-08T06:00:00Z' },
      }) };
    } },
  });
  const cli = compose({ dataDir, configEnv: { YOROI_PROVIDERS: 'claude',
    YOROI_CLAUDE_OAUTH_TOKEN: 'synthetic-oauth-token' }, factories,
    output: { stdout: line => stdout.push(line), stderr: () => assert.fail('unexpected CLI error') },
    subscribeSignals: () => () => {},
  });
  assert.equal(await cli.run(['once']), 0);
  assert.equal(requests.length, 1);
  assert.equal(processCalls, 0);
  for (const request of requests) {
    assert.equal(request.method, 'GET');
    assert.equal(request.url, 'https://api.anthropic.com/api/oauth/usage');
    assert.equal(request.body, undefined);
  }
  assert.equal(stdout.filter(line => line.startsWith('claude: ok')).length, 1);
  assert.equal(stdout.filter(line => line.includes('reset=2026-10-08T06:00:00.000Z')).length, 1);
});
