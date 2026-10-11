import { SourceError } from '../app/usage-source.js';
import type { HttpClient } from '../infra/http-client.js';
import { parseArenaRows } from './arena-parser.js';
import { fetchArenaRows, type ArenaFetchOptions } from './arena-transport.js';
import type { ParseRowResult } from './parse-utils.js';

/** Arena port halves (A1 transport + existing parser). The raw payload is the overall row array.
 * fetchArenaRows owns its request session: its start time is the start of this fetch. */
export async function fetchArena(client: HttpClient, options: ArenaFetchOptions): Promise<readonly unknown[]> {
  return (await fetchArenaRows(client, options)).rows;
}
export function parseArena(payload: unknown, observedAt: string): readonly ParseRowResult[] {
  if (!Array.isArray(payload)) throw new SourceError('parse');
  return parseArenaRows(payload, observedAt);
}
