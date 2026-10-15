Feature: 명시 주입 fake 6개 공급자 CLI once 수용 시나리오

  Scenario: 모든 공급자가 성공하면 once는 6개 결과를 출력한다
    Given all 6 fake providers succeed
    When I run "once"
    Then the CLI exit code is 0
    And stdout has results for providers "ollama-pro,opencode-go,codex,agy,claude,xai"

  Scenario: 한 공급자가 실패해도 나머지 결과와 오류가 함께 출력된다
    Given provider "codex" fails with "timeout"
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "codex: error [timeout]"
    And stdout has results for providers "ollama-pro,opencode-go,agy,claude,xai"

  Scenario: once는 관측시각과 usage창, 미제공 값 unknown을 출력한다
    Given provider "codex" reports window "weekly" with used=3 limit=10
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "observed=2026-10-07T00:00:00Z"
    And the CLI stdout contains "- weekly [requests] usage_status=n/a used=3 remaining=unknown limit=10"

  Scenario: usage창 percent와 관측시각을 출력한다
    Given provider "codex" reports window "weekly" with percent=30
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "observed=2026-10-07T00:00:00Z"
    And the CLI stdout contains "used=unknown remaining=unknown limit=unknown percent=30 reset=unknown"

  Scenario: usage창이 없으면 미제공을 명확히 표시한다
    Given all 6 fake providers succeed
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "codex: ok observed=2026-10-07T00:00:00Z windows=0 (no usage windows reported)"

  Scenario: 모든 공급자가 실패하면 once는 1을 반환한다
    Given all 6 fake providers fail
    When I run "once"
    Then the CLI exit code is 1
    And the CLI stdout contains "ollama-pro: error [timeout]"

  Scenario: watch는 제거 안내와 once 대안을 주고 인자 오류 2를 반환한다
    Given all 6 fake providers succeed
    When I run "watch"
    Then the CLI exit code is 2
    And the CLI stderr contains "removed"
    And the CLI stderr contains "once"

  Scenario: once --help는 서브커맨드 사용법을 출력하고 0을 반환한다
    Given all 6 fake providers succeed
    When I run "once --help"
    Then the CLI exit code is 0
    And the CLI stdout contains "usage: yoroi once"
