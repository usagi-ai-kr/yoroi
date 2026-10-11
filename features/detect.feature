Feature: yoroi detect built-in detection
  Scenario: detect once writes one stdout line for an exhausted usage window
    Given a Codex window that is at 100 percent
    When I run detect once
    Then the detect exit code is 0
    And the detect stdout has exactly 1 line containing "usage codex/weekly exhausted"
    And the detect stderr is empty

  Scenario: detect status reports no active detector before any run
    When I read detect status
    Then the detect exit code is 0
    And the detect stdout has exactly 1 line containing "no active detector"

  Scenario: detect status reports a running detector while a heartbeat is live
    Given another detector holds a live lease
    When I read detect status
    Then the detect stdout has exactly 1 line containing "detect: running"

  Scenario: watch stays removed
    When I run the removed watch command
    Then the detect exit code is 2
    And the detect stderr contains "watch command removed"

  Scenario: detect help is available
    When I open detect help
    Then the detect exit code is 0
    And the detect stdout has exactly 1 line containing "usage: yoroi detect"
