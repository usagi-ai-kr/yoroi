# Yoroi
> AI 사용량 모니터링

![작은 유령이 깃든 귀여운 중세 유럽 기사 갑옷](docs/assets/yoroi-haunted-armor.jpg)

## 전역 CLI 설치와 실행

저장소 경로를 지정해 전역 설치하면 어디서든 `yoroi` 명령을 호출할 수 있습니다.

```bash
pnpm run build
pnpm add -g /path/to/yoroi   # 또는 저장소 디렉터리에서: pnpm add -g .
yoroi --version
yoroi --help
yoroi once --pretty
yoroi watch --pretty
```

전역 설치를 제거할 때는 다음 명령을 실행합니다.

```bash
pnpm remove -g yoroi
```
