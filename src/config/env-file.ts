import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface EnvFileOptions {
  readonly cwd?: string;
  readonly packageRoot?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly debug?: boolean;
  readonly log?: (line: string) => void;
  readonly load?: (path: string) => void;
}

/**
 * 이 모듈 위치에서 위로 올라가 package.json이 있는 디렉터리를 찾는다.
 * tsc가 만든 `dist/package.json`을 패키지 루트로 오인하지 않도록 이름이 `dist`인 디렉터리는 건너뛴다.
 */
export function packageRootFrom(moduleUrl: string): string {
  let dir = dirname(fileURLToPath(moduleUrl));
  for (;;) {
    if (basename(dir) !== "dist" && existsSync(resolve(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}

export class EnvFileLoadError extends Error {
  constructor() {
    super("env file load failed");
    this.name = "EnvFileLoadError";
  }
}

/** 오류 객체·원문 대신 코드 또는 간단 분류만 돌려준다. */
function errorCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | null | undefined)?.code;
  return typeof code === "string" && code.length > 0 ? code : "parse";
}

/** 후보 순서: cwd/.env → 패키지 루트/.env. */
export function envFileCandidates(cwd: string, packageRoot: string): string[] {
  return [resolve(cwd, ".env"), resolve(packageRoot, ".env")];
}

/**
 * 처음 존재하는 .env 하나만 Node 내장(process.loadEnvFile)으로 로드한다.
 * 이미 설정된 환경변수는 덮어쓰지 않는다(Node 기본). 후보가 없으면 조용히 건너뛰고,
 * 존재하는 파일의 로드가 실패하면 경로·오류 코드만 stderr에 남기고 EnvFileLoadError를 던진다.
 * YOROI_DEBUG=1일 때만 성공 경로/부재를 알리며, 값은 절대 출력하지 않는다.
 */
export function loadEnvFile(options: EnvFileOptions = {}): string | undefined {
  const cwd = options.cwd ?? process.cwd();
  const packageRoot = options.packageRoot ?? packageRootFrom(import.meta.url);
  const env = options.env ?? process.env;
  const log = options.log ?? ((line: string) => { process.stderr.write(`${line}\n`); });
  const load = options.load ?? ((path: string) => { process.loadEnvFile(path); });
  const candidate = envFileCandidates(cwd, packageRoot).find((path) => existsSync(path));
  if (candidate !== undefined) {
    try {
      load(candidate);
    } catch (error) {
      log(`yoroi: env file load failed ${candidate} (${errorCode(error)})`);
      throw new EnvFileLoadError();
    }
  }
  if (options.debug ?? env.YOROI_DEBUG === "1") {
    log(candidate === undefined ? "yoroi: env file none" : `yoroi: env file ${candidate}`);
  }
  return candidate;
}
