import prisma from '../db/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';

export const getParticipants = asyncHandler(async (req, res) => {
  const { code } = req.params;

  if (!code || typeof code !== 'string' || !code.trim()) {
    throw new ApiError(400, 'Room code is required');
  }

  const normalizedCode = code.trim().toUpperCase();

  // Find the room
  const room = await prisma.room.findUnique({
    where: { code: normalizedCode },
  });

  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  // Fetch participants (excluding removed ones) with their user details
  const participants = await prisma.roomParticipant.findMany({
    where: {
      roomId: room.id,
      isRemoved: false,
    },
    include: {
      user: true,
    },
    orderBy: {
      joinedAt: 'asc',
    },
  });

  // Format response to only expose necessary fields
  const formattedParticipants = participants.map((participant) => ({
    userId: participant.userId,
    name: participant.user.name,
    role: participant.role,
    isActive: participant.isActive,
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      { participants: formattedParticipants },
      'Participants retrieved successfully'
    )
  );
});
