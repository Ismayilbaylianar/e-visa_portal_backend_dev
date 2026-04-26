/**
 * PM2 Ecosystem Configuration for E-Visa Portal Backend
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 *   pm2 stop evisa-backend
 *   pm2 delete evisa-backend
 * 
 * Location on server: /var/www/evisa-backend/app/ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      // Application identity
      name: 'evisa-backend',
      script: './dist/src/main.js',
      cwd: '/var/www/evisa-backend/app',

      // Process management
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      // Restart behavior
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      exp_backoff_restart_delay: 100,

      // Logging
      log_file: '/var/log/evisa/app.log',
      error_file: '/var/log/evisa/error.log',
      out_file: '/var/log/evisa/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Environment variables for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Environment variables for staging (future use)
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
    },
  ],

  // Deployment configuration (for future CI/CD)
  deploy: {
    production: {
      user: 'anar',
      host: '46.224.16.161',
      ref: 'origin/main',
      repo: 'git@github.com:Ismayilbaylianar/e-visa_portal_backend_dev.git',
      path: '/var/www/evisa-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci && npx prisma generate && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
};
