import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

/** #180 unit 4b 후속: 실패 전제와 실행 차단을 실제 검증한다.
 *  실모델·실계정·공급자CLI 실행 금지. 저장소 열기 실패가 먼저 일어나 runner에 닿지 않는다. */
test('main dispatcher fail-fast exits 1 with zero model execution', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-calib-main-'));
  try {
    writeFileSync(join(root, 'file'), 'x');
    const r = spawnSync('node', ['--import', 'tsx', 'src/main.ts', 'insights', 'calibrate',
      'free', '--model', 'opencode/test-free', '--yes'],
    { env: { ...process.env, YOROI_DATA_DIR: join(root, 'file', 'db') }, encoding: 'utf8', timeout: 60000 });
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('failed to open calibration store'), r.stderr);
    assert.ok(!r.stdout.includes('실행 계획'), 'runner 실행 전 중단');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
