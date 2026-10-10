import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compose } from '../src/composition-root.js';
import { sourceIdentity, openUsagePersistence } from '../src/composition/cache.js';
import { defaultFactories } from '../src/composition/sources.js';
import { loadConfig } from '../src/config/load-config.js';
import { createSnapshot } from '../src/domain/usage.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-cache-composition-'));
  const env = { HOME: dir, YOROI_DATA_DIR: join(dir, 'data'), YOROI_PROVIDERS: 'claude' };
  const now = Date.parse('2026-01-01T00:00:01Z'); const output: string[] = [];
  const snapshot = createSnapshot('claude', new Date(now - 1000).toISOString(), [{ id: '5h', unit: 'percent', percent: 20 }]); const options = { configEnv: env, clock: () => now, output: { stdout: (s: string) => output.push(s), stderr: (s: string) => assert.fail(s) }, subscribeSignals: () => () => {} }; return { dir, env, now, snapshot, output, options, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
test('empty data directory creates private SQLite cache; restart hits and closes despite close errors', async () => {
  const h = setup(); let reads = 0, closes = 0; assert.equal(existsSync(h.env.YOROI_DATA_DIR), false);
  try {
    const options = { ...h.options, factories: { claude: () => ({ provider: 'claude' as const, read: async () => { reads++; return h.snapshot; } }) }, openUsagePersistence: () => { const p = openUsagePersistence(h.env)!; return { ...p, close: () => { closes++; p.close(); throw Error('x'); } }; } };
    assert.equal(await compose(options).run(['once']), 0); const first = [...h.output]; h.output.length = 0;
    assert.equal(statSync(h.env.YOROI_DATA_DIR).mode & 0o777, 0o700); assert.equal(statSync(join(h.env.YOROI_DATA_DIR, 'yoroi.db')).mode & 0o777, 0o600);
    assert.equal(await compose(options).run(['once']), 0); assert.deepEqual(h.output, first); assert.equal(reads, 1); assert.equal(closes, 2);
    const db = openUsageDatabase(join(h.env.YOROI_DATA_DIR, 'yoroi.db'));
    try { assert.equal(db.prepare('SELECT count(*) AS n FROM observation_samples').get()?.n, 1); } finally { db.close(); }
    assert.equal(await compose(options).run(['once', '--refresh']), 0); assert.equal(reads, 2);
  } finally { h.cleanup(); } });
test('cached production Claude source does not read Keychain, credential files or HTTP', async () => {
  const h = setup(); let external = 0;
  try {
    const p = openUsagePersistence(h.env)!; try { p.cache.set({ provider: 'claude', lookup: 'windows:all', ...sourceIdentity(loadConfig(h.env).providers[0]!, h.env) }, h.snapshot); } finally { p.close(); }
    const factories = defaultFactories({ runner: { run: async () => { external++; throw Error(); } }, http: { request: async () => { external++; throw Error(); } } });
    assert.equal(await compose({ ...h.options, factories }).run(['once']), 0); assert.equal(external, 0);
  } finally { h.cleanup(); } });
test('creation/opening failures preserve provider plain output and exit code', async () => {
  const h = setup(); let reads = 0;
  const factories = { claude: () => ({ provider: 'claude' as const, read: async () => { reads++; return h.snapshot; } }) };
  try {
    assert.equal(await compose({ ...h.options, factories, openUsagePersistence: () => undefined }).run(['once']), 0);
    assert.equal(existsSync(join(h.env.YOROI_DATA_DIR, 'yoroi.db')), false); const first = [...h.output]; h.output.length = 0;
    const blocked = join(h.dir, 'blocked'); writeFileSync(blocked, 'x');
    assert.equal(await compose({ ...h.options, factories, configEnv: { ...h.env, YOROI_DATA_DIR: blocked } }).run(['once']), 0); assert.deepEqual(h.output, first); h.output.length = 0;
    mkdirSync(h.env.YOROI_DATA_DIR); writeFileSync(join(h.env.YOROI_DATA_DIR, 'yoroi.db'), 'x');
    assert.equal(await compose({ ...h.options, factories }).run(['once']), 0); assert.equal(reads, 3);
    assert.deepEqual(h.output.filter(s => !s.startsWith('opencode-zen-free:')), first.filter(s => !s.startsWith('opencode-zen-free:')));
  } finally { h.cleanup(); } });
test('scope isolates accounts via credential digest and never embeds raw values', () => {
  const setting = { id: 'claude', executable: 'claude', timeoutMs: 1000, home: '/synthetic/home' } as const;
  const a = sourceIdentity({ ...setting, oauthToken: 'synthetic-a' }, {}); const b = sourceIdentity({ ...setting, oauthToken: 'synthetic-b' }, {});
  assert.notDeepEqual(a, b); assert.notEqual(a.scope, sourceIdentity(setting, {}).scope);
  assert.notEqual(a.scope, sourceIdentity({ ...setting, configDir: '/synthetic/other' }, {}).scope); assert.notEqual(a.scope, sourceIdentity(setting, { YOROI_CLAUDE_PROFILE: 'other' }).scope);
  assert.match(a.scope, /^[a-f0-9]{24}$/); assert.ok(!a.scope.includes('synthetic-a') && !b.scope.includes('synthetic-b')); const k = { id: 'opencode-go', executable: 'opencode-go', timeoutMs: 1000 } as const;
  assert.notEqual(sourceIdentity({ ...k, apiKey: 'key-a' }, {}).scope, sourceIdentity({ ...k, apiKey: 'key-b' }, {}).scope);
});
test('oauth token rotation misses cache, refetches and separates history', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-account-scope-'));
  const base = { HOME: dir, YOROI_DATA_DIR: join(dir, 'data'), YOROI_PROVIDERS: 'claude' };
  const envA = { ...base, YOROI_CLAUDE_OAUTH_TOKEN: 'synthetic-token-a' }; const envB = { ...base, YOROI_CLAUDE_OAUTH_TOKEN: 'synthetic-token-b' };
  const now = Date.parse('2026-01-01T00:00:01Z'); let reads = 0; const output: string[] = [];
  const snap = (percent: number) => createSnapshot('claude', new Date(now - 1000).toISOString(), [{ id: '5h', unit: 'percent', percent }]);
  const run = (env: typeof envA, percent: number) => compose({ configEnv: env, clock: () => now, output: { stdout: (s: string) => output.push(s), stderr: (s: string) => assert.fail(s) }, subscribeSignals: () => () => {}, factories: { claude: () => ({ provider: 'claude' as const, read: async () => { reads++; return snap(percent); } }) } }).run(['once']);
  try {
    assert.equal(await run(envA, 20), 0); const first = [...output]; output.length = 0;
    assert.equal(await run(envB, 30), 0); assert.notDeepEqual(output, first); assert.equal(reads, 2);
    const db = openUsageDatabase(join(base.YOROI_DATA_DIR, 'yoroi.db'));
    try { assert.equal(db.prepare('SELECT count(*) AS n FROM observation_samples').get()?.n, 2); assert.equal(db.prepare('SELECT count(DISTINCT account_scope) AS n FROM observation_samples').get()?.n, 2); } finally { db.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); } });
