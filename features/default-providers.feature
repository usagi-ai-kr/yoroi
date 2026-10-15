Feature: 기본 6개 공급자 및 격리 정책

  Scenario: 설정 미지정 시 기본 6개 공급자가 모두 실행된다
    Given default configuration without YOROI_PROVIDERS
    And all 6 providers succeed in composition
    When I run composed CLI "once"
    Then the composed CLI exit code is 0
    And composed stdout contains all 6 provider results

  Scenario: 키 없는 API가 인증 오류로 격리되어도 다른 결과가 유지된다
    Given default configuration without credentials
    And API providers fail with authentication while others succeed
    When I run composed CLI "once"
    Then the composed CLI exit code is 0
    And composed stdout contains "ollama-pro: error [authentication]"
    And composed stdout contains "opencode-go: error [authentication]"
    And composed stdout contains "claude: error [authentication]"
    And composed stdout contains "codex: ok"
