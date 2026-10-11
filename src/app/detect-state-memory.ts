import { assertLeaseArgs, assertStateEntry, type DetectLease, type DetectStateStore, type LeaseAcquire } from './detect-state-port.js';

/** In-memory store for tests and single-process use. SQLite implements the same contract (DT5). */
export class MemoryDetectStateStore implements DetectStateStore {
  private readonly values = new Map<string, string>();
  private lease: DetectLease | undefined;

  get(key: string): string | undefined { assertStateEntry(key); return this.values.get(key); }
  set(key: string, value: string): void { assertStateEntry(key, value); this.values.set(key, value); }
  delete(key: string): void { assertStateEntry(key); this.values.delete(key); }

  acquireLease(owner: string, nowMs: number, ttlMs: number): LeaseAcquire {
    assertLeaseArgs(owner, nowMs, ttlMs);
    const held = this.lease;
    if (held && held.owner !== owner && held.expiresAtMs > nowMs) return { acquired: false, heldBy: { ...held } };
    const takeover = held && held.owner !== owner ? { ...held } : undefined;
    this.lease = { owner, acquiredAtMs: held?.owner === owner ? held.acquiredAtMs : nowMs, renewedAtMs: nowMs, expiresAtMs: nowMs + ttlMs };
    return { acquired: true, lease: { ...this.lease }, ...(takeover && { takeover }) };
  }

  renewLease(owner: string, nowMs: number, ttlMs: number): boolean {
    assertLeaseArgs(owner, nowMs, ttlMs);
    if (this.lease?.owner !== owner) return false;
    this.lease = { ...this.lease, renewedAtMs: nowMs, expiresAtMs: nowMs + ttlMs };
    return true;
  }

  releaseLease(owner: string): void { assertLeaseArgs(owner, 0); if (this.lease?.owner === owner) this.lease = undefined; }
  getLease(): DetectLease | undefined { return this.lease && { ...this.lease }; }
  close(): void {}
}
