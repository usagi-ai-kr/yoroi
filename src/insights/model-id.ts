/** OpenRouter식 말단 태그(:free·:beta)만 떼어낸다. 콜론 크기 표기(gpt-oss:120b)는 남긴다. */
function stripTrailingTag(base: string): string {
  return base.replace(/:(?:free|beta)$/, '');
}
function isCalendarDate(year: number, month: number, day: number): boolean {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return month >= 1 && month <= 12 && day >= 1 && day <= (days ?? 0);
}
/** 말단 달력 날짜 스냅샷(-YYYY-MM-DD/-YYYYMMDD/-MMDD)만 지운다. 연도 단독·무효 날짜는 보존. */
function stripTrailingSnapshot(base: string): string {
  const iso = /-(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (iso !== null) return isCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? base.slice(0, iso.index) : base;
  const compact = /-(\d{4})(\d{2})(\d{2})$/.exec(base);
  if (compact !== null) return isCalendarDate(Number(compact[1]), Number(compact[2]), Number(compact[3])) ? base.slice(0, compact.index) : base;
  const mmdd = /-(\d{2})(\d{2})$/.exec(base);
  return mmdd !== null && isCalendarDate(2000, Number(mmdd[1]), Number(mmdd[2])) ? base.slice(0, mmdd.index) : base;
}
export interface TrailingSnapshot { readonly raw: string; readonly kind: 'iso' | 'compact' | 'mmdd'; readonly fullDate: string | null }
/** 정규화 전 원본 id의 말단 날짜 스냅샷을 읽는다(검증 규칙은 stripTrailingSnapshot과 동일). 없으면 undefined.
 *  mmdd는 연도가 없어 fullDate=null이다(같은 표기끼리만 비교하는 신호). */
export function trailingSnapshot(id: string): TrailingSnapshot | undefined {
  const base = (id.split('/').pop() ?? '').toLowerCase().trim();
  const iso = /-(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (iso !== null && isCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3])))
    return { raw: iso[0].slice(1), kind: 'iso', fullDate: `${iso[1]}-${iso[2]}-${iso[3]}` };
  const compact = /-(\d{4})(\d{2})(\d{2})$/.exec(base);
  if (compact !== null && isCalendarDate(Number(compact[1]), Number(compact[2]), Number(compact[3])))
    return { raw: `${compact[2]}${compact[3]}`, kind: 'compact', fullDate: `${compact[1]}-${compact[2]}-${compact[3]}` };
  const mmdd = /-(\d{2})(\d{2})$/.exec(base);
  if (mmdd !== null && isCalendarDate(2000, Number(mmdd[1]), Number(mmdd[2])))
    return { raw: `${mmdd[1]}${mmdd[2]}`, kind: 'mmdd', fullDate: null };
  return undefined;
}
/** A2(p28): AA id 선두 벤더 접두 제거(OR은 '/' 세그먼트 제거로 이미 같아진다). 남는 토큰은 건드리지 않는다. */
const stripVendorPrefix = (base: string): string => base.replace(/^nvidia-/, '');
/** A3(p28): claude-<버전>-<등급> → claude-<등급>-<버전>. 등급 집합은 닫혀 있다(opus·sonnet·haiku·fable). */
const orderClaude = (base: string): string =>
  base.replace(/^claude-(\d+(?:-\d+)*)-(opus|sonnet|haiku|fable)(-.*)?$/, 'claude-$2-$1$3');
/** A4(p28): gemma 계열 지시 튜닝 '-it' 제거(AA는 해당 튜닝 모델만 측정). */
const stripGemmaIt = (base: string): string => /^gemma(?:-|$)/.test(base) ? base.replace(/-it$/, '') : base;
export function normalizeModelName(id: string): string {
  const base = (id.split('/').pop() ?? '').toLowerCase().trim();
  const normalized = stripTrailingSnapshot(stripTrailingTag(base)).replace(/(?<=\d)\.(?=\d)/g, '-');
  return stripGemmaIt(orderClaude(stripVendorPrefix(normalized)));
}
