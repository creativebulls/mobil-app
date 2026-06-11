// PM2 process configuration for the WhereAbout backend.
//
//   pm2 start ecosystem.config.cjs   # start (or reload) the app
//   pm2 logs whereabout-backend      # tail logs
//   pm2 restart whereabout-backend   # restart after a new build
//   pm2 save                         # persist process list across reboots
//
// Run a single fork-mode instance. The API serves Socket.IO on the same HTTP
// server, and websockets require sticky sessions; PM2 cluster mode would round
// robin connections and break realtime events unless a Redis adapter is added.
module.exports = {
  apps: [
    {
      name: 'whereabout-backend',
      script: 'dist/server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      // NODE_ENV drives which .env.<env> file src/config/env.ts loads.
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};
