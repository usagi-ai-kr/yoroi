import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
// @ts-expect-error script module
import { copyEnv } from '../scripts/copy-env.mjs';

function withTemp(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-env-test-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('creates destination file with 0600 mode even under umask 022', () => withTemp((dir) => {
  const src = path.join(dir, 'source.env');
  const dst = path.join(dir, 'target.env');
  fs.writeFileSync(src, 'SYNTHETIC_KEY=synthetic_val\n');
  const prevUmask = process.umask(0o022);
  try {
    const copied = copyEnv(src, dst);
    assert.equal(copied, true);
    const stat = fs.statSync(dst);
    assert.equal((stat.mode & 0o777).toString(8), '600');
    assert.equal(fs.readFileSync(dst, 'utf8'), 'SYNTHETIC_KEY=synthetic_val\n');
  } finally {
    process.umask(prevUmask);
  }
}));

test('atomically replaces existing target file with new content and 0600 mode', () => withTemp((dir) => {
  const src = path.join(dir, 'src.env');
  const dst = path.join(dir, 'dst.env');
  fs.writeFileSync(src, 'REPLACED_KEY=synthetic_2\n');
  fs.writeFileSync(dst, 'OLD_KEY=old_val\n', { mode: 0o644 });
  const copied = copyEnv(src, dst);
  assert.equal(copied, true);
  assert.equal(fs.readFileSync(dst, 'utf8'), 'REPLACED_KEY=synthetic_2\n');
  assert.equal((fs.statSync(dst).mode & 0o777).toString(8), '600');
}));

test('replaces symlink directly without modifying the link target', () => withTemp((dir) => {
  const originalTarget = path.join(dir, 'original.env');
  fs.writeFileSync(originalTarget, 'ORIGINAL=synthetic_orig\n');
  const linkPath = path.join(dir, 'link.env');
  fs.symlinkSync(originalTarget, linkPath);

  const src = path.join(dir, 'new.env');
  fs.writeFileSync(src, 'REPLACEMENT=synthetic_new\n');

  const copied = copyEnv(src, linkPath);
  assert.equal(copied, true);
  assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(linkPath, 'utf8'), 'REPLACEMENT=synthetic_new\n');
  assert.equal(fs.readFileSync(originalTarget, 'utf8'), 'ORIGINAL=synthetic_orig\n');
}));

test('silently skips when source .env does not exist without creating target', () => withTemp((dir) => {
  const src = path.join(dir, 'nonexistent.env');
  const dst = path.join(dir, 'target.env');
  const copied = copyEnv(src, dst);
  assert.equal(copied, false);
  assert.equal(fs.existsSync(dst), false);
}));

test('cleans up temporary file and leaves no residuals when copy fails', () => withTemp((dir) => {
  const src = path.join(dir, 'unreadable.env');
  fs.writeFileSync(src, 'DUMMY=1\n');
  fs.chmodSync(src, 0o000);
  const dst = path.join(dir, 'target.env');
  assert.throws(() => copyEnv(src, dst));
  const remaining = fs.readdirSync(dir).filter(f => f.startsWith('.env.tmp'));
  assert.deepEqual(remaining, []);
}));
