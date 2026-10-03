import { Server } from 'socket.io';
import { CLIENT_URL } from '../config/env.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerPlaybackHandlers } from './playbackHandlers.js';

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    registerRoomHandlers(socket, io);
    registerPlaybackHandlers(socket, io);
  });

  return io;
};
