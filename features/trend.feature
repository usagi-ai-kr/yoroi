Feature: yoroi trend observation history CLI
  Scenario: trend when DB does not exist
    Given no trend observation history DB exists
    When I run trend
    Then the trend exit code is 0
    And the trend stdout contains "이력 없음"
    And the trend stderr is empty

  Scenario: trend help is available
    When I run trend --help
    Then the trend exit code is 0
    And the trend stdout contains "usage: yoroi trend"
    And the trend stderr is empty

  Scenario: invalid trend arguments exit with code 2
    When I run trend --since 90d
    Then the trend exit code is 2
    And the trend stderr contains "invalid since: 90d"

  Scenario: trend with recorded samples outputs 24h and 7d trends
    Given trend observation history with sample data exists
    When I run trend
    Then the trend exit code is 0
    And the trend stdout contains "24h:"
    And the trend stdout contains "7d:"
    And the trend stderr is empty
