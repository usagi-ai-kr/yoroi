import assert from 'node:assert/strict';
import test from 'node:test';
import { describeOpenCodeDataSchema, emitOpenCodeDataSchemaDiagnostic,
  updatedAtFormatPattern } from '../src/insights/opencode-data-json-parser.js';

test('the schema diagnostic line keeps counts/keys/types/format and never leaks model names or numbers', () => {
  const secret = 'SECRET-MODEL-XYZ', bigNumber = 987654321;
  const payload = { updatedAt: '2026-10-12T00:00:00Z',
    leaderboard: { pastWeek: [{ rank: 1, model: secret, usage: { [secret]: bigNumber } }], pastDay: [] }, dailyTokens: [] };
  const line = describeOpenCodeDataSchema(payload)!;
  assert.match(line, /^opencode-data: schema pastWeek\[n=1,rank:number,model:string,usage:object\(keyCount=1,valueTypes=\[number\]\)\]/);
  assert.match(line, /pastDay\[n=0\]/);
  assert.match(line, /updatedAt=ISO-UTC$/);
  assert.ok(!line.includes(secret), '모델명 금지');
  assert.ok(!line.includes(String(bigNumber)), '수치 원문 금지');
  assert.equal(updatedAtFormatPattern('Mon, 12 Oct 2026 00:00:00 GMT'), 'RFC');
  assert.equal(updatedAtFormatPattern('2026-10-12'), 'DATE');
  assert.equal(updatedAtFormatPattern('2026-10-12T09:00:00+09:00'), 'ISO-OFFSET');
  assert.equal(updatedAtFormatPattern(undefined), 'ABSENT');
  assert.equal(updatedAtFormatPattern('nope'), 'OTHER');
  assert.equal(describeOpenCodeDataSchema({}), null);
  const writes: string[] = [], original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string) => { writes.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try { emitOpenCodeDataSchemaDiagnostic(payload); } finally { process.stderr.write = original; }
  assert.deepEqual(writes, [`${line}\n`]);
  assert.ok(!writes[0]!.includes(secret) && !writes[0]!.includes(String(bigNumber)));
});
test('the diagnostic is a single stderr line and stays silent for a missing leaderboard', () => {
  const writes: string[] = [], original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string) => { writes.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try { emitOpenCodeDataSchemaDiagnostic({ dailyTokens: [] }); } finally { process.stderr.write = original; }
  assert.deepEqual(writes, []);
});
test('the diagnostic is delivered to an injected writer without touching process.stderr', () => {
  const lines: string[] = [], original = process.stderr.write.bind(process.stderr);
  let direct = '';
  process.stderr.write = ((chunk: string) => { direct += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    emitOpenCodeDataSchemaDiagnostic({ updatedAt: '2026-10-12T00:00:00Z', leaderboard: { pastWeek: [{ a: 1 }], pastDay: [] } },
      line => lines.push(line));
  } finally { process.stderr.write = original; }
  assert.equal(direct, '');
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /^opencode-data: schema pastWeek\[n=1,a:number\], pastDay\[n=0\]; updatedAt=ISO-UTC$/);
});
