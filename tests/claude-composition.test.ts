import assert from 'node:assert/strict';
import test from 'node:test';
import { compose } from '../src/composition-root.js';
import { defaultFactories } from '../src/composition/sources.js';
import type { HttpRequest } from '../src/infra/http-client.js';

test('production Claude registry uses usage GET for once/watch without any process invocation', async () => {
  const requests: HttpRequest[] = [], stdout: string[] = [];
  let processCalls = 0, sleeps = 0, stop: (() => void) | undefined;
  const factories = defaultFactories({
    runner: { run: async () => { processCalls++; throw new Error('process forbidden'); } },
    http: { request: async request => {
      requests.push(request);
      return { status: 200, headers: {}, body: JSON.stringify({
        five_hour: { utilization: 20, resets_at: '2026-10-08T06:00:00Z' },
      }) };
    } },
  });
  const cli = compose({ configEnv: { YOROI_PROVIDERS: 'claude',
    YOROI_CLAUDE_OAUTH_TOKEN: 'synthetic-oauth-token' }, factories,
    output: { stdout: line => stdout.push(line), stderr: () => assert.fail('unexpected CLI error') },
    scheduler: { sleep: async ms => { assert.equal(ms, 60000); if (++sleeps === 2) stop?.(); } },
    subscribeSignals: handler => { stop = handler; return () => { stop = undefined; }; },
  });
  assert.equal(await cli.run(['once']), 0);
  assert.equal(await cli.run(['watch']), 0);
  assert.equal(requests.length, 3);
  assert.equal(processCalls, 0);
  for (const request of requests) {
    assert.equal(request.method, 'GET');
    assert.equal(request.url, 'https://api.anthropic.com/api/oauth/usage');
    assert.equal(request.body, undefined);
  }
  assert.equal(stdout.filter(line => line.startsWith('claude: ok')).length, 3);
  assert.equal(stdout.filter(line => line.includes('reset=2026-10-08T06:00:00.000Z')).length, 3);
});
