#!/usr/bin/env node
import { loadEnvFile } from "./config/env-file.js";
import { compose } from "./composition-root.js";

let envFailed = false;
try { loadEnvFile(); } catch { envFailed = true; }
const exitCode = envFailed ? 2 : await compose().run(process.argv.slice(2));
process.exitCode = exitCode;
