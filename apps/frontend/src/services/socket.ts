import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const socket: Socket = io(API_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling']
});
