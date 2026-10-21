/** 레터 본문·댓글 분리 발행 단위: 본문 1개 + 순서 고정 댓글 3개(오케 Top15·워커 Top15·Free). */
export type LetterComments = readonly [string, string, string];
export interface LetterParts {
  readonly body: string;
  readonly comments: LetterComments;
  /** Free 섹션 문자열(2역할은 comments[2] 와 동일). 3/4역할 조립은 마지막 댓글에 붙인다(U3b). */
  readonly freeSection?: string;
}
/** 미리보기용 결합: body 뒤에 각 댓글을 구분자로 붙인다. */
export function joinLetterParts(parts: LetterParts): string {
  return parts.body + parts.comments.map((comment, index) => `\n\n<!-- yoroi:comment ${index + 1} -->\n${comment}`).join('');
}
