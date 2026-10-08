Feature: Claude 사용량은 GET usage 전용 HTTP로만 조회한다

  Scenario: once는 Claude usage를 GET 한 번으로 조회한다
    Given the claude read-only source with four fake providers
    When I run "once"
    Then the CLI exit code is 0
    And claude usage requests are 1
    And every claude usage request is a GET without body
    And stdout has results for providers "ollama-pro,opencode-go,codex,agy,claude"

  Scenario: watch는 독립된 2개 주기에서 Claude GET을 주기마다 1회 호출한다
    Given the claude read-only source with four fake providers
    And fake scheduler stops after 2 sleeps
    When I run "watch"
    Then the CLI exit code is 0
    And scheduler slept "60000,60000"
    And claude usage requests are 2
    And every claude usage request is a GET without body

  Scenario: 한 주기의 Claude 실패는 다음 주기와 다른 4개 공급자를 유지한다
    Given the claude read-only source with four fake providers
    And claude usage fails with HTTP status 503 on request 1
    And fake scheduler stops after 2 sleeps
    When I run "watch"
    Then the CLI exit code is 0
    And the CLI stdout contains "claude: error"
    And the CLI stdout contains "claude: ok"
    And stdout lines starting with "codex: ok" are 2
    And claude usage requests are 2
    And scheduler slept "60000,60000"
