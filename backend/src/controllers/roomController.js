import prisma from '../db/prisma.js';
import generateRoomCode from '../utils/generateRoomCode.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';


export const createRoom = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Name is required');
  }

  let result;
  while (!result) {
    const roomCode = generateRoomCode();
    try {
      result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: name.trim(),
          },
        });

        const room = await tx.room.create({
          data: {
            code: roomCode,
            videoId: null,
            currentTime: 0,
            isPlaying: false,
          },
        });

        const participant = await tx.roomParticipant.create({
          data: {
            userId: user.id,
            roomId: room.id,
            role: 'HOST',
            isActive: true,
            isRemoved: false,
          },
        });

        return { user, room, participant };
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  const responseData = {
    room: result.room,
    code: result.room.code,
    user: result.user,
    role: 'HOST',
    participant: result.participant,
  };

  return res
    .status(201)
    .json(new ApiResponse(201, responseData, 'Room created successfully'));
});


export const joinRoom = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { name, userId } = req.body;

  if (!code || typeof code !== 'string' || !code.trim()) {
    throw new ApiError(400, 'Room code is required');
  }

  const normalizedCode = code.trim().toUpperCase();

  // 1. Room does not exist -> return 404
  const room = await prisma.room.findUnique({
    where: { code: normalizedCode },
  });

  if (!room) {
    throw new ApiError(404, 'Room not found');
  }

  // 2. If userId is provided, find existing RoomParticipant by roomId and userId only
  let existingParticipant = null;

  if (userId && typeof userId === 'string' && userId.trim()) {
    existingParticipant = await prisma.roomParticipant.findUnique({
      where: {
        userId_roomId: {
          userId: userId.trim(),
          roomId: room.id,
        },
      },
      include: {
        user: true,
      },
    });
  }

  // 3. If an existing RoomParticipant is found:
  if (existingParticipant) {
    if (existingParticipant.isRemoved) {
      throw new ApiError(403, 'You have been removed from this room');
    }

    const updatedParticipant = await prisma.roomParticipant.update({
      where: { id: existingParticipant.id },
      data: { isActive: true },
    });

    const responseData = {
      room,
      code: room.code,
      user: existingParticipant.user,
      role: existingParticipant.role,
      playbackState: {
        videoId: room.videoId,
        currentTime: room.isPlaying && room.updatedAt
          ? Math.max(0, (room.currentTime || 0) + (Date.now() - new Date(room.updatedAt).getTime()) / 1000)
          : room.currentTime || 0,
        isPlaying: room.isPlaying,
      },
      participant: updatedParticipant,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, responseData, 'Joined room successfully'));
  }

  // 4. If no existing RoomParticipant is found, create new User and RoomParticipant
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Name is required');
  }

  const trimmedName = name.trim();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: trimmedName,
      },
    });

    const participant = await tx.roomParticipant.create({
      data: {
        userId: user.id,
        roomId: room.id,
        role: 'PARTICIPANT',
        isActive: true,
        isRemoved: false,
      },
    });

    return { user, participant };
  });

  const responseData = {
    room,
    code: room.code,
    user: result.user,
    role: 'PARTICIPANT',
    playbackState: {
      videoId: room.videoId,
      currentTime: room.isPlaying && room.updatedAt
        ? Math.max(0, (room.currentTime || 0) + (Date.now() - new Date(room.updatedAt).getTime()) / 1000)
        : room.currentTime || 0,
      isPlaying: room.isPlaying,
    },
    participant: result.participant,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, responseData, 'Joined room successfully'));
});
