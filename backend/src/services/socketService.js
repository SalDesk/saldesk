let io = null;

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
    if (!operatorId) { socket.disconnect(); return; }

    socket.join(`operator:${operatorId}`);
    if (userId) socket.join(`user:${userId}`);

    socket.on('join:room', (room) => socket.join(room));
    socket.on('leave:room', (room) => socket.leave(room));
    socket.on('disconnect', () => {});
  });

  console.log('[Socket.io] Servidor iniciado');
  return io;
}

function getIo() { return io; }

function emitToOperator(operatorId, event, data) {
  if (!io) return;
  io.to(`operator:${operatorId}`).emit(event, data);
}

function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

module.exports = { initSocket, getIo, emitToOperator, emitToUser };
