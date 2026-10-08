Feature: 기본 5개 공급자 및 격리 정책

  Scenario: 설정 미지정 시 기본 5개 공급자가 모두 실행된다
    Given default configuration without YOROI_PROVIDERS
    And all 5 providers succeed in composition
    When I run composed CLI "once"
    Then the composed CLI exit code is 0
    And composed stdout contains all 5 provider results

  Scenario: 키 없는 API가 인증 오류로 격리되어도 다른 결과가 유지된다
    Given default configuration without credentials
    And API providers fail with authentication while others succeed
    When I run composed CLI "once"
    Then the composed CLI exit code is 0
    And composed stdout contains "ollama-pro: error [authentication]"
    And composed stdout contains "opencode-go: error [authentication]"
    And composed stdout contains "claude: error [authentication]"
    And composed stdout contains "codex: ok"

  Scenario: 조회 지연 후 완료 시점 기준으로 60초 대기한다
    Given default composition with 50ms collection delay
    And composed scheduler stops after 2 cycles
    When I run composed CLI "watch"
    Then the composed CLI exit code is 0
    And each sleep interval is 60000 ms nonoverlapping
    And timeline confirms cycle 1 from 0 to 50 and cycle 2 from 60050
