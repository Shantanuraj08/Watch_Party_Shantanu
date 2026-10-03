import prisma from '../db/prisma.js';

/**
 * Authorizes a connected socket's role for a room action based on the database record.
 * @param {import('socket.io').Socket} socket - Socket instance with roomId and userId
 * @param {string[]} allowedRoles - Array of allowed roles (e.g. ['HOST'], ['HOST', 'MODERATOR'])
 * @returns {Promise<{ allowed: boolean, message?: string, participant?: object }>}
 */
export const authorizeRoomRole = async (socket, allowedRoles = []) => {
  const roomId = socket.roomId;
  const userId = socket.userId;

  // 1. Check socket has roomId and userId
  if (!roomId || !userId) {
    return {
      allowed: false,
      message: 'You are not connected to a room',
    };
  }

  // 2. Find RoomParticipant
  const participant = await prisma.roomParticipant.findFirst({
    where: {
      roomId,
      userId,
    },
  });

  if (!participant) {
    return {
      allowed: false,
      message: 'Participant not found in room',
    };
  }

  // 3. Check isRemoved
  if (participant.isRemoved) {
    return {
      allowed: false,
      message: 'You have been removed from this room',
    };
  }

  // 4. Check isActive
  if (!participant.isActive) {
    return {
      allowed: false,
      message: 'Participant is not active in this room',
    };
  }

  // 5. Check whether the database role is included in allowedRoles
  if (!allowedRoles.includes(participant.role)) {
    return {
      allowed: false,
      message: 'You do not have permission to perform this action',
    };
  }

  // 6. Return allowed: true with the participant
  return {
    allowed: true,
    participant,
  };
};

export default authorizeRoomRole;
