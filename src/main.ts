#!/usr/bin/env node
import { loadEnvFile } from "./config/env-file.js";
import { compose } from "./composition-root.js";
import { runCalibrationCli } from "./insights/calibration-cli.js";
import { NodeProcessRunner } from "./infra/process-runner.js";
import { openCalibrationStore } from "./insights/calibration-store-sqlite.js";
import type { CalibrationStore } from "./insights/calibration-store.js";

let envFailed = false;
try { loadEnvFile(); } catch { envFailed = true; }
const rawArgv = process.argv.slice(2);

let exitCode = 1;
if (envFailed) {
  exitCode = 2;
} else if (rawArgv[0] === "insights" && rawArgv[1] === "calibrate") {
  let store: CalibrationStore | undefined;
  try {
    store = openCalibrationStore(process.env);
  } catch (error) {
    console.error(`calibration: failed to open calibration store; fail-closed (${error instanceof Error ? error.message : String(error)})`);
    exitCode = 1;
  }
  if (store) {
    try {
      exitCode = await runCalibrationCli(rawArgv.slice(2), {
        runner: new NodeProcessRunner(),
        store,
      });
    } finally {
      store.close();
    }
  }
} else {
  exitCode = await compose().run(rawArgv);
}
process.exitCode = exitCode;
