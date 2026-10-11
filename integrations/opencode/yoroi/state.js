// yoroi-managed: opencode-zen-free v1
import { safeID, limitError, retryAt } from './signals.js';

export async function createHooks({ loadFreeModels, report, now = Date.now }) {
  let free;
  try { free = await loadFreeModels(); } catch { free = new Set(); }
  let unlockPending = true;
  let reloaded = false;
  let nextReloadAt = -Infinity;
  let queue = Promise.resolve();
  const sessions = new Map();
  const send = async args => { try { return await report(args); } catch { return false; } };
  async function handle(event) {
    const p = event?.properties;
    if (!p) return;
    if (event.type === 'message.updated') {
      const m = p.info;
      if (m?.role !== 'assistant' || !safeID(m.sessionID) || !safeID(m.id)) return;
      const old = sessions.get(m.sessionID);
      if (old && old.id !== m.id && !(m.time?.created > old.created)) return;
      sessions.set(m.sessionID, { id: m.id, created: m.time?.created,
        provider: m.providerID, model: m.modelID, completed: m.time?.completed,
        finish: m.finish, failed: Boolean(m.error) || (old?.id === m.id && old.failed),
        exceeded: old?.id === m.id && old.exceeded, timed: old?.id === m.id && old.timed });
      if (sessions.size > 256) sessions.delete(sessions.keys().next().value);
      return;
    }
    const m = sessions.get(p.sessionID);
    if (event.type === 'session.deleted') { sessions.delete(p.sessionID); return; }
    if (!m || m.provider !== 'opencode' || !safeID(m.model)) return;
    const status = p.status;
    const exceeded = event.type === 'session.error' ? limitError(p.error) :
      event.type === 'session.status' && status?.type === 'retry' &&
      status?.action?.reason === 'free_tier_limit' && status.action.provider === 'opencode';
    if (event.type === 'session.error') m.failed = true;
    const ensureFree = async () => {
      if (!free.has(m.model) && !reloaded && now() >= nextReloadAt) {
        nextReloadAt = now() + 300000;
        try {
          const refreshed = await loadFreeModels();
          if (refreshed.size > 0) { free = refreshed; reloaded = true; }
        } catch {}
      }
      return free.has(m.model);
    };
    if (exceeded) {
      if (!await ensureFree()) return;
      unlockPending = true;
      const at = event.type === 'session.error' ? retryAt(p.error?.data) : undefined;
      if (!m.exceeded || (at && !m.timed)) {
        if (await send(['--exceeded', '--model', m.model, '--reason',
          'free_usage_exceeded', ...(at ? ['--retry-at', at] : [])])) {
          m.exceeded = true;
          m.timed ||= Boolean(at);
        }
      }
      return;
    }
    const idle = event.type === 'session.idle' ||
      (event.type === 'session.status' && status?.type === 'idle');
    if (idle && unlockPending && !m.failed &&
        Number.isFinite(m.completed) && m.finish === 'stop') {
      if (await ensureFree() && await send(['--ok', '--model', m.model])) unlockPending = false;
    }
  }
  return { event: input => {
    queue = queue.then(() => handle(input?.event)).catch(() => {});
    return queue;
  } };
}
