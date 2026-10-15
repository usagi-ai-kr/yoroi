Feature: CLI once --pretty --full 옵션

  Scenario: once --pretty --full은 정상 종료하고 테이블 헤더를 출력한다
    Given all 6 fake providers succeed
    When I run "once --pretty --full"
    Then the CLI exit code is 0
    And the CLI stdout contains "Provider"
    And the CLI stdout contains "Window"
    And the CLI stdout contains "Usage"

  Scenario: once --help에 --full 옵션이 안내된다
    When I run "once --help"
    Then the CLI exit code is 0
    And the CLI stdout contains "--full"
    And the CLI stdout contains "yoroi once --pretty --full"

  Scenario: once --pretty 기본은 n/a를 숨기고 --full은 n/a를 표시한다
    Given provider "codex" reports window "weekly" with used=3 limit=10
    When I run "once --pretty"
    Then the CLI exit code is 0
    And the CLI stdout does not contain "ok n/a"
    And the CLI stdout contains "숨김 1개(n/a)"
    When I run "once --pretty --full"
    Then the CLI exit code is 0
    And the CLI stdout contains "ok n/a"
