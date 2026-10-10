import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceIdentity } from '../src/composition/cache.js';
import { claudeAuthorization } from '../src/infra/claude-credentials.js';
import { claudeCredentialPath } from '../src/infra/claude-credential-source.js';

for (const platform of ['linux', 'darwin']) {
  test(`${platform}: loader and scope follow the same file when config and secure storage differ`, async t => {
    const home = mkdtempSync(join(tmpdir(), 'yoroi-scope-alignment-'));
    t.after(() => rmSync(home, { recursive: true, force: true }));
    const configDir = join(home, 'config'), secureStorageConfigDir = join(home, 'secure');
    const settings = { id: 'claude', executable: 'claude', timeoutMs: 1000,
      home, configDir, secureStorageConfigDir } as const;
    const write = (dir: string, account: string) => writeFileSync(join(dir, '.credentials.json'),
      JSON.stringify({ email: `${account}@example.test`, claudeAiOauth: {
        accessToken: `synthetic-${account}`, expiresAt: 4102444800000,
      } }));
    mkdirSync(configDir); mkdirSync(secureStorageConfigDir);
    write(configDir, 'config-a'); write(secureStorageConfigDir, 'secure-a');
    const active = platform === 'darwin' ? secureStorageConfigDir : configDir;
    const inactive = platform === 'darwin' ? configDir : secureStorageConfigDir;
    const expectedPath = join(active, '.credentials.json');
    assert.equal(claudeCredentialPath({ ...settings, platform }), expectedPath);
    let reads = 0, keychainReads = 0;
    const auth = claudeAuthorization({ ...settings, platform, account: 'synthetic-user', now: () => 1,
      readFile: async path => { reads++; assert.equal(path, expectedPath); return readFileSync(path, 'utf8'); },
    }, { run: async () => { keychainReads++; return { exitCode: 44, stdout: '', stderr: '' }; } });
    const before = sourceIdentity(settings, {}, platform);
    assert.equal(await auth(), `synthetic-${platform === 'darwin' ? 'secure-a' : 'config-a'}`);
    write(inactive, 'inactive-b');
    assert.deepEqual(sourceIdentity(settings, {}, platform), before);
    write(active, 'active-b');
    const after = sourceIdentity(settings, {}, platform);
    assert.notEqual(after.scope, before.scope);
    assert.match(after.scope, /^[a-f0-9]{24}$/);
    assert.equal(await auth(), 'synthetic-active-b');
    assert.equal(reads, 2); assert.equal(keychainReads, platform === 'darwin' ? 2 : 0);
  });
}

test('credential path defaults and empty profiles preserve platform boundaries', () => {
  for (const platform of ['linux', 'darwin']) {
    assert.equal(claudeCredentialPath({ platform, home: '/synthetic/home' }),
      '/synthetic/home/.claude/.credentials.json');
    assert.equal(claudeCredentialPath({ platform }), undefined);
    assert.equal(claudeCredentialPath({ platform, configDir: '', home: '/synthetic/home' }), undefined);
  }
  assert.equal(claudeCredentialPath({ platform: 'linux', configDir: '/synthetic/config',
    secureStorageConfigDir: '' }), '/synthetic/config/.credentials.json');
  assert.equal(claudeCredentialPath({ platform: 'darwin', configDir: '/synthetic/config',
    secureStorageConfigDir: '' }), undefined);
});
