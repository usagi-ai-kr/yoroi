Feature: Ollama 실패에도 나머지 공급자 수집 유지

  Scenario: Ollama 인증이 거부돼도 나머지 4개 공급자는 수집된다
    Given the real adapters with Ollama authentication rejected
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "ollama-pro: error [authentication]"
    And stdout has results for providers "opencode-go,codex,agy,claude"

  Scenario: Ollama 응답 포맷이 바뀌어도 나머지 4개 공급자는 수집된다
    Given the real adapters with a changed Ollama response format
    When I run "once"
    Then the CLI exit code is 0
    And the CLI stdout contains "ollama-pro: error [parse]"
    And stdout has results for providers "opencode-go,codex,agy,claude"

  Scenario: Ollama 실패는 collectOnce에서도 다른 4개 결과를 유지한다
    Given the real adapters with Ollama authentication rejected
    When the adapters collect once
    Then 5 adapter results contain 1 error with code "authentication"
    And 4 adapter results contain a snapshot
