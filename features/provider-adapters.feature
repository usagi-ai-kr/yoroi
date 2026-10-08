Feature: 실제 공급자 어댑터 fake 전송 통합

  Scenario: 다섯 실제 어댑터가 서로 다른 fake 전송으로 모두 성공한다
    Given the five real provider adapters with fake transports
    When I run "once"
    Then the CLI exit code is 0
    And stdout has results for providers "ollama-pro,opencode-go,codex,agy,claude"
    And the CLI stdout contains "- m [percent]"
    And the CLI stdout does not contain "- session [percent]"
    And the CLI stdout contains "- 5h [percent]"
    And the CLI stdout contains "- 5h [percent] usage_status=n/a used=unknown remaining=unknown limit=unknown percent=40"
    And the CLI stdout contains "- g-w [percent]"
    And the CLI stdout contains "- c-5h [percent]"
    And the CLI stdout contains "- 5h [percent] usage_status=n/a used=unknown remaining=unknown limit=unknown percent=35 reset=2026-10-08T06:00:00.000Z"
    And the CLI stdout contains "- w [percent] usage_status=optimal used=unknown remaining=unknown limit=unknown percent=60 reset=2026-10-10T00:00:00.000Z"

  Scenario: ollama-pro 현재 activity 스키마에서 activity·구매 크레딧 행을 숨긴다
    Given the five real provider adapters with fake transports
    And real adapter "ollama-pro" uses the current activity schema
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "windows=1"
    And the CLI stdout does not contain "windows hidden"
    And the CLI stdout contains "- m [USD]"
    And the CLI stdout does not contain "credits:purchased"
    And the CLI stdout does not contain "activity:7d"

  Scenario: ollama-pro에 표시 대상이 없으면 창 0개와 숨김 안내를 출력한다
    Given the five real provider adapters with fake transports
    And real adapter "ollama-pro" payload omits the monthly window
    When I run "once"
    Then the CLI exit code is 0
    And stdout has results for providers "ollama-pro,opencode-go,codex,agy,claude"
    And the CLI stdout contains "ollama-pro: ok"
    And the CLI stdout contains "windows=0 (3 windows hidden)"
    And the CLI stdout does not contain "- session [percent]"
    And the CLI stdout does not contain "- weekly [percent]"

  Scenario: HTTP와 CLI 일부 실패가 나머지 성공과 격리된다
    Given the five real provider adapters with fake transports
    And real adapter "opencode-go" receives HTTP status 401
    And real adapter "agy" CLI exits with code 3
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "opencode-go: error [authentication]"
    And the CLI stdout contains "agy: error [exit]"
    And stdout has results for providers "ollama-pro,codex,claude"

  Scenario: 실제 어댑터 watch가 반복 수집 후 종료 signal로 정리된다
    Given the five real provider adapters with fake transports
    And fake scheduler stops after 2 sleeps
    When I run "watch"
    Then the CLI exit code is 0
    And the adapter output contains 10 provider result headers
    And scheduler slept "60000,60000"
    And the signal subscription is cleaned up
