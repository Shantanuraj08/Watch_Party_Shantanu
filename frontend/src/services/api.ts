import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const createRoom = async (name: string) => {
  const response = await api.post('/rooms', { name });
  return response.data.data;
};

export const joinRoom = async (roomCode: string, name: string, userId?: string | null) => {
  const response = await api.post(`/rooms/${roomCode}/join`, { name, userId });
  return response.data.data;
};

export const getParticipants = async (roomCode: string) => {
  const response = await api.get(`/rooms/${roomCode}/participants`);
  return response.data.data.participants;
};

