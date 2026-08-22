import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import app from './app';

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  // eslint-disable-next-line no-console
  console.log(`socket connected: ${socket.id}`);

  socket.on('ping', (data) => {
    socket.emit('pong', data ?? null);
  });

  socket.on('disconnect', () => {
    // eslint-disable-next-line no-console
    console.log(`socket disconnected: ${socket.id}`);
  });
});

export { io };

server.listen(Number(PORT), () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
