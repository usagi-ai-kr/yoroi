# README 이미지

- 파일: `docs/assets/yoroi-haunted-armor.jpg`
- 생성 모델: Google `gemini-nano-banana-2.1` (Nano Banana 2.1)
- 요청: 16:9, 2K. 실제 출력: 2752 × 1536 JPEG.
- 생성일: 2026-10-08. API 키와 원본 응답은 저장하지 않는다.
- 일본 만화 치이카와 느낌의 둥근 비율과 단순한 선을 사용한 중세 유럽 기사 갑옷 마스코트다.

## 프롬프트

GitHub README cover illustration: a cute ghost-possessed suit of medieval European knight armor
as an original mascot. Chiikawa Japanese manga/anime aesthetic: round tiny chibi
proportions, warm dark-brown hand-drawn outlines, dot eyes, tiny mouth, pink cheeks,
muted pastel colors and minimal soft shading. A friendly white ghost peeks through
the helmet visor, with pale mint wisps drifting out of loose armor joints.
Rounded steel-gray knight helmet with raised visor, breastplate, compact pauldrons,
stubby plate gauntlets and sabatons. No samurai crest, horns or lamellar plates.
The empty suit floats above a soft oval shadow. Wide 16:9 composition, centered
complete character with airy space, warm off-white background and a few ghost sparks.
Cute and slightly spooky. No gore, realistic metal, 3D rendering, gradients, letters,
title, speech bubbles, logo or visible watermark.

- 사용자 수정 요청에 따라 최초 사무라이 갑옷 이미지를 같은 모델의 입력 이미지로 전달해
  중세 유럽 판금 갑옷으로 편집했다. 유령·그림체·구도·배경은 유지했다.

## 재생성 참고

- REST 경로는 `v1beta/models/gemini-nano-banana-2.1:generateContent`를 사용했다.
- `responseModalities: ["IMAGE"]`와 `responseFormat.image`를 설정했다.
- 비율·크기는 문자열 `16:9`·`2K` 대신 아래 열거형을 사용해야 요청이 성공했다.
  `aspectRatio: "ASPECT_RATIO_SIXTEEN_BY_NINE"`, `imageSize: "IMAGE_SIZE_TWO_K"`.
- SDK·REST 스키마는 다를 수 있으므로 재생성 시 공식 API discovery를 확인한다.
- 이미지 결과를 확인한 뒤 README 상대 경로로 연결한다. 키·base64 응답은 기록하지 않는다.
