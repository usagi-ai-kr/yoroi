import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * .env 복사 함수.
 * 정책:
 * - 대상 디렉터리에 fs.openSync(..., 'wx', 0o600)로 임시 파일을 생성하고
 *   fchmodSync로 umask와 무관하게 즉시 0600 권한을 보장한다.
 * - fsync 후 fs.renameSync로 대상 위치에 원자적으로 교체한다.
 * - 대상 파일이 이미 존재하면 원자적으로 교체된다.
 * - 대상이 심볼릭 링크인 경우 링크를 따라가지 않고 심볼릭 링크 자체를 교체한다.
 * - 원본 파일이 없으면 조용히 false를 반환하고 건너뛴다.
 * - 작업 실패 시 생성 중이던 임시 파일은 정리(삭제)된다.
 */
export function copyEnv(sourcePath, target) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }
  const isDir = fs.existsSync(target) && fs.statSync(target).isDirectory();
  const targetPath = isDir ? path.join(target, '.env') : target;
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const nonce = crypto.randomBytes(6).toString('hex');
  const tmpPath = path.join(targetDir, `.env.tmp.${process.pid}.${nonce}`);
  let fd;

  try {
    fd = fs.openSync(tmpPath, 'wx', 0o600);
    fs.fchmodSync(fd, 0o600);
    const content = fs.readFileSync(sourcePath);
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;

    fs.renameSync(tmpPath, targetPath);
    return true;
  } catch (err) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
    throw err;
  }
}
