import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_LETTER_MODEL_LISTS, resolveLetterModelListsPath }
  from '../src/insights/letter-model-lists.js';

/** 1.1.1 사용자 설정 경로: 우선순위·경고·common 하위호환. 실 홈 경로 미사용(주입 env/exists·임시 디렉터리). */
const existsFor = (...paths: string[]) => (path: string) => paths.includes(path);

test('경로 우선순위: YOROI 명시 경로가 XDG·레포보다 우선한다', () => {
  const explicit = '/tmp/synthetic/explicit.json', xdg = '/tmp/synthetic/xdg/yoroi/letter-model-lists.json';
  const env = { YOROI_LETTER_MODEL_LISTS: explicit, XDG_CONFIG_HOME: '/tmp/synthetic/xdg' };
  assert.equal(resolveLetterModelListsPath(env, existsFor(explicit, xdg)), explicit);
});

test('명시 경로가 없으면 XDG_CONFIG_HOME, 없으면 HOME/.config를 쓴다', () => {
  const xdgFile = '/tmp/synthetic/xdg/yoroi/letter-model-lists.json';
  assert.equal(resolveLetterModelListsPath({ XDG_CONFIG_HOME: '/tmp/synthetic/xdg' }, existsFor(xdgFile)), xdgFile);
  const homeFile = '/tmp/synthetic/home/.config/yoroi/letter-model-lists.json';
  assert.equal(resolveLetterModelListsPath({ HOME: '/tmp/synthetic/home' }, existsFor(homeFile)), homeFile);
});

test('사용자 파일이 없으면 레포 config, 모두 없으면 undefined(기본값)', () => {
  const env = { HOME: '/tmp/synthetic/none', XDG_CONFIG_HOME: '/tmp/synthetic/none/xdg' };
  const repo = resolveLetterModelListsPath(env, p => p.endsWith('/config/letter-model-lists.json'));
  assert.ok(repo?.endsWith('/config/letter-model-lists.json'), String(repo));
  assert.equal(resolveLetterModelListsPath(env, () => false), undefined);
});

const CHILD = "import('./src/insights/letter-model-lists.js').then(m => console.log(JSON.stringify(m.activeLetterModelLists())))";
function runActive(dir: string, env: Record<string, string>): { out: string; err: string; status: number } {
  const base: Record<string, string | undefined> = { ...process.env, HOME: dir, XDG_CONFIG_HOME: join(dir, 'xdg'), ...env };
  if (!('YOROI_LETTER_MODEL_LISTS' in env)) delete base.YOROI_LETTER_MODEL_LISTS;
  const result = spawnSync('node', ['--import', 'tsx', '-e', CHILD], { cwd: process.cwd(), env: base, encoding: 'utf8' });
  return { out: result.stdout ?? '', err: result.stderr ?? '', status: result.status ?? -1 };
}

test('active: 명시 파일 사용 — ban.common 하위호환(누락 worker 키는 빈 배열)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lml-path-'));
  const file = join(dir, 'explicit.json');
  writeFileSync(file, JSON.stringify({ allowOlder: ['custom-x'], ban: { common: ['gamma'], orchestrator: ['alpha'] } }));
  const r = runActive(dir, { YOROI_LETTER_MODEL_LISTS: file });
  assert.equal(r.status, 0, r.err);
  assert.deepEqual(JSON.parse(r.out), { allowOlder: ['custom-x'], excludePatterns: DEFAULT_LETTER_MODEL_LISTS.excludePatterns,
    ban: { common: ['gamma'], orchestrator: ['alpha'], worker: [] } });
});

test('active: XDG 파일이 레포 config보다 우선한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lml-path-'));
  const xdgDir = join(dir, 'xdg', 'yoroi');
  mkdirSync(xdgDir, { recursive: true });
  writeFileSync(join(xdgDir, 'letter-model-lists.json'), JSON.stringify({ excludePatterns: ['zzz'] }));
  const r = runActive(dir, {});
  assert.equal(r.status, 0, r.err);
  assert.deepEqual(JSON.parse(r.out).excludePatterns, ['zzz']);
});

test('active: 파싱 실패 시 경고 1줄 후 기본값(조용히 넘기지 않는다)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lml-path-'));
  const file = join(dir, 'broken.json');
  writeFileSync(file, '{oops');
  const r = runActive(dir, { YOROI_LETTER_MODEL_LISTS: file });
  assert.equal(r.status, 0, r.err);
  assert.deepEqual(JSON.parse(r.out), DEFAULT_LETTER_MODEL_LISTS);
  assert.ok(r.err.includes(`letter-model-lists 파싱 실패: ${file}`), r.err);
  assert.equal((r.err.match(/파싱 실패/g) ?? []).length, 1, '경고는 1줄만');
});
