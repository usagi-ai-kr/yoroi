import assert from 'node:assert/strict';
import test from 'node:test';
import { claudePrincipal, parseClaudeCredentials } from '../src/infra/claude-principal.js';

const FUTURE = 4102444800000;
const dump = (token: string, top: Record<string, unknown> = {}, oauth: Record<string, unknown> = {}) =>
  JSON.stringify({ ...top, claudeAiOauth: { accessToken: token, expiresAt: FUTURE, ...oauth } });

test('same user id with a refreshed token keeps the principal', () => {
  const a = claudePrincipal(dump('synthetic-token-1', { email: 'user@example.test' }));
  assert.equal(a, claudePrincipal(dump('synthetic-token-2', { email: 'user@example.test' })));
  assert.match(a!, /^stable-[a-f0-9]{16}$/);
  assert.equal(claudePrincipal(dump('t1', {}, { accountId: 'acct-1' })), claudePrincipal(dump('t2', { accountId: 'acct-1' })));
});
test('different users in the same organization or subscription get different principals', () => {
  const org = { organizationId: 'org-shared', subscriptionId: 'sub-shared' };
  const a = claudePrincipal(dump('synthetic-a', { accountId: 'acct-a' }, org));
  const b = claudePrincipal(dump('synthetic-a', { accountId: 'acct-b' }, org));
  assert.notEqual(a, b);
});
test('organization and subscription ids are never account identifiers', () => {
  const org = { organizationId: 'org-shared', subscriptionId: 'sub-shared' };
  const a = claudePrincipal(dump('synthetic-a', {}, org)), b = claudePrincipal(dump('synthetic-b', {}, org));
  assert.match(a!, /^cred-[a-f0-9]{16}$/); assert.notEqual(a, b);
});
test('without a user id a refreshed token changes the principal by design (isolation over continuity)', () => {
  assert.notEqual(claudePrincipal(dump('synthetic-1')), claudePrincipal(dump('synthetic-2')));
});
test('principals never embed raw tokens or user ids', () => {
  for (const value of [claudePrincipal(dump('synthetic-secret', { email: 'user@example.test' })),
    claudePrincipal(dump('synthetic-secret'))]) {
    assert.ok(value && !value.includes('synthetic') && !value.includes('example'));
  }
});
test('strict parse still rejects expired or malformed credentials and unreadable dumps give no principal', () => {
  assert.throws(() => parseClaudeCredentials(dump('t', {}, { expiresAt: 1 }), 2), { code: 'authentication' });
  assert.throws(() => parseClaudeCredentials('{', 1), { code: 'authentication' });
  assert.throws(() => parseClaudeCredentials(JSON.stringify({ claudeAiOauth: null }), 1), { code: 'authentication' });
  assert.equal(claudePrincipal('{'), undefined);
  assert.equal(parseClaudeCredentials(dump(' tok '), 1).token, 'tok');
});
