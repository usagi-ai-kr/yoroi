Feature: OpenCode Zen free local lock
  Scenario: report and read lock status without providers
    When I report Zen free exceeded for model "free"
    Then the Zen free status is "locked"
    When I read Zen free status
    Then the Zen free status is "locked"

  Scenario: once output includes the locally stored Zen status
    Given Zen free is locally clear
    When I run Zen free once in pretty mode
    Then the Zen free output contains "opencode-zen-free"

  Scenario: Zen free help is available
    When I open Zen free help
    Then the Zen free exit code is 0
    And the Zen free output contains "usage: yoroi zen-free"
