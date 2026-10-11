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

  Scenario: plugin load mark is shown explicitly and never changes the lock
    When I read Zen free status
    Then the Zen free output contains "plugin-loaded: not recorded"
    When the OpenCode plugin reports that it loaded
    And I read Zen free status
    Then the Zen free output contains "plugin-loaded: 20"
    And the Zen free status is "unknown"

  Scenario: report exceeded with retry duration shows remaining time
    When I report Zen free exceeded with retry in 1800 seconds
    Then the Zen free status is "locked"
    And the Zen free output contains "locked_for="
    And the Zen free output contains "retry_in=30m"
    When I read Zen free status
    Then the Zen free output contains "locked_for="
    And the Zen free output contains "retry_in=30m"
