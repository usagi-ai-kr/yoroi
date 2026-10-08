#!/usr/bin/env node
import { compose } from "./composition-root.js";

const exitCode = await compose().run(process.argv.slice(2));
process.exitCode = exitCode;
