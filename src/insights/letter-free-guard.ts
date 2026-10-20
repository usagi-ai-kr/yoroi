import { FREE_EMPTY_NOTE, FREE_HEADING } from './letter-markdown-free.js';
import { FREE_TABLE_HEADERS } from './letter-markdown-free-table.js';

// #196: 작업 가능성 열은 조건부 표시되므로 헤더 2종을 모두 인정한다.
const headerLines = FREE_TABLE_HEADERS.flatMap(header => header.split('\n'));

/** p85 잔재 가드: 레터 body의 Free 섹션이 실제 데이터 행을 갖는지 본다.
 *  사유 문자열은 발행 전 디버깅용이며 표시 문구와 문서 문자열을 다시 만들지 않는다. */
export function freeSectionProblem(body: string): string | undefined {
  const start = body.indexOf(FREE_HEADING);
  if (start < 0) return 'free section missing';
  const next = body.indexOf('\n## ', start + FREE_HEADING.length);
  const section = body.slice(start, next < 0 ? body.length : next);
  if (section.includes(FREE_EMPTY_NOTE)) return 'free collection failed';

  const lines = section.split('\n');
  const headerIndex = lines.findIndex(line => headerLines.includes(line.trim()));
  if (headerIndex < 0) return 'free table header missing';
  const rows = lines.slice(headerIndex + 1).filter(line => line.trim().startsWith('|') && !line.trim().startsWith('| ---'));
  return rows.length > 0 ? undefined : 'free table has no data rows';
}
