import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/** #194: 발행 워크플로 불변식(스케줄·게이트·동시성·시크릿·3역할 opt-in)을 잠근다. */
const workflow = readFileSync(join(process.cwd(), '.github/workflows/letter-publish.yml'), 'utf8');
const lines = workflow.split('\n');
const has = (needle: string): boolean => lines.some(line => line.trim() === needle);

test('스케줄·게이트: UTC 23:00(=다음 날 08:00 KST)·KST 러너·기본 dry_run true', () => {
  assert.ok(workflow.includes("cron: '0 23 * * *'"), 'UTC 23:00 cron');
  assert.ok(has('TZ: Asia/Seoul'), '러너 시계 KST');
  assert.ok(workflow.includes('default: true'), 'dry_run 기본값 true');
  assert.ok(workflow.includes("if: github.event_name == 'workflow_dispatch' && inputs.dry_run == true"), 'dry-run 조건');
  assert.ok(workflow.includes('insights publish --dry-run'), 'dry-run 단계는 원격 쓰기 없음');
  assert.ok(workflow.includes("if: github.event_name == 'schedule' || inputs.dry_run != true"), '스케줄은 항상 실제 발행 경로');
});

test('동시성·권한·시크릿: 순차 대기, issues 쓰기, 값 없는 참조만', () => {
  assert.ok(has('group: letter-publish') && has('cancel-in-progress: false'), '겹친 실행은 순차 대기');
  assert.ok(has('issues: write') && has('contents: read'), '최소 권한');
  for (const secret of ['GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}', 'YOROI_AA_API_KEY: ${{ secrets.YOROI_AA_API_KEY }}',
    'YOROI_OPENROUTER_API_KEY: ${{ secrets.YOROI_OPENROUTER_API_KEY }}']) assert.ok(workflow.includes(secret), secret);
  assert.ok(!/secrets\.[A-Z_]+:\s*[^$]/.test(workflow), '시크릿 값이 하드코딩되지 않는다');
});

test('3역할 opt-in: 본문 Top7·댓글 Top15 를 위해 깊이는 미지정', () => {
  assert.ok(has('YOROI_LETTER_THREE_ROLE: on'), '프로덕션에서 3역할 경로 활성');
  assert.ok(!lines.some(line => /^\s*YOROI_LETTER_THREE_ROLE_DEPTH\s*:/.test(line)), '깊이 미지정 → 본문 Top7·댓글 Top15');
});

test('#168 감지 인터페이스: 확정된 키가 없으므로 워크플로에 env 를 두지 않는다', () => {
  const discoveryEnv = lines.filter(line => /^\s*YOROI_[A-Z_]*DISCOVERY[A-Z_]*\s*:/.test(line));
  assert.deepEqual(discoveryEnv, [], '감지 활성화 키는 w1 단위가 확정한다(임의 생성 금지)');
  for (const invented of ['YOROI_MODEL_DISCOVERY', 'YOROI_DISCOVERY', 'YOROI_MODEL_DISCOVERY_AUTO_ENROLL']) {
    assert.ok(!workflow.includes(invented), `${invented} 는 아직 확정되지 않은 인터페이스다`);
  }
});

test('OpenCode CLI 설치는 버전 고정·V2 스크립트만', () => {
  assert.ok(workflow.includes('https://opencode.ai/v2/install'), 'V2 설치 스크립트');
  assert.ok(workflow.includes('--version 2.0.32'), '버전 고정');
  assert.ok(!workflow.includes('https://opencode.ai/install |'), 'V1 설치 스크립트는 쓰지 않는다');
  assert.ok(has('YOROI_OPENCODE_TARGET: v2'), 'Free 목록은 V2 경로');
});
