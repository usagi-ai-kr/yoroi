# R 비교 정확성 감사

- 오기 정정: `70.8`은 **최신 필터 없는 bare preview** 값(구 I² 서술 삭제). 정식 grok-4-7은 Top10 밖.
- opus 89.4 vs bare 89.3 차이는 옵션(comparisonDate 최신 필터) 누락 때문으로 확인.
- native 1.0.1 control이 #160 20행과 완전 일치(동일 옵션). worker 10행 불변.
- 최종 표는 [final comparison](orchestrator-r-final-comparison.md).
