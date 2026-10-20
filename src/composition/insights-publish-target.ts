import type { ProcessRunner } from '../infra/process-port.js';

/** 실제 저장소(저장소 이동 후 canonical). 중복 검사·댓글·close·복구가 전부 이 곳을 대상으로 한다. */
export const DEFAULT_REPO = 'usagi-ai-kr/yoroi';
/** 저장소 이동 전 주소. gh 가 리다이렉트로 돌려주는 URL 파싱·검증에만 허용한다(발행 대상 아님). */
export const LEGACY_REPO = 'qus0in/yoroi';
export const TIMEOUT_MS = 30_000;
export type Issue = { readonly number: number; readonly title: string };

export interface ExtractedIssue {
  readonly number: number;
  readonly url: string;
  readonly repo: string;
}

const ISSUE_URL_REGEX = /https:\/\/github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)\/issues\/(\d+)/i;
const SECRET_REGEX = /(?:sk-[a-zA-Z0-9_\-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|bearer\s+[a-zA-Z0-9_\-\.]{20,})/gi;

export function sanitizeLogOutput(text: string): string {
  return text.replace(SECRET_REGEX, '[REDACTED]');
}

export function extractIssueUrlAndNumber(output: string): ExtractedIssue | undefined {
  if (!output) return undefined;
  const match = output.match(ISSUE_URL_REGEX);
  if (!match) return undefined;
  const num = Number(match[3]);
  if (!Number.isSafeInteger(num) || num <= 0) return undefined;
  return { number: num, url: `https://github.com/${match[1]}/${match[2]}/issues/${num}`, repo: `${match[1]}/${match[2]}` };
}

export function isCanonicalOrRedirectRepo(repo: string): boolean {
  const norm = repo.toLowerCase();
  return norm === LEGACY_REPO || norm === DEFAULT_REPO;
}

export async function gh(runner: ProcessRunner, bin: string, args: readonly string[], signal?: AbortSignal) {
  try { const out = await runner.run({ executable: bin, args, timeoutMs: TIMEOUT_MS }, signal); return out.exitCode === 0 ? out.stdout : undefined; }
  catch { return undefined; }
}

export async function listIssues(runner: ProcessRunner, bin: string, state: 'all' | 'open', search?: string, signal?: AbortSignal): Promise<Issue[] | undefined> {
  const args = ['issue', 'list', '--repo', DEFAULT_REPO, '--label', 'letter', '--state', state, '--limit', '1000',
    ...(search ? ['--search', search] : []), '--json', 'number,title'];
  const output = await gh(runner, bin, args, signal);
  try {
    const values: unknown = JSON.parse(output ?? 'null');
    if (!Array.isArray(values)) return undefined;
    return values.map(v => {
      const row = v as Record<string, unknown>;
      if (!Number.isSafeInteger(row?.number) || (row?.number as number) < 1 || typeof row?.title !== 'string') throw new Error();
      return { number: row.number as number, title: row.title };
    });
  } catch { return undefined; }
}

export async function closePreviousLetters(runner: ProcessRunner, bin: string, currentNumber: number, url: string, signal?: AbortSignal): Promise<boolean> {
  const open = await listIssues(runner, bin, 'open', undefined, signal);
  if (!open) return false;
  let ok = true;
  for (const issue of open) if (issue.number !== currentNumber) {
    const comment = `후속 레터 [#${currentNumber}](${url}) 발행으로 종료합니다.`;
    if (await gh(runner, bin, ['issue', 'comment', String(issue.number), '--repo', DEFAULT_REPO, '--body', comment], signal) === undefined) { ok = false; continue; }
    if (await gh(runner, bin, ['issue', 'close', String(issue.number), '--repo', DEFAULT_REPO], signal) === undefined) ok = false;
  }
  return ok;
}
