Feature: 실제 공급자 어댑터 fake 전송 통합

  Scenario: 다섯 실제 어댑터가 서로 다른 fake 전송으로 모두 성공한다
    Given the five real provider adapters with fake transports
    When I run "once"
    Then the CLI exit code is 0
    And stdout has results for providers "ollama-pro,opencode-go,codex,agy,claude"
    And the CLI stdout contains "- session [percent]"
    And the CLI stdout contains "- rolling [percent]"
    And the CLI stdout contains "- codex:primary:300m [percent]"
    And the CLI stdout contains "- gemini-models:weekly-limit-remaining [percent]"
    And the CLI stdout contains "- session:5h [percent]"

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
