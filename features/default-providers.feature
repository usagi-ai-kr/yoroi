Feature: 기본 5개 공급자 및 격리 정책

  Scenario: 설정 미지정 시 기본 5개 공급자가 모두 실행된다
    Given default configuration without YOROI_PROVIDERS
    And all 5 providers succeed in composition
    When I run composed CLI "once"
    Then the composed CLI exit code is 0
    And composed stdout contains all 5 provider results
    And xai process is not executed in default path

  Scenario: YOROI_PROVIDERS에 xai를 명시하면 xai 공급자가 실행된다
    Given configuration with YOROI_PROVIDERS "xai"
    When I run composed CLI "once"
    Then the composed CLI exit code is 0
    And composed stdout contains "xai: ok"

  Scenario: 키 없는 API가 인증 오류로 격리되어도 다른 결과가 유지된다
    Given default configuration without credentials
    And API providers fail with authentication while others succeed
    When I run composed CLI "once"
    Then the composed CLI exit code is 0
    And composed stdout contains "ollama-pro: error [authentication]"
    And composed stdout contains "opencode-go: error [authentication]"
    And composed stdout contains "claude: error [authentication]"
    And composed stdout contains "codex: ok"
