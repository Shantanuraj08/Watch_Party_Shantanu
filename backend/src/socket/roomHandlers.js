import prisma from '../db/prisma.js';
import { authorizeRoomRole } from './socketAuth.js';

// In-memory chat store: roomId -> [{ userId, userName, message, timestamp }]
const roomChats = new Map();

export const registerRoomHandlers = (socket, io) => {
  // Join Room Event
  socket.on('join_room', async (payload = {}) => {
    try {
      const { roomId, userId } = payload;

      if (!roomId || !userId) {
        socket.emit('error', { message: 'roomId and userId are required' });
        return;
      }

      const participant = await prisma.roomParticipant.findFirst({
        where: { roomId, userId },
        include: { user: true, room: true },
      });

      if (!participant) {
        socket.emit('error', { message: 'Participant not found in room' });
        return;
      }

      if (participant.isRemoved) {
        socket.emit('error', { message: 'You have been removed from this room' });
        return;
      }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.userName = participant.user.name;
      socket.role = participant.role;

      await prisma.roomParticipant.update({
        where: { id: participant.id },
        data: { isActive: true },
      });

      let currentTime = participant.room.currentTime || 0;
      if (participant.room.isPlaying && participant.room.updatedAt) {
        const elapsed = (Date.now() - new Date(participant.room.updatedAt).getTime()) / 1000;
        currentTime = Math.max(0, currentTime + elapsed);
      }

      socket.emit('room_state', {
        videoId: participant.room.videoId,
        currentTime,
        isPlaying: participant.room.isPlaying,
      });

      socket.to(roomId).emit('user_joined', {
        userId: participant.userId,
        name: participant.user.name,
        role: participant.role,
      });
    } catch (error) {
      console.error('Error in join_room handler:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave Room Event
  socket.on('leave_room', async () => {
    try {
      const roomId = socket.roomId;
      const userId = socket.userId;

      if (!roomId || !userId) {
        socket.emit('error', { message: 'Not currently in a room' });
        return;
      }

      await prisma.roomParticipant.updateMany({
        where: { roomId, userId },
        data: { isActive: false },
      });

      socket.leave(roomId);

      socket.to(roomId).emit('user_left', {
        userId,
      });

      const remainingSockets = await io.in(roomId).fetchSockets();
      if (remainingSockets.length === 0) {
        roomChats.delete(roomId);
      }

      socket.roomId = null;
      socket.userId = null;
      socket.userName = null;
      socket.role = null;
    } catch (error) {
      console.error('Error in leave_room handler:', error);
      socket.emit('error', { message: 'Failed to leave room' });
    }
  });

  // Assign Role Event (HOST only)
  socket.on('assign_role', async (payload = {}) => {
    try {
      const auth = await authorizeRoomRole(socket, ['HOST']);
      if (!auth.allowed) {
        socket.emit('error', { message: auth.message });
        return;
      }

      const { targetUserId, role } = payload;

      if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
        socket.emit('error', { message: 'targetUserId is required' });
        return;
      }

      if (role !== 'MODERATOR') {
        socket.emit('error', { message: 'Only MODERATOR role can be assigned' });
        return;
      }

      if (targetUserId.trim() === socket.userId) {
        socket.emit('error', { message: 'Cannot assign a role to yourself' });
        return;
      }

      const targetParticipant = await prisma.roomParticipant.findFirst({
        where: {
          roomId: socket.roomId,
          userId: targetUserId.trim(),
        },
      });

      if (!targetParticipant) {
        socket.emit('error', { message: 'Target participant not found in room' });
        return;
      }

      if (targetParticipant.isRemoved) {
        socket.emit('error', { message: 'Cannot assign role to a removed participant' });
        return;
      }

      await prisma.roomParticipant.update({
        where: { id: targetParticipant.id },
        data: { role: 'MODERATOR' },
      });

      const socketsInRoom = await io.in(socket.roomId).fetchSockets();
      for (const s of socketsInRoom) {
        if (s.userId === targetParticipant.userId) {
          s.role = 'MODERATOR';
          const localSocket = io.sockets?.sockets?.get(s.id);
          if (localSocket) {
            localSocket.role = 'MODERATOR';
          }
        }
      }

      io.to(socket.roomId).emit('role_assigned', {
        userId: targetParticipant.userId,
        role: 'MODERATOR',
      });
    } catch (error) {
      console.error('Error in assign_role handler:', error);
      socket.emit('error', { message: 'Failed to assign role' });
    }
  });

  // Transfer Host Event (HOST only)
  socket.on('transfer_host', async (payload = {}) => {
    try {
      if (!socket.roomId || socket.role !== 'HOST') {
        socket.emit('error', { message: 'You do not have permission to perform this action' });
        return;
      }

      const { targetUserId } = payload;
      if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
        socket.emit('error', { message: 'targetUserId is required' });
        return;
      }

      const trimmedTargetId = targetUserId.trim();
      if (trimmedTargetId === socket.userId) {
        socket.emit('error', { message: 'Cannot transfer host role to yourself' });
        return;
      }

      const targetParticipant = await prisma.roomParticipant.findFirst({
        where: { roomId: socket.roomId, userId: trimmedTargetId },
      });

      if (!targetParticipant) {
        socket.emit('error', { message: 'Target participant not found in room' });
        return;
      }

      if (targetParticipant.isRemoved) {
        socket.emit('error', { message: 'Cannot transfer host role to a removed participant' });
        return;
      }

      if (!targetParticipant.isActive) {
        socket.emit('error', { message: 'Target participant is not active' });
        return;
      }

      await prisma.$transaction([
        prisma.roomParticipant.updateMany({
          where: { roomId: socket.roomId, userId: socket.userId },
          data: { role: 'PARTICIPANT' },
        }),
        prisma.roomParticipant.update({
          where: { id: targetParticipant.id },
          data: { role: 'HOST' },
        }),
      ]);

      socket.role = 'PARTICIPANT';
      const socketsInRoom = await io.in(socket.roomId).fetchSockets();
      for (const s of socketsInRoom) {
        if (s.userId === socket.userId) {
          s.role = 'PARTICIPANT';
          const local = io.sockets?.sockets?.get(s.id);
          if (local) local.role = 'PARTICIPANT';
        } else if (s.userId === trimmedTargetId) {
          s.role = 'HOST';
          const local = io.sockets?.sockets?.get(s.id);
          if (local) local.role = 'HOST';
        }
      }

      io.to(socket.roomId).emit('host_transferred', {
        previousHostId: socket.userId,
        newHostId: trimmedTargetId,
      });
    } catch (error) {
      console.error('Error in transfer_host handler:', error);
      socket.emit('error', { message: 'Failed to transfer host role' });
    }
  });

  // Remove Participant Event (HOST only)
  socket.on('remove_participant', async (payload = {}) => {
    try {
      const auth = await authorizeRoomRole(socket, ['HOST']);
      if (!auth.allowed) {
        socket.emit('error', { message: auth.message });
        return;
      }

      const { targetUserId } = payload;

      if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
        socket.emit('error', { message: 'targetUserId is required' });
        return;
      }

      if (targetUserId.trim() === socket.userId) {
        socket.emit('error', { message: 'Cannot remove yourself from the room' });
        return;
      }

      const targetParticipant = await prisma.roomParticipant.findFirst({
        where: {
          roomId: socket.roomId,
          userId: targetUserId.trim(),
        },
      });

      if (!targetParticipant) {
        socket.emit('error', { message: 'Target participant not found in room' });
        return;
      }

      if (targetParticipant.isRemoved) {
        socket.emit('error', { message: 'Participant is already removed' });
        return;
      }

      await prisma.roomParticipant.update({
        where: { id: targetParticipant.id },
        data: {
          isRemoved: true,
          isActive: false,
        },
      });

      io.to(socket.roomId).emit('participant_removed', {
        userId: targetParticipant.userId,
      });

      const socketsInRoom = await io.in(socket.roomId).fetchSockets();
      for (const s of socketsInRoom) {
        if (s.userId === targetParticipant.userId) {
          s.leave(socket.roomId);
          s.roomId = null;
          s.userId = null;
          s.userName = null;
          s.role = null;
        }
      }

      const remainingSockets = await io.in(socket.roomId).fetchSockets();
      if (remainingSockets.length === 0) {
        roomChats.delete(socket.roomId);
      }
    } catch (error) {
      console.error('Error in remove_participant handler:', error);
      socket.emit('error', { message: 'Failed to remove participant' });
    }
  });

  // Disconnect cleanup handler
  socket.on('disconnect', async () => {
    if (socket.roomId && socket.userId) {
      try {
        const participant = await prisma.roomParticipant.findFirst({
          where: {
            roomId: socket.roomId,
            userId: socket.userId,
          },
          include: { room: true },
        });

        io.to(socket.roomId).emit('user_left', {
          userId: socket.userId,
        });

        const updates = [
          prisma.roomParticipant.updateMany({
            where: {
              roomId: socket.roomId,
              userId: socket.userId,
            },
            data: { isActive: false },
          }),
        ];

        if (participant?.role === 'HOST' && participant.room?.videoId) {
          let pauseTime = participant.room.currentTime || 0;
          if (participant.room.isPlaying && participant.room.updatedAt) {
            const elapsed = (Date.now() - new Date(participant.room.updatedAt).getTime()) / 1000;
            pauseTime = Math.max(0, pauseTime + elapsed);
          }

          io.to(socket.roomId).emit('pause', {
            currentTime: pauseTime,
          });

          updates.push(
            prisma.room.update({
              where: { id: socket.roomId },
              data: {
                isPlaying: false,
                currentTime: pauseTime,
              },
            })
          );
        }

        await Promise.all(updates);

        if (socket.roomId) {
          const remainingSockets = await io.in(socket.roomId).fetchSockets();
          if (remainingSockets.length === 0) {
            roomChats.delete(socket.roomId);
          }
        }
      } catch (error) {
        console.error('Error in disconnect handler:', error);
      }
    }
  });

  // Send Chat Message Event
  socket.on('send_message', (payload = {}) => {
    try {
      if (!socket.roomId || !socket.userId) {
        socket.emit('error', { message: 'Not connected to a room' });
        return;
      }

      const { message } = payload;
      if (typeof message !== 'string') {
        socket.emit('error', { message: 'Message must be a string' });
        return;
      }

      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return;
      }

      if (trimmedMessage.length > 500) {
        socket.emit('error', { message: 'Message exceeds 500 characters' });
        return;
      }

      const chatMessage = {
        userId: socket.userId,
        userName: socket.userName || 'User',
        message: trimmedMessage,
        timestamp: Date.now(),
      };

      let chats = roomChats.get(socket.roomId);
      if (!chats) {
        chats = [];
        roomChats.set(socket.roomId, chats);
      }
      chats.push(chatMessage);
      if (chats.length > 100) {
        chats.shift();
      }

      io.to(socket.roomId).emit('new_message', chatMessage);
    } catch (error) {
      console.error('Error in send_message handler:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
};

export default registerRoomHandlers;
