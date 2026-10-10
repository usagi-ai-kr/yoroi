import fs from 'node:fs';
import { homedir, tmpdir, userInfo } from 'node:os';
import { join, relative, resolve, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';

// Each node test worker and Cucumber process gets a fresh root, regardless of inherited settings.
const root = fs.mkdtempSync(join(tmpdir(), 'yoroi-test-data-'));
process.env.YOROI_DATA_DIR = join(root, 'data');
process.env.YOROI_TEST_DATA_ROOT = root;
export function homeDirectory(info = userInfo, fallback = homedir) {
  try { return info().homedir; } catch { return fallback(); }
}
const protectedDir = join(homeDirectory(), '.local', 'share', 'yoroi');
function inside(base, path) {
  const tail = relative(resolve(base), resolve(path));
  return tail === '' || (tail !== '..' && !tail.startsWith(`..${sep}`) && !isAbsolute(tail));
}
function pathString(path) {
  return path instanceof URL ? fileURLToPath(path) : Buffer.isBuffer(path) ? path.toString() : path;
}
function protectHome(path) {
  const value = pathString(path);
  if (typeof value === 'string' && inside(protectedDir, value)) {
    throw new Error('Real HOME Yoroi data access is forbidden in tests');
  }
}
// Fail before openDatabase can create/chmod a real file; do not inspect that directory.
for (const name of ['existsSync', 'mkdirSync', 'chmodSync', 'openSync', 'readFileSync',
  'writeFileSync', 'statSync', 'lstatSync', 'readdirSync', 'unlinkSync', 'rmSync', 'accessSync', 'realpathSync']) {
  const original = fs[name];
  fs[name] = function(path, ...args) { protectHome(path); return original.call(this, path, ...args); };
}
for (const name of ['mkdir', 'chmod', 'open', 'readFile', 'writeFile', 'stat', 'lstat',
  'readdir', 'unlink', 'rm', 'access', 'realpath']) {
  const original = fs.promises[name];
  fs.promises[name] = async function(path, ...args) {
    protectHome(path); return original.call(this, path, ...args);
  };
}
const emitWarning = process.emitWarning;
let sqlite;
try {
  process.emitWarning = () => {};
  sqlite = process.getBuiltinModule('node:sqlite');
} finally { process.emitWarning = emitWarning; }
const DatabaseSync = sqlite.DatabaseSync;
sqlite.DatabaseSync = new Proxy(DatabaseSync, { construct(target, args, newTarget) {
  const path = pathString(args[0]);
  if (path !== ':memory:' && (typeof path !== 'string' || !inside(tmpdir(), path))) {
    throw new Error('SQLite test databases must be temporary');
  }
  protectHome(path);
  return Reflect.construct(target, args, newTarget);
} });
syncBuiltinESMExports();
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }));
