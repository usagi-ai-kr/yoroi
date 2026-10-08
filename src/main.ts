#!/usr/bin/env node
import { loadEnvFile } from "./config/env-file.js";
import { compose } from "./composition-root.js";

loadEnvFile();
const exitCode = await compose().run(process.argv.slice(2));
process.exitCode = exitCode;
