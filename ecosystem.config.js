module.exports = {
  apps: [{
    name:    'saldesk-api',
    script:  './backend/server.js',
    cwd:     '/var/www/saldesk',
    instances: 1,
    autorestart: true,
    watch:   false,
    max_memory_restart: '1G',

    env_production: {
      NODE_ENV: 'production',
      PORT:     3001,
    },

    // Logs
    out_file:   '/var/log/saldesk/api-out.log',
    error_file: '/var/log/saldesk/api-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,

    // Reiniciar com backoff exponencial
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
  }]
};
