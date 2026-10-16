# 완료 감지 하네스 개선과 발행 병행

- 사용자 요청: 하네스 개선은 스킬·룰·스크립트·문서 전반. 문제 발생 시 자동 적용.
- 관측: w1 done, PR170 MERGED, main CI38861070165 success인데 JSON보고서 누락으로 대기 반복.
- 실 mainSHA: ea381c61b794390c43ac85cc2b515f0022c1af2a. 실제완료와보고수신은별개.
- w1: coord 완료/보고누락 감지·누적대기상한·의미있는회귀.
- w2: harness-improvement 전문스킬·AGENTS 상시적용규칙·개발/협업문서.
- w3: 먼저 승인된1.0.3 Release와global/letter발행 흐름 계속.
- 보고파일 없고 done/idle이면 대기연장 대신 실제 산출물·CI·외부상태 즉시대조.
- done만으로성공간주·JSON없는상태실패간주 모두금지. 상태별다음행동명시.
- 동일task 반복watch에서최초전송기준누적상한유지, timeout무한리셋금지.
- 재전송·모델/패널변경·자동merge승인확장금지. w12만사용.
- 스킬은레포고유값없이재사용, 이사건값·증거는docs에기록.
- 사용자이번요청으로하네스범위규칙수정허가, 다른AGENTS규칙/README변경없음.
- 파일100줄·원본dirty보존·skill portability·validate·독립리뷰필수.
- 제품발행지연하지않게병렬진행, 각단위보고누락시상태+산출물로추적.
