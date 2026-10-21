# 오픈 웨이트 정정 (2026-10-21, #256)

## 추가 모델
- `muse-spark-1-3`·`minimax-m3-1-flash`를 `openWeights:true`로 등록.
  근거는 사용자 확인(2026-10-21) + 근거 페이지(models.dev·MiniMax 블로그).
- license/version은 확인된 범위만 기재하고, 미확인 부분은
  "별도 검토 필요"로 명시했다. 점수·가중치는 만들지 않았다.

## 근거 한계
- 공식 페이지와 부분 불일치 가능 — note에 명시.
- 라이선스 조건은 별도 검토(기존 MaaS/표시 조건과 별개).

## 오픈 조합 결과
- registry 8개. 두 모델이 키에 있으면 오픈 슬롯에 실제 구성됨(회귀).
- 키 부족 시 구성 불가 + 사유(가짜 모델 없음).

## 검증
- typecheck·validate·diff clean, 전체 `pnpm run check`는 보고서 수치.
