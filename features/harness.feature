Feature: CLI 하네스 실행 계약

  Scenario: 알 수 없는 명령은 사용법을 출력하고 실패한다
    Given fake CLI environment
    When I run command "nope"
    Then exit code is 2
    And stderr contains "usage"

  Scenario: 도움말은 사용법을 출력하고 성공한다
    Given fake CLI environment
    When I run command "--help"
    Then exit code is 0
    And stdout contains "usage"
