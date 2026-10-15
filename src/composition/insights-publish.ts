import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CliEnvironment } from '../ui/cli/bootstrap.js';
import type { ProcessRunner } from '../infra/process-port.js';
import { insightPublicationDate } from '../insights/history-port.js';
import { freeSectionProblem } from '../insights/letter-free-guard.js';

const REPO = 'qus0in/yoroi', TIMEOUT_MS = 30_000;
type Issue = { readonly number: number; readonly title: string };
export interface PublishLetterOptions {
  readonly dryRun?: boolean; readonly notBefore?: string; readonly clock?: () => number;
  readonly runner: ProcessRunner; readonly ghBin?: string; readonly signal?: AbortSignal; readonly render: () => Promise<string | undefined>;
}
async function gh(runner: ProcessRunner, bin: string, args: readonly string[], signal?: AbortSignal) {
  try { const out = await runner.run({ executable: bin, args, timeoutMs: TIMEOUT_MS }, signal); return out.exitCode === 0 ? out.stdout : undefined; }
  catch { return undefined; }
}
async function listIssues(runner: ProcessRunner, bin: string, state: 'all' | 'open', search?: string, signal?: AbortSignal): Promise<Issue[] | undefined> {
  const args = ['issue', 'list', '--repo', REPO, '--label', 'letter', '--state', state, '--limit', '1000',
    ...(search ? ['--search', search] : []), '--json', 'number,title'];
  const output = await gh(runner, bin, args, signal);
  try {
    const values: unknown = JSON.parse(output ?? 'null');
    if (!Array.isArray(values)) return undefined;
    return values.map(value => {
      if (!value || typeof value !== 'object') throw new Error();
      const row = value as Record<string, unknown>;
      if (!Number.isSafeInteger(row.number) || (row.number as number) < 1 || typeof row.title !== 'string') throw new Error();
      return { number: row.number as number, title: row.title };
    });
  } catch { return undefined; }
}
function kst(now: number) {
  const shifted = new Date(now + 9 * 60 * 60 * 1000), hour = shifted.getUTCHours(), minute = shifted.getUTCMinutes();
  return { date: insightPublicationDate(new Date(now).toISOString()), minuteOfDay: hour * 60 + minute,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}
const fail = (env: CliEnvironment, message: string): number => { env.stderr(`insights publish: ${message}\n`); return 1; };
const isRenderedLetter = (body: string): boolean => body.startsWith('# ') && body.includes('\n## ');

export async function publishInsightsLetter(options: PublishLetterOptions, env: CliEnvironment): Promise<number> {
  const now = (options.clock ?? Date.now)(), k = kst(now), notBefore = options.notBefore ?? '09:00';
  const [hour, minute] = notBefore.split(':').map(Number), threshold = hour! * 60 + minute!;
  if (k.minuteOfDay < threshold) { env.stdout(`skip: before ${notBefore} KST\n`); return 0; }
  const title = `[letter] ${k.date} AI 인사이트 레터`, bin = options.ghBin || 'gh';
  const search = `in:title "${title}"`, duplicates = await listIssues(options.runner, bin, 'all', search, options.signal);
  if (!duplicates) return fail(env, 'duplicate check failed');
  const existing = duplicates.find(issue => issue.title === title);
  if (existing) { env.stdout(`skip: already published #${existing.number}\n`); return 0; }
  let body: string | undefined;
  try { body = await options.render(); } catch { return fail(env, 'collection or rendering failed'); }
  if (!body?.trim()) return fail(env, 'collection or rendering failed');
  const freeProblem = isRenderedLetter(body) ? freeSectionProblem(body) : undefined;
  if (freeProblem) return fail(env, `free section invalid: ${freeProblem}`);
  if (options.dryRun) {
    const open = await listIssues(options.runner, bin, 'open', undefined, options.signal);
    if (!open) return fail(env, 'open letter query failed');
    env.stdout(`dry-run: title="${title}" duplicate=no close=${open.map(x => `#${x.number}`).join(',') || 'none'}\n`);
    return 0;
  }
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-letter-publish-')), bodyFile = join(dir, 'body.md');
  try {
    writeFileSync(bodyFile, body, { encoding: 'utf8', mode: 0o600 });
    const created = await gh(options.runner, bin, ['issue', 'create', '--repo', REPO, '--title', title,
      '--label', 'letter', '--body-file', bodyFile], options.signal);
    const match = created?.match(/https:\/\/github\.com\/qus0in\/yoroi\/issues\/(\d+)/);
    if (!match) return fail(env, 'issue creation failed');
    const number = Number(match[1]), url = `https://github.com/${REPO}/issues/${number}`;
    const open = await listIssues(options.runner, bin, 'open', undefined, options.signal);
    let failed = !open;
    for (const issue of open ?? []) if (issue.number !== number) {
      const comment = `후속 레터 [#${number}](${url}) 발행으로 종료합니다.`;
      if (await gh(options.runner, bin, ['issue', 'comment', String(issue.number), '--repo', REPO, '--body', comment], options.signal) === undefined) { failed = true; continue; }
      if (await gh(options.runner, bin, ['issue', 'close', String(issue.number), '--repo', REPO], options.signal) === undefined) failed = true;
    }
    const issuedAt = kst((options.clock ?? Date.now)());
    env.stdout(`published #${number} ${url} ${issuedAt.date} ${issuedAt.time} KST\n`);
    return failed ? fail(env, 'published but previous letter cleanup failed') : 0;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
