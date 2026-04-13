import { io, Socket } from 'socket.io-client';
import { getBackendURL } from '../config';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const url = getBackendURL();
    socket = io(url, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const reconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  return getSocket();
};

export default getSocket();
