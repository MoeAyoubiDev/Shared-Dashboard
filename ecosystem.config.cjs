// PM2 process definition for the Shared Dashboard.
// Runs the production Next.js server and binds it to PORT (default 8003).
module.exports = {
  apps: [
    {
      name: 'shared-dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '450M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '8003',
      },
    },
  ],
};
