# Free 조합 정합·차선 캡션·시각화 보강 분배 (2026-10-21)

- 이슈: #261. #260 표시 규칙을 자격/매칭에도 사용한다.
- 사용자 정정: Free 조합에 MiniMax·Beam이 들어가야 하고, 유료 Kimi/MiMo Pro/GLM 5.3은 빠져야 한다.
  차선 캡션은 역할별 개별 라인, 이모지·뱃지를 더 적극적으로 쓴다.

## 1. Free 조합 매칭

- `-free`·effort 접미사를 **canonical id**로 정규화해 open/free 자격 판정에 쓴다.
  #260 `model-display-rules.json`과 같은 규칙을 공유한다(표시=자격).
- 두 번째 정책을 **Free**로 확정한다. verified Free catalog(Beam 포함)만 후보.
  유료 오픈 모델 Kimi K3·MiMo Pro·GLM 5.3은 제외한다. 라벨은 `Free`.
- 현재 데이터 기대: 1+1+3 O deepseek → R minimax → W mimo-flash/glm-flash/beam,
  1+2 O deepseek → W minimax/mimo-flash. Beam은 점수 없는 Free fallback으로 필요 시만.
- Free 후보 총점은 측정 슬롯만 합산하고 미측정 수를 별도 노출한다(기존 계약 유지).

## 2. 차선 캡션

- 각 Mermaid fence 아래에 역할별 **개별 라인**:
  ```
  **🥈 차선**
  - 🧭 오케스트레이터: <model>
  - 🔍 리뷰어: <model>
  - 🛠️ 워커: <model>
  ```
- 1+2는 리뷰어 슬롯이 없으므로 리뷰어 라인을 넣지 않는다.
- 후보 없음은 `-`, 구성 불가 조합은 캡션 생략 또는 `- ⚠️ 구성 불가`.
- 차선은 Mermaid 내부가 아니라 fence 밖. 조합 모델 재사용 금지.

## 3. 이모지·뱃지

- Mermaid 노드 라벨에 역할 이모지: 🧭 오케스트레이터, 🔍 리뷰어, 🛠️ 워커 N.
- Free 후보는 `🆓` 또는 `(Free)` 표시.
- 각 조합 제목 아래에 정책·슬롯 badges 1~2개:
  - `![best](https://img.shields.io/badge/🥇_가장_최선-1+1+3-blue)`
  - `![free](https://img.shields.io/badge/🆓_Free-1+1+3-2ea44f)`
  - 필요 시 slots badge. URL 인코딩·과도한 badge 금지.
- GitHub Markdown에서 렌더되는 형태로만. 표·점수·순위는 불변.

## 검증

- Free 조합에 MiniMax·Beam이 실제 등장하고, Kimi/MiMo Pro/GLM 5.3은 없다.
- 4개 Mermaid, 차선 라인, 1+2 리뷰어 없음, fence 밖 캡션, 내부 id 불변.
- Top7/Top15·Free 표·댓글·publish 불변, 전체 check/validate/diff, r 리뷰 PASS.
- 파일 100줄 이하. 필요 시 helper 분리.

## 소유

- w3: 위 조합·Free·캡션·Mermaid·Free catalog 전달·테스트·문서.
- r: 구현 후 독립 리뷰.
