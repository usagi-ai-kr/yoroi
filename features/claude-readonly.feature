Feature: Claude 사용량은 GET usage 전용 HTTP로만 조회한다

  Scenario: once는 Claude usage를 GET 한 번으로 조회한다
    Given the claude read-only source with four fake providers
    When I run "once"
    Then the CLI exit code is 0
    And claude usage requests are 1
    And every claude usage request is a GET without body
    And stdout has results for providers "ollama-pro,opencode-go,codex,agy,claude"
