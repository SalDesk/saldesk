const { supabaseAdmin } = require('../config/supabase');

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

  /* Auth middleware — decode JWT server-side instead of trusting client-supplied operatorId */
  io.use(async (socket, next) => {
    const { token, role } = socket.handshake.auth;

    if (role === 'FUNDADOR') {
      socket.data.role = 'FUNDADOR';
      return next();
    }

    if (!token) return next(new Error('Unauthorized'));

    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) return next(new Error('Unauthorized'));

      let operatorId = null;

      const { data: operator } = await supabaseAdmin
        .from('operators').select('id').eq('user_id', user.id).single();

      if (operator) {
        operatorId = operator.id;
      } else if (user.user_metadata?.staff_id) {
        const { data: staff } = await supabaseAdmin
          .from('staff').select('operator_id')
          .eq('id', user.user_metadata.staff_id).eq('status', 'active').single();
        if (staff) operatorId = staff.operator_id;
      }

      if (!operatorId) return next(new Error('Unauthorized'));

      socket.data.operatorId = operatorId;
      socket.data.userId     = user.id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { role, operatorId, userId } = socket.data;

    if (role === 'FUNDADOR') {
      socket.join('admin:fundador');
      socket.on('disconnect', () => {});
      return;
    }

    socket.join(`operator:${operatorId}`);
    if (userId) socket.join(`user:${userId}`);

    /* Registo de presenca */
    if (!onlineOperators.has(operatorId)) onlineOperators.set(operatorId, new Set());
    onlineOperators.get(operatorId).add(socket.id);
    io.to('admin:fundador').emit('admin:operator:online', { operatorId });

    socket.on('join:room',  (room) => socket.join(room));
    socket.on('leave:room', (room) => socket.leave(room));

    socket.on('typing:start', ({ to }) => socket.to(`user:${to}`).emit('typing:start', { from: userId }));
    socket.on('typing:stop',  ({ to }) => socket.to(`user:${to}`).emit('typing:stop',  { from: userId }));

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
