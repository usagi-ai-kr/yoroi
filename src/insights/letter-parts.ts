/** 레터 본문·댓글 분리 발행 단위: 본문 1개 + 순서 고정 댓글 3개(오케 Top15·워커 Top15·Free). */
export interface LetterParts {
  readonly body: string;
  readonly comments: readonly [string, string, string];
}
/** 미리보기용 결합: body 뒤에 각 댓글을 구분자로 붙인다. */
export function joinLetterParts(parts: LetterParts): string {
  return parts.body + parts.comments.map((comment, index) => `\n\n<!-- yoroi:comment ${index + 1} -->\n${comment}`).join('');
}
