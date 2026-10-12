Feature: yoroi insights letter CLI
  Scenario: insights once prints the compact top10 letter to stdout only
    When I run insights once with a synthetic Arena source
    Then the insights exit code is 0
    And the insights stdout contains "오케스트레이터 Top10"
    And the insights stdout contains "출처:"
    And the insights stderr is empty

  Scenario: insights once --full keeps the detailed letter
    When I run insights once --full with a synthetic Arena source
    Then the insights exit code is 0
    And the insights stdout contains "[AI 인사이트 레터]"
    And the insights stdout contains "발행일(KST): 2026-10-09"
    And the insights stderr is empty

  Scenario: the same KST day reuses the stored success without another fetch
    When I run insights once twice on the same KST day
    Then the insights exit code is 0
    And the insights fetch count is 1

  Scenario: every source failing exits 1 with stderr only
    When I run insights once with a failing source
    Then the insights exit code is 1
    And the insights stdout is empty
    And the insights stderr contains "전체 소스 실패"

  Scenario: unknown insights arguments are usage errors
    When I run insights once --json
    Then the insights exit code is 2
    And the insights stderr contains "unexpected argument"

  Scenario: insights help is available
    When I open insights help
    Then the insights exit code is 0
    And the insights stdout has exactly 1 line containing "usage: yoroi insights once"
