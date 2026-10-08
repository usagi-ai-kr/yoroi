import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

async function files(directory: string): Promise<string[]> {
  const children = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(children.map(child => child.isDirectory()
    ? files(resolve(directory, child.name)) : [resolve(directory, child.name)]))).flat();
}
test('domain/app/CLI imports enforce the Clean Architecture dependency direction', async () => {
  const root = resolve('src');
  for (const file of await files(root)) {
    if (!file.endsWith('.ts')) continue;
    const layer = relative(root, file).split('/')[0];
    if (!['domain', 'app', 'ui'].includes(layer!)) continue;
    const source = await readFile(file, 'utf8');
    const imports = /(?:\bfrom\s*|\bimport\s*|\b(?:import|require)\s*\()(['"])([^'"]+)\1/g;
    for (const match of source.matchAll(imports)) {
        const text = match[2]!;
        const target = text.startsWith('.') ? relative(root, resolve(dirname(file), text)).split('/')[0] : text;
        const allowed = layer === 'domain' ? ['domain'] : layer === 'app' ? ['app', 'domain'] : ['ui', 'app', 'domain'];
        assert.ok(allowed.includes(target!) || (layer === 'ui' && text.startsWith('node:')),
          `${relative(root, file)} must not depend on ${text}`);
    }
  }
});
