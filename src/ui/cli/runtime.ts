export const nodeEnvironment = {
  stdout: (text: string): void => { process.stdout.write(`${text}\n`); },
  stderr: (text: string): void => { process.stderr.write(`${text}\n`); },
};

export function processSignals(handler: () => void): () => void {
  const onSignal = (): void => { handler(); };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  return () => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  };
}
