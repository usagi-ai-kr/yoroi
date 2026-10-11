// Example pm2 process file for `yoroi detect`. Nothing in this repository registers it for you;
// see docs/detect.md ("실행·중지·복구") before running `pm2 start`. Not verified against a live pm2 here.
// There is intentionally no `env` block: provider credentials come from the environment pm2 is started in,
// and secrets must never be written into this file.
module.exports = {
  apps: [{
    name: 'yoroi-detect',
    script: 'yoroi',
    args: 'detect',
    interpreter: 'none',   // yoroi is a global executable, not a Node script path
    exec_mode: 'fork',
    instances: 1,          // one detector: a second one would only wait on the lease
    autorestart: true,
    min_uptime: '30s',
    max_restarts: 10,
    restart_delay: 5000,
    kill_timeout: 15000,   // time for SIGTERM to release the lease before SIGKILL
    time: true,
  }],
};
