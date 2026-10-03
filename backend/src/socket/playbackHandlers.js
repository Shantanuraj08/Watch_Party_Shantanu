import prisma from '../db/prisma.js';
import { authorizeRoomRole } from './socketAuth.js';

export const registerPlaybackHandlers = (socket, io) => {
  // 1. Play Event
  socket.on('play', async (payload = {}) => {
    try {
      if (!['HOST', 'MODERATOR'].includes(socket.role)) {
        socket.emit('error', { message: 'You do not have permission to perform this action' });
        return;
      }

      const { currentTime } = payload;
      const updateData = { isPlaying: true };

      if (currentTime !== undefined) {
        if (typeof currentTime !== 'number' || !Number.isFinite(currentTime) || currentTime < 0) {
          socket.emit('error', { message: 'currentTime must be a non-negative finite number' });
          return;
        }
        updateData.currentTime = currentTime;
      }

      socket.to(socket.roomId).emit('play', {
        currentTime,
      });

      try {
        await prisma.room.update({
          where: { id: socket.roomId },
          data: updateData,
        });
      } catch (dbError) {
        console.error('Error updating room in database for play:', dbError);
        try {
          await prisma.room.update({
            where: { id: socket.roomId },
            data: updateData,
          });
        } catch (retryError) {
          console.error('Retry failed updating room in database for play:', retryError);
        }
      }
    } catch (error) {
      console.error('Error in play handler:', error);
      socket.emit('error', { message: 'Failed to update play state' });
    }
  });

  // 2. Pause Event
  socket.on('pause', async (payload = {}) => {
    try {
      if (!['HOST', 'MODERATOR'].includes(socket.role)) {
        socket.emit('error', { message: 'You do not have permission to perform this action' });
        return;
      }

      const { currentTime } = payload;
      const updateData = { isPlaying: false };

      if (currentTime !== undefined) {
        if (typeof currentTime !== 'number' || !Number.isFinite(currentTime) || currentTime < 0) {
          socket.emit('error', { message: 'currentTime must be a non-negative finite number' });
          return;
        }
        updateData.currentTime = currentTime;
      }

      socket.to(socket.roomId).emit('pause', {
        currentTime,
      });

      try {
        await prisma.room.update({
          where: { id: socket.roomId },
          data: updateData,
        });
      } catch (dbError) {
        console.error('Error updating room in database for pause:', dbError);
        try {
          await prisma.room.update({
            where: { id: socket.roomId },
            data: updateData,
          });
        } catch (retryError) {
          console.error('Retry failed updating room in database for pause:', retryError);
        }
      }
    } catch (error) {
      console.error('Error in pause handler:', error);
      socket.emit('error', { message: 'Failed to update pause state' });
    }
  });

  // 3. Seek Event
  socket.on('seek', async (payload = {}) => {
    try {
      if (!['HOST', 'MODERATOR'].includes(socket.role)) {
        socket.emit('error', { message: 'You do not have permission to perform this action' });
        return;
      }

      const { time } = payload;

      if (time === undefined || typeof time !== 'number' || !Number.isFinite(time) || time < 0) {
        socket.emit('error', { message: 'Valid non-negative time is required' });
        return;
      }

      socket.to(socket.roomId).emit('seek', {
        time,
      });

      try {
        await prisma.room.update({
          where: { id: socket.roomId },
          data: { currentTime: time },
        });
      } catch (dbError) {
        console.error('Error updating room in database for seek:', dbError);
        try {
          await prisma.room.update({
            where: { id: socket.roomId },
            data: { currentTime: time },
          });
        } catch (retryError) {
          console.error('Retry failed updating room in database for seek:', retryError);
        }
      }
    } catch (error) {
      console.error('Error in seek handler:', error);
      socket.emit('error', { message: 'Failed to seek video' });
    }
  });

  // 4. Change Video Event
  socket.on('change_video', async (payload = {}) => {
    try {
      if (!['HOST', 'MODERATOR'].includes(socket.role)) {
        socket.emit('error', { message: 'You do not have permission to perform this action' });
        return;
      }

      const { videoId } = payload;

      if (!videoId || typeof videoId !== 'string' || !videoId.trim()) {
        socket.emit('error', { message: 'videoId is required' });
        return;
      }

      const trimmedVideoId = videoId.trim();

      socket.to(socket.roomId).emit('change_video', {
        videoId: trimmedVideoId,
      });

      const updateData = {
        videoId: trimmedVideoId,
        currentTime: 0,
        isPlaying: false,
      };

      try {
        await prisma.room.update({
          where: { id: socket.roomId },
          data: updateData,
        });
      } catch (dbError) {
        console.error('Error updating room in database for change_video:', dbError);
        try {
          await prisma.room.update({
            where: { id: socket.roomId },
            data: updateData,
          });
        } catch (retryError) {
          console.error('Retry failed updating room in database for change_video:', retryError);
        }
      }
    } catch (error) {
      console.error('Error in change_video handler:', error);
      socket.emit('error', { message: 'Failed to change video' });
    }
  });

  // 5. Sync State Event
  socket.on('sync_state', async () => {
    try {
      const auth = await authorizeRoomRole(socket, ['HOST', 'MODERATOR', 'PARTICIPANT']);
      if (!auth.allowed) {
        socket.emit('error', { message: auth.message });
        return;
      }

      const room = await prisma.room.findUnique({
        where: { id: socket.roomId },
      });

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      socket.emit('sync_state', {
        videoId: room.videoId,
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
      });
    } catch (error) {
      console.error('Error in sync_state handler:', error);
      socket.emit('error', { message: 'Failed to sync playback state' });
    }
  });
};

export default registerPlaybackHandlers;