test('storage credential rotation at the same path changes scope and misses cache', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-storage-scope-'));
  try {
    const key = join(dir, 'id_ed25519'); writeFileSync(key, 'synthetic-key-a');
    const osetting = { id: 'ollama-pro', executable: 'o', timeoutMs: 1, signingKeyPath: key } as const;
    const oA = sourceIdentity({ ...osetting }, {}); writeFileSync(key, 'synthetic-key-b'); const oB = sourceIdentity({ ...osetting }, {});
    assert.notEqual(oA.scope, oB.scope); assert.ok(!oA.scope.includes('synthetic-key') && !oB.scope.includes('synthetic-key'));
    const cdir = join(dir, '.claude'); mkdirSync(cdir);
    const cred = (token: string, email?: string) => writeFileSync(join(cdir, '.credentials.json'), JSON.stringify({ ...(email ? { email } : {}), claudeAiOauth: { accessToken: token, expiresAt: 4102444800000 } }));
    const csetting = { id: 'claude', executable: 'claude', timeoutMs: 1, configDir: cdir } as const;
    cred('synthetic-token-a'); const cA = sourceIdentity({ ...csetting }, {});
    cred('synthetic-token-b'); const cB = sourceIdentity({ ...csetting }, {});
    assert.notEqual(cA.scope, cB.scope); assert.ok(!cA.scope.includes('synthetic-token') && !cB.scope.includes('synthetic-token'));
    cred('synthetic-token-a', 'synthetic@example.test'); const cC = sourceIdentity({ ...csetting }, {});
    cred('synthetic-token-b', 'synthetic@example.test'); const cD = sourceIdentity({ ...csetting }, {});
    assert.equal(cC.scope, cD.scope);
    const p = openUsagePersistence({ YOROI_DATA_DIR: join(dir, 'data') })!;
    const oSnap = createSnapshot('ollama-pro', '2026-01-01T00:00:00.000Z', [{ id: 'm', unit: 'token', used: 1 }]); const cSnap = createSnapshot('claude', '2026-01-01T00:00:00.000Z', [{ id: '5h', unit: 'percent', percent: 1 }]); const at = Date.parse('2026-01-01T00:00:01Z');
    p.cache.set({ provider: 'ollama-pro', lookup: 'windows:all', ...oA }, oSnap); p.cache.set({ provider: 'claude', lookup: 'windows:all', ...cA }, cSnap);
    assert.equal(p.cache.get({ provider: 'ollama-pro', lookup: 'windows:all', ...oB }, at), undefined); assert.equal(p.cache.get({ provider: 'claude', lookup: 'windows:all', ...cB }, at), undefined); p.close();
  } finally { rmSync(dir, { recursive: true, force: true }); } });
test('help/version/zen-free do not open usage persistence', async () => {
  const h = setup(); let opened = 0;
  try {
    const options = { ...h.options, openUsagePersistence: () => { opened++; throw Error('synthetic'); } };
    assert.equal(await compose(options).run(['once', '--help']), 0); assert.equal(await compose(options).run(['--version']), 0); assert.equal(opened, 0);
    const previous = process.env.YOROI_DATA_DIR; process.env.YOROI_DATA_DIR = h.env.YOROI_DATA_DIR;
    try { assert.equal(await compose(options).run(['zen-free', 'status']), 0); assert.equal(existsSync(h.env.YOROI_DATA_DIR), false); } finally { if (previous === undefined) delete process.env.YOROI_DATA_DIR; else process.env.YOROI_DATA_DIR = previous; }
    const store = { get: () => undefined, markExceeded: () => { throw Error(); }, markOk: () => ({ changed: false }), close() {} };
    assert.equal(await compose({ ...options, zenLockStore: store }).run(['zen-free']), 0); assert.equal(opened, 0);
  } finally { h.cleanup(); } });
