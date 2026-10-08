Feature: 5개 공급자 CLI once/watch 수용 시나리오

  Scenario: 모든 공급자가 성공하면 once는 5개 결과를 출력한다
    Given all 5 fake providers succeed
    When I run "once"
    Then the CLI exit code is 0
    And stdout has results for providers "ollama-pro,opencode-go,codex,agy,claude"

  Scenario: 한 공급자가 실패해도 나머지 결과와 오류가 함께 출력된다
    Given provider "codex" fails with "timeout"
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "codex: error [timeout]"
    And stdout has results for providers "ollama-pro,opencode-go,agy,claude"

  Scenario: once는 관측시각과 usage창, 미제공 값 unknown을 출력한다
    Given provider "codex" reports window "weekly" with used=3 limit=10
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "observed=2026-10-07T00:00:00Z"
    And the CLI stdout contains "- weekly [requests] used=3 remaining=unknown limit=10"

  Scenario: usage창 percent와 관측시각을 출력한다
    Given provider "codex" reports window "weekly" with percent=30
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "observed=2026-10-07T00:00:00Z"
    And the CLI stdout contains "used=unknown remaining=unknown limit=unknown percent=30 reset=unknown"

  Scenario: usage창이 없으면 미제공을 명확히 표시한다
    Given all 5 fake providers succeed
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "codex: ok observed=2026-10-07T00:00:00Z windows=0 (no usage windows reported)"

  Scenario: 모든 공급자가 실패하면 once는 1을 반환한다
    Given all 5 fake providers fail
    When I run "once"
    Then the CLI exit code is 1
    And the CLI stdout contains "ollama-pro: error [timeout]"

  Scenario: watch는 즉시 1회 수집하고 60초 단위로 반복한다
    Given all 5 fake providers succeed
    And fake scheduler stops after 2 sleeps
    When I run "watch"
    Then the CLI exit code is 0
    And stdout has 10 result lines
    And scheduler slept "60000,60000"

  Scenario: --interval 초를 지정하면 해당 주기로 수집한다
    Given all 5 fake providers succeed
    And fake scheduler stops after 1 sleeps
    When I run "watch --interval 5"
    Then the CLI exit code is 0
    And scheduler slept "5000"

  Scenario: 중간 주기 공급자 실패 후 다음 주기까지 계속된다
    Given provider "agy" fails on read 2 then succeeds
    And fake scheduler stops after 3 sleeps
    When I run "watch"
    Then the CLI exit code is 0
    And "agy" result 1 is ok
    And "agy" result 2 is an error
    And "agy" result 3 is ok

  Scenario: 종료 signal은 구독을 정리하고 정상 종료한다
    Given all 5 fake providers succeed
    And fake scheduler stops after 1 sleeps
    When I run "watch"
    Then the CLI exit code is 0
    And stdout has 5 result lines
    And the signal subscription is cleaned up

  Scenario: 잘못된 --interval은 인자 오류 2를 반환한다
    Given all 5 fake providers succeed
    When I run "watch --interval 0"
    Then the CLI exit code is 2
    And the CLI stderr contains "usage"
