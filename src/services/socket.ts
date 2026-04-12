import { io } from 'socket.io-client';
import { API_BASE } from '../config';

const socket = io(API_BASE.replace('/api', ''), {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

export default socket;
