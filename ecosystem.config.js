module.exports = {
  apps: [{
    name:    'saldesk-api',
    script:  './backend/server.js',
    /* O checkout git real e /var/www/saldesk/repo, nao /var/www/saldesk
       directamente (esse e so o directorio pai, onde app/website/uploads
       tambem vivem como pastas irmas separadas). Um cwd errado aqui nao
       se nota em "pm2 restart" de um processo ja registado (reaproveita
       o estado antigo), mas parte um "pm2 delete && pm2 start" a frio. */
    cwd:     '/var/www/saldesk/repo',
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
  }, {
    /* Worker da outbox de mensagens (camada MessagingProvider): processo proprio,
       nunca dentro do servidor web. Le o .env do backend pelo caminho do ficheiro. */
    name:    'saldesk-messaging-worker',
    script:  './backend/src/messaging/messagingWorker.js',
    cwd:     '/var/www/saldesk/repo',
    instances: 1,
    autorestart: true,
    watch:   false,
    max_memory_restart: '300M',
    env_production: { NODE_ENV: 'production' },
    // Logs nos locais de origem do PM2 (~/.pm2/logs), como o saldesk-api no servidor.
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
  }]
};
