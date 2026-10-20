import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  FileModelRegistrySnapshotStore,
  ModelRegistryStoreError,
  snapshotFileName,
} from '../src/insights/model-discovery-file-store.js';
import type { ModelRegistrySnapshot } from '../src/insights/model-discovery-types.js';

const snapshot = (over: Partial<ModelRegistrySnapshot> = {}): ModelRegistrySnapshot => ({
  generation: 3, observedAt: '2026-10-20T00:00:00.000Z', providerId: 'opencode',
  models: [
    { modelId: 'muse-spark-1-3', displayName: 'Muse Spark 1.3', sourceUrl: 'https://opencode.ai/go',
      checkedOn: '2026-10-20', verified: true, planIds: ['opencode-go-plus'], efforts: ['xhigh'] },
    { modelId: 'gpt-6-luna', displayName: 'GPT 6 Luna', sourceUrl: 'https://opencode.ai/go',
      checkedOn: '2026-10-20', verified: true, planIds: ['opencode-go-plus'], free: true },
  ], ...over });
const withDir = (fn: (dir: string, store: FileModelRegistrySnapshotStore) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-discovery-store-'));
  return fn(dir, new FileModelRegistrySnapshotStore(join(dir, 'registry'))).finally(() => rmSync(dir, { recursive: true, force: true }));
};

test('왕복: 저장한 스냅샷이 그대로 읽힌다(모델 순서·내용 보존)', async () => {
  await withDir(async (_dir, store) => {
    const input = snapshot();
    await store.write(input);
    const read = await store.read('opencode');
    assert.deepEqual(read, input);
    assert.deepEqual(read?.models.map(m => m.modelId), ['muse-spark-1-3', 'gpt-6-luna']);
  });
});

test('없는 파일은 undefined를 돌려준다', async () => {
  await withDir(async (_dir, store) => {
    assert.equal(await store.read('opencode'), undefined);
  });
});

test('파손 JSON·잘못된 형태는 undefined가 아니라 throw한다(fail-closed)', async () => {
  await withDir(async (dir, store) => {
    await store.write(snapshot());
    const file = join(dir, 'registry', snapshotFileName('opencode'));
    writeFileSync(file, '{oops');
    await assert.rejects(() => store.read('opencode'), (e: unknown) => e instanceof ModelRegistryStoreError);
    writeFileSync(file, JSON.stringify({ generation: 0, observedAt: 'x', providerId: 'opencode', models: [] }));
    await assert.rejects(() => store.read('opencode'), (e: unknown) => e instanceof ModelRegistryStoreError);
    writeFileSync(file, JSON.stringify({ generation: 1, observedAt: '', providerId: 'opencode', models: [] }));
    await assert.rejects(() => store.read('opencode'), (e: unknown) => e instanceof ModelRegistryStoreError);
    writeFileSync(file, JSON.stringify({ generation: 1, observedAt: 'x', providerId: 'other', models: [] }));
    await assert.rejects(() => store.read('opencode'), (e: unknown) => e instanceof ModelRegistryStoreError);
  });
});

test('위험한 providerId는 거부되고 경로를 벗어나지 않는다', async () => {
  await withDir(async (dir, store) => {
    for (const id of ['', '   ', '../escape', 'a/b', 'a\\b', '..']) {
      assert.throws(() => snapshotFileName(id), ModelRegistryStoreError, id);
    }
    await assert.rejects(() => store.write(snapshot({ providerId: '../escape' })), (e: unknown) => e instanceof ModelRegistryStoreError);
    await assert.rejects(() => store.read('../escape'), (e: unknown) => e instanceof ModelRegistryStoreError);
    await store.write(snapshot({ providerId: 'safe.id-1' }));
    const files = readdirSync(join(dir, 'registry'));
    assert.equal(files.length, 1);
    assert.ok(files[0]!.startsWith('safe.id-1-'), files[0]!);
    assert.ok(!files[0]!.includes('/') && !files[0]!.includes('..'), files[0]!);
  });
});

test('원자적 쓰기: 임시 파일이 남지 않는다', async () => {
  await withDir(async (dir, store) => {
    await store.write(snapshot());
    const files = readdirSync(join(dir, 'registry'));
    assert.equal(files.length, 1);
    assert.ok(!files.some(f => f.includes('.tmp-')), files.join(','));
  });
});

test('디렉터리 생성 실패도 ModelRegistryStoreError로 보고한다', async () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-discovery-fail-'));
  const blocker = join(root, 'file');
  writeFileSync(blocker, 'x');
  const store = new FileModelRegistrySnapshotStore(join(blocker, 'registry'));
  try {
    await assert.rejects(() => store.write(snapshot()), (e: unknown) => e instanceof ModelRegistryStoreError);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('권한·소유자에 의존하지 않는다 — 파일 권한을 바꿔도 읽기가 된다', async () => {
  await withDir(async (dir, store) => {
    await store.write(snapshot());
    const file = join(dir, 'registry', snapshotFileName('opencode'));
    chmodSync(file, 0o644);
    assert.deepEqual(await store.read('opencode'), snapshot());
    assert.ok(readFileSync(file, 'utf8').includes('"generation": 3'));
  });
});
