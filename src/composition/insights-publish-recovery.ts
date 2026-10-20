import { readFileSync } from 'node:fs';
import type { ProcessRunner } from '../infra/process-port.js';
import { DEFAULT_REPO, sanitizeLogOutput } from './insights-publish-target.js';

export interface IssueCommentInfo { readonly number: number; readonly commentCount: number; }
export interface RecoveryResult {
  readonly status: 'already_complete' | 'recovered' | 'failed' | 'not_a_letter';
  readonly number: number; readonly recoveredCount?: number; readonly error?: string;
}

async function runGhJson(runner: ProcessRunner, bin: string, args: readonly string[], signal?: AbortSignal): Promise<Record<string, unknown> | undefined> {
  try {
    const res = await runner.run({ executable: bin, args, timeoutMs: 30_000 }, signal);
    if (res.exitCode !== 0) return undefined;
    const parsed: unknown = JSON.parse(res.stdout);
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

/** 기존 댓글 본문 목록. 본문 없는 행은 세지 않는다(개수 판정에 쓰지 않는다). */
export async function fetchIssueCommentBodies(runner: ProcessRunner, bin: string, issueNumber: number, repo = DEFAULT_REPO, signal?: AbortSignal): Promise<string[] | undefined> {
  const comments = (await runGhJson(runner, bin, ['issue', 'view', String(issueNumber), '--repo', repo, '--json', 'comments'], signal))?.comments;
  if (!Array.isArray(comments)) return undefined;
  return comments.flatMap((c): readonly string[] => typeof (c as { body?: unknown })?.body === 'string' ? [(c as { body: string }).body] : []);
}

export async function fetchIssueCommentCount(runner: ProcessRunner, bin: string, issueNumber: number, repo = DEFAULT_REPO, signal?: AbortSignal): Promise<number | undefined> {
  const bodies = await fetchIssueCommentBodies(runner, bin, issueNumber, repo, signal);
  return bodies === undefined ? undefined : bodies.length;
}

async function fetchIssueBody(runner: ProcessRunner, bin: string, issueNumber: number, repo = DEFAULT_REPO, signal?: AbortSignal): Promise<string | undefined> {
  const body = (await runGhJson(runner, bin, ['issue', 'view', String(issueNumber), '--repo', repo, '--json', 'body'], signal))?.body;
  return typeof body === 'string' ? body : undefined;
}

export async function recoverMissingLetterComments(runner: ProcessRunner, bin: string, issueNumber: number, issueTitle: string, commentFiles: readonly string[], repo = DEFAULT_REPO, signal?: AbortSignal, expectedBody?: string): Promise<RecoveryResult> {
  if (!issueTitle.startsWith('[letter] ') || issueTitle.includes('memo')) {
    return { status: 'not_a_letter', number: issueNumber, error: 'protected non-letter issue' };
  }
  if (expectedBody !== undefined) {
    const current = await fetchIssueBody(runner, bin, issueNumber, repo, signal);
    if (current === undefined || current !== expectedBody) {
      return { status: 'failed', number: issueNumber, error: 'existing body differs from rendered body; refusing recovery' };
    }
  }
  const existing = await fetchIssueCommentBodies(runner, bin, issueNumber, repo, signal);
  if (existing === undefined) {
    return { status: 'failed', number: issueNumber, error: 'failed to query comments' };
  }
  const posted = new Set(existing);
  let postedCount = 0;
  for (const file of commentFiles) {
    let expected: string;
    try { expected = readFileSync(file, 'utf8'); }
    catch { return { status: 'failed', number: issueNumber, error: `cannot read comment file: ${file}` }; }
    if (posted.has(expected)) continue;
    try {
      const res = await runner.run({ executable: bin, args: ['issue', 'comment', String(issueNumber), '--repo', repo, '--body-file', file], timeoutMs: 30_000 }, signal);
      if (res.exitCode !== 0) {
        return { status: 'failed', number: issueNumber, error: sanitizeLogOutput(res.stderr || `failed posting ${file}`) };
      }
      posted.add(expected);
      postedCount++;
    } catch (err: unknown) {
      return { status: 'failed', number: issueNumber, error: sanitizeLogOutput(String(err)) };
    }
  }
  if (postedCount === 0) return { status: 'already_complete', number: issueNumber };
  return { status: 'recovered', number: issueNumber, recoveredCount: postedCount };
}
