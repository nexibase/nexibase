module.exports = {
  apps: [
    {
      name: 'nexibase-home',
      script: 'npm',
      args: 'start -- -p 9119',
      cwd: '/home/kagla/_nexibase.com',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
