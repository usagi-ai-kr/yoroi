import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CliEnvironment } from '../ui/cli/bootstrap.js';
import type { ProcessRunner } from '../infra/process-port.js';
import { insightPublicationDate } from '../insights/history-port.js';
import { freeSectionProblem } from '../insights/letter-free-guard.js';
import type { LetterParts } from '../insights/letter-markdown.js';
import { closePreviousLetters, DEFAULT_REPO, extractIssueUrlAndNumber, gh, isCanonicalOrRedirectRepo, listIssues, sanitizeLogOutput } from './insights-publish-target.js';
import { fetchIssueCommentCount, recoverMissingLetterComments } from './insights-publish-recovery.js';

const REPO = DEFAULT_REPO;
export interface PublishLetterOptions {
  readonly dryRun?: boolean; readonly notBefore?: string; readonly clock?: () => number;
  readonly runner: ProcessRunner; readonly ghBin?: string; readonly signal?: AbortSignal;
  readonly render: () => Promise<LetterParts>;
}
function kst(now: number) {
  const shifted = new Date(now + 9 * 60 * 60 * 1000), hour = shifted.getUTCHours(), minute = shifted.getUTCMinutes();
  return { date: insightPublicationDate(new Date(now).toISOString()), minuteOfDay: hour * 60 + minute,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}
const fail = (env: CliEnvironment, message: string): number => { env.stderr(`insights publish: ${message}\n`); return 1; };
const isRenderedLetter = (body: string): boolean => body.startsWith('# ') && body.includes('\n## ');

export async function publishInsightsLetter(options: PublishLetterOptions, env: CliEnvironment): Promise<number> {
  const now = (options.clock ?? Date.now)(), k = kst(now), notBefore = options.notBefore ?? '08:00';
  const [hour, minute] = notBefore.split(':').map(Number), threshold = hour! * 60 + minute!;
  if (k.minuteOfDay < threshold) { env.stdout(`skip: before ${notBefore} KST\n`); return 0; }
  const title = `[letter] ${k.date} AI 인사이트 레터`, bin = options.ghBin || 'gh';
  // #194 중복 게이트 분리: 조회 1회(ALL) 후 state 로 분류한다.
  // 실제 gh 는 'OPEN'/'CLOSED' 대문자를 준다 → 대소문자 무관 비교. 미포함/OPEN 은 기존 동작(완전→skip,
  // 댓글 누락→복구) 유지, CLOSED 는 삭제 없이 이력 보존 후 새 발행(같은 KST 날짜 교체)을 허용한다.
  const duplicates = await listIssues(options.runner, bin, 'all', `in:title "${title}"`, options.signal);
  if (!duplicates) return fail(env, 'duplicate check failed');
  const sameTitle = duplicates.filter(issue => issue.title === title);
  const isClosed = (state: string | undefined): boolean => state?.toLowerCase() === 'closed';
  const existing = sameTitle.find(issue => !isClosed(issue.state));
  const closedSameTitle = sameTitle.find(issue => isClosed(issue.state));
  if (existing) {
    const count = await fetchIssueCommentCount(options.runner, bin, existing.number, REPO, options.signal);
    if (count === undefined) {
      env.stdout(`skip: already published #${existing.number}\n`);
      return 0;
    }
  }
  let parts: LetterParts;
  try { parts = await options.render(); } catch { return fail(env, 'collection or rendering failed'); }
  const body = parts?.body, comments = parts?.comments;
  if (!body?.trim() || !Array.isArray(comments) || comments.length !== 3 || comments.some(c => !c?.trim())) return fail(env, 'collection or rendering failed');
  const freeProblem = isRenderedLetter(body) ? freeSectionProblem(comments[2]!) : undefined;
  if (freeProblem) return fail(env, `free section invalid: ${freeProblem}`);
  if (options.dryRun) {
    const open = await listIssues(options.runner, bin, 'open', undefined, options.signal);
    if (!open) return fail(env, 'open letter query failed');
    env.stdout(`dry-run: title="${title}" duplicate=${existing ? 'yes' : 'no'} closed_same_title=${closedSameTitle ? `#${closedSameTitle.number}` : 'none'} close=${open.map(x => `#${x.number}`).join(',') || 'none'} comments=3\n`);
    return 0;
  }
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-letter-publish-')), bodyFile = join(dir, 'body.md');
  try {
    writeFileSync(bodyFile, body, { encoding: 'utf8', mode: 0o600 });
    const commentFiles = comments.map((c, i) => { const f = join(dir, `c-${i + 1}.md`); writeFileSync(f, c!, { encoding: 'utf8', mode: 0o600 }); return f; });
    if (existing) {
      const rec = await recoverMissingLetterComments(options.runner, bin, existing.number, existing.title, commentFiles, REPO, options.signal, body);
      if (rec.status === 'already_complete') { env.stdout(`skip: already published #${existing.number}\n`); return 0; }
      if (rec.status === 'recovered') {
        const url = `https://github.com/${REPO}/issues/${existing.number}`;
        const closed = await closePreviousLetters(options.runner, bin, existing.number, url, options.signal);
        env.stdout(`recovered #${existing.number} ${url} (posted ${rec.recoveredCount} missing comments)\n`);
        return closed ? 0 : fail(env, 'recovered comments but previous letter cleanup failed');
      }
      return fail(env, `recovery failed for #${existing.number}: ${rec.error}`);
    }
    const created = await gh(options.runner, bin, ['issue', 'create', '--repo', REPO, '--title', title, '--label', 'letter', '--body-file', bodyFile], options.signal);
    const extracted = extractIssueUrlAndNumber(created ?? '');
    if (!extracted || !isCanonicalOrRedirectRepo(extracted.repo)) return fail(env, `issue creation failed or unexpected repo URL: ${sanitizeLogOutput(created ?? '')}`);
    const number = extracted.number, url = `https://github.com/${REPO}/issues/${number}`;
    for (let i = 0; i < commentFiles.length; i++) {
      if (await gh(options.runner, bin, ['issue', 'comment', String(number), '--repo', REPO, '--body-file', commentFiles[i]!], options.signal) === undefined) {
        return fail(env, `comment ${i + 1} failed (issue #${number} left open)`);
      }
    }
    const closed = await closePreviousLetters(options.runner, bin, number, url, options.signal);
    const issuedAt = kst((options.clock ?? Date.now)());
    env.stdout(`published #${number} ${url} ${issuedAt.date} ${issuedAt.time} KST\n`);
    return closed ? 0 : fail(env, 'published but previous letter cleanup failed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
