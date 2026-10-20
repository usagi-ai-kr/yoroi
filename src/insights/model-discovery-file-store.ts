import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModelRegistrySnapshot, ModelRegistrySnapshotStore } from './model-discovery-types.js';

/** 스냅샷 저장소 오류. fail-closed: 파손·위험 상태는 undefined로 숨기지 않고 던진다. */
export class ModelRegistryStoreError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = 'ModelRegistryStoreError';
  }
}

/** 경로 조각·제어문자를 포함한 id는 거부한다. providerId는 경로가 아닌 슬러그여야 한다. */
const UNSAFE_ID = /[/\\]|\.\.|[\u0000-\u001f\u007f]/;

export function assertSafeProviderId(providerId: string): string {
  const id = (providerId ?? '').trim();
  if (!id) throw new ModelRegistryStoreError('providerId must not be empty');
  if (UNSAFE_ID.test(id)) throw new ModelRegistryStoreError(`unsafe providerId: ${JSON.stringify(providerId)}`);
  return id;
}

/** providerId → 파일명. 안전한 문자만 남기고 해시 접미를 붙여 다른 id와 충돌하지 않게 한다. */
export function snapshotFileName(providerId: string): string {
  const id = assertSafeProviderId(providerId);
  const digest = createHash('sha256').update(id, 'utf8').digest('hex').slice(0, 16);
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 48);
  return `${safe}-${digest}.json`;
}

/** 최소 형태 검증. 모델 id·내용은 건드리지 않는다(정규화·병합 금지). */
function assertSnapshotShape(value: unknown, expectedProviderId?: string): ModelRegistrySnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ModelRegistryStoreError('snapshot must be an object');
  }
  const rec = value as Record<string, unknown>;
  if (!Number.isInteger(rec.generation) || (rec.generation as number) < 1) throw new ModelRegistryStoreError('snapshot.generation must be an integer >= 1');
  if (typeof rec.observedAt !== 'string' || !rec.observedAt.trim()) throw new ModelRegistryStoreError('snapshot.observedAt must be a non-empty string');
  if (typeof rec.providerId !== 'string' || !rec.providerId.trim()) throw new ModelRegistryStoreError('snapshot.providerId must be a non-empty string');
  if (!Array.isArray(rec.models)) throw new ModelRegistryStoreError('snapshot.models must be an array');
  if (expectedProviderId !== undefined && rec.providerId !== expectedProviderId) {
    throw new ModelRegistryStoreError('snapshot.providerId does not match the requested provider');
  }
  return rec as unknown as ModelRegistrySnapshot;
}

/**
 * 파일 기반 스냅샷 저장소(단위3). provider별 파일 1개, 원자적 쓰기(임시 파일 → rename).
 * 경로 주입은 호출자(baseDir)가 정한다 — 사용자 저장 위치 결정은 이 단위의 범위가 아니다.
 * 동시성은 last-write-wins이며 교차 프로세스 잠금은 없다.
 */
export class FileModelRegistrySnapshotStore implements ModelRegistrySnapshotStore {
  constructor(private readonly baseDir: string) {}

  private pathFor(providerId: string): string {
    return join(this.baseDir, snapshotFileName(providerId));
  }

  async read(providerId: string): Promise<ModelRegistrySnapshot | undefined> {
    const id = assertSafeProviderId(providerId);
    const path = this.pathFor(id);
    let raw: string;
    try {
      raw = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return undefined;
      throw new ModelRegistryStoreError(`failed to read snapshot for ${id}`, error);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new ModelRegistryStoreError(`malformed snapshot JSON for ${id}`, error);
    }
    return assertSnapshotShape(parsed, id);
  }

  async write(snapshot: ModelRegistrySnapshot): Promise<void> {
    const id = assertSafeProviderId(snapshot?.providerId ?? '');
    assertSnapshotShape(snapshot, id);
    try {
      await mkdir(this.baseDir, { recursive: true, mode: 0o700 });
    } catch (error) {
      throw new ModelRegistryStoreError(`failed to create snapshot directory for ${id}`, error);
    }
    const path = this.pathFor(id);
    const temp = join(this.baseDir, `.tmp-${snapshotFileName(id)}-${process.pid}-${randomUUID().slice(0, 8)}`);
    try {
      await writeFile(temp, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', mode: 0o600 });
      await rename(temp, path);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => undefined);
      throw new ModelRegistryStoreError(`failed to write snapshot for ${id}`, error);
    }
  }
}
