import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

test('development documentation local Markdown links point to existing files', async () => {
  for (const name of await readdir('docs')) {
    if (!name.endsWith('.md')) continue;
    const file = resolve('docs', name);
    const content = await readFile(file, 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1]!.split('#')[0]!;
      if (!target || /^https?:/.test(target)) continue;
      await assert.doesNotReject(access(resolve(dirname(file), target)), `${name}: ${target}`);
    }
  }
});
