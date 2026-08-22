import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { startIndexer } from './indexer';
import { startKeeper } from './keeper';

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('socket connected: ' + socket.id);

  socket.on('join_game', (gameId: string) => {
    socket.join('game:' + gameId);
    console.log('socket ' + socket.id + ' joined room game:' + gameId);
  });

  socket.on('leave_game', (gameId: string) => {
    socket.leave('game:' + gameId);
  });

  socket.on('ping', (data) => {
    socket.emit('pong', data ?? null);
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected: ' + socket.id);
  });
});

export { io };

server.listen(Number(PORT), () => {
  console.log('Server listening on http://localhost:' + PORT);

  // Start background on-chain services
  startIndexer();
  startKeeper();
});
