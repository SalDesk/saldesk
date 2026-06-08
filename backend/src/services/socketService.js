let io = null;

/* operatorId -> Set of socketIds */
const onlineOperators = new Map();

function initSocket(server) {
  const { Server } = require('socket.io');
  const corsOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((s) => s.trim())
    : [];

  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'development' ? '*' : corsOrigins,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    const { operatorId, userId, role } = socket.handshake.auth;

    if (role === 'FUNDADOR') {
      socket.join('admin:fundador');
      socket.on('disconnect', () => {});
      return;
    }

    if (!operatorId) { socket.disconnect(); return; }

    socket.join(`operator:${operatorId}`);
    if (userId) socket.join(`user:${userId}`);

    /* Registo de presenca */
    if (!onlineOperators.has(operatorId)) onlineOperators.set(operatorId, new Set());
    onlineOperators.get(operatorId).add(socket.id);
    io.to('admin:fundador').emit('admin:operator:online', { operatorId });

    socket.on('join:room',  (room) => socket.join(room));
    socket.on('leave:room', (room) => socket.leave(room));

    socket.on('disconnect', () => {
      const sockets = onlineOperators.get(operatorId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineOperators.delete(operatorId);
          if (io) io.to('admin:fundador').emit('admin:operator:offline', { operatorId });
        }
      }
    });
  });

  console.log('[Socket.io] Servidor iniciado');
  return io;
}

function getIo() { return io; }

function isOperatorOnline(operatorId) {
  return onlineOperators.has(operatorId) && onlineOperators.get(operatorId).size > 0;
}

function getOnlineOperatorIds() {
  return [...onlineOperators.keys()];
}

function emitToOperator(operatorId, event, data) {
  if (!io) return;
  io.to(`operator:${operatorId}`).emit(event, data);
}

function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

function emitToAdmin(event, data) {
  if (!io) return;
  io.to('admin:fundador').emit(event, data);
}

module.exports = {
  initSocket, getIo,
  isOperatorOnline, getOnlineOperatorIds,
  emitToOperator, emitToUser, emitToAdmin,
};
