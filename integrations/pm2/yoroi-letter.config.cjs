// Example pm2 process file for `yoroi insights publish` (the daily letter issue, #125).
// Nothing in this repository registers it for you; see docs/insights/letter-pm2.md before `pm2 start`.
// Not verified against a live pm2 here. There is intentionally no `env` block: credentials come from
// the environment pm2 is started in, and secrets must never be written into this file.
// PM2 runs a cron_restart app once at `pm2 start` and again after every `pm2 resurrect`, so the
// command's own guards (09:00 KST 이전 skip, same-day duplicate skip) are the safety net - the
// schedule only guarantees "at 09:00 KST daily", never "exactly once per day" on its own.
module.exports = {
  apps: [{
    name: 'yoroi-letter',
    script: 'yoroi',
    args: 'insights publish',
    interpreter: 'none',   // yoroi is a global executable, not a Node script path
    exec_mode: 'fork',
    instances: 1,          // one publisher: a second run would only be skipped by the dedupe guard
    autorestart: false,    // cron_restart drives the schedule; crashes report via exit code, no respawn loop
    cron_restart: '0 9 * * *', // daemon timezone must be Asia/Seoul (see docs/insights/letter-pm2.md)
    time: true,
    kill_timeout: 60000,   // collection of four sources plus issue publish can take a while; let it finish
  }],
};
