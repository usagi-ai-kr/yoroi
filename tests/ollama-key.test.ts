import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import { parseOllamaKey, fileOllamaAuthorization } from '../src/infra/ollama-key.js';
import { SourceError } from '../src/app/usage-source.js';

function uint(value: number) { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; }
function field(value: Buffer | string) {
  const bytes = Buffer.from(value);
  return Buffer.concat([uint(bytes.length), bytes]);
}
function fixture(options: { mismatch?: boolean; encrypted?: boolean; truncated?: boolean } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  const blob = Buffer.concat([field('ssh-ed25519'), field(options.mismatch ? Buffer.alloc(32) : raw)]);
  const inner = Buffer.concat([uint(42), uint(42), field('ssh-ed25519'), field(raw),
    field(Buffer.concat([seed, raw])), field('synthetic'), Buffer.from([1, 2, 3])]);
  let bytes = Buffer.concat([Buffer.from('openssh-key-v1\0'), field(options.encrypted ? 'aes256-ctr' : 'none'),
    field('none'), field(''), uint(1), field(blob), field(inner)]);
  if (options.truncated) bytes = bytes.subarray(0, bytes.length - 12);
  return { publicKey, blob, pem: `-----BEGIN OPENSSH PRIVATE KEY-----\n${bytes.toString('base64')}\n-----END OPENSSH PRIVATE KEY-----\n` };
}
test('OpenSSH Ollama key produces a verifiable Ed25519 signature and SSH public header', () => {
  const { publicKey, blob, pem } = fixture();
  const challenge = 'GET,/api/usage?ts=1791331200';
  const [header, signature] = parseOllamaKey(pem)(challenge).split(':');
  assert.equal(header, blob.toString('base64'));
  assert.ok(verify(null, Buffer.from(challenge), publicKey, Buffer.from(signature!, 'base64')));
  assert.equal(verify(null, Buffer.from('different'), publicKey, Buffer.from(signature!, 'base64')), false);
});
test('missing, encrypted, mismatched and truncated signing keys are safe authentication errors', async () => {
  for (const options of [{ encrypted: true }, { mismatch: true }, { truncated: true }]) {
    assert.throws(() => parseOllamaKey(fixture(options).pem), new SourceError('authentication'));
  }
  assert.throws(() => parseOllamaKey('secret'), new SourceError('authentication'));
  await assert.rejects(fileOllamaAuthorization('/nonexistent/secret')('GET,/api/usage'),
    new SourceError('authentication'));
});
