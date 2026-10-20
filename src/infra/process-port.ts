export interface ProcessStep {
  readonly input: string;
  readonly responseId: number;
}
export interface ProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  readonly env?: Readonly<Record<string, string>>;
  /** 'merge'(기본): 호스트 env에 request.env를 덮는다. 'replace': request.env만 쓴다. */
  readonly envMode?: 'merge' | 'replace';
  readonly input?: string;
  readonly steps?: readonly ProcessStep[];
}
export interface ProcessOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}
export interface ProcessRunner {
  run(request: ProcessRequest, signal?: AbortSignal): Promise<ProcessOutput>;
}
