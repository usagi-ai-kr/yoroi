import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SourceError } from '../app/usage-source.js';

class Reader {
  private offset = 0;
  constructor(private readonly bytes: Buffer) {}
  uint(): number {
    if (this.offset + 4 > this.bytes.length) throw new Error();
    const value = this.bytes.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }
  string(): Buffer {
    const size = this.uint();
    if (size > this.bytes.length - this.offset) throw new Error();
    const value = this.bytes.subarray(this.offset, this.offset + size);
    this.offset += size;
    return value;
  }
}
export function parseOllamaKey(pem: string): (challenge: string) => string {
  try {
    const match = pem.match(/^-----BEGIN OPENSSH PRIVATE KEY-----\s+([A-Za-z0-9+/=\s]+)-----END OPENSSH PRIVATE KEY-----\s*$/);
    if (!match?.[1]) throw new Error();
    const bytes = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
    const magic = Buffer.from('openssh-key-v1\0');
    if (!bytes.subarray(0, magic.length).equals(magic)) throw new Error();
    const outer = new Reader(bytes.subarray(magic.length));
    if (outer.string().toString() !== 'none' || outer.string().toString() !== 'none' ||
      outer.string().length !== 0 || outer.uint() !== 1) throw new Error();
    const publicBlob = outer.string();
    const inner = new Reader(outer.string());
    if (inner.uint() !== inner.uint() || inner.string().toString() !== 'ssh-ed25519') throw new Error();
    const publicRaw = inner.string();
    const privateRaw = inner.string();
    if (privateRaw.length !== 64 || publicRaw.length !== 32) throw new Error();
    const key = createPrivateKey({ format: 'der', type: 'pkcs8', key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'), privateRaw.subarray(0, 32),
    ]) });
    const derived = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
    const pub = new Reader(publicBlob);
    if (!derived.equals(publicRaw) || !derived.equals(privateRaw.subarray(32)) ||
      pub.string().toString() !== 'ssh-ed25519' || !pub.string().equals(derived)) throw new Error();
    return challenge => `${publicBlob.toString('base64')}:${sign(null, Buffer.from(challenge), key).toString('base64')}`;
  } catch { throw new SourceError('authentication'); }
}
export type OllamaAuthorization = (challenge: string) => Promise<string>;
export function fileOllamaAuthorization(path: string): OllamaAuthorization {
  return async challenge => {
    try { return parseOllamaKey(await readFile(path, 'utf8'))(challenge); }
    catch { throw new SourceError('authentication'); }
  };
}
