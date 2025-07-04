import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import type { Message } from '@/lib/types';

interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const rooms = new Map<string, { users: Map<string, string>; messages: Message[] }>();

export default function socketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const io = new IOServer(res.socket.server);
  res.socket.server.io = io;

  const getRoomUsers = (roomId: string) => {
    const room = rooms.get(roomId);
    return room ? Array.from(room.users.values()) : [];
  };

  io.on('connection', socket => {
    let currentRoomId: string | null = null;

    socket.on('join-room', (roomId: string, username: string) => {
      currentRoomId = roomId;
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Map(), messages: [] });
      }
      const room = rooms.get(roomId)!;
      room.users.set(socket.id, username);

      const systemMessage: Message = {
        id: `${Date.now()}-system`,
        user: 'System',
        text: `${username} has joined the room.`,
        timestamp: Date.now(),
        type: 'system',
      };
      room.messages.push(systemMessage);

      socket.emit('room-state', room.messages, getRoomUsers(roomId));
      socket.to(roomId).emit('new-message', systemMessage);
      io.to(roomId).emit('user-list-update', getRoomUsers(roomId));
    });

    socket.on('send-message', (messageData: { roomId: string; message: Omit<Message, 'id' | 'timestamp' | 'type'> }) => {
      const { roomId, message } = messageData;
      const room = rooms.get(roomId);
      if (room) {
        const fullMessage: Message = {
          ...message,
          id: `${Date.now()}-${message.user}`,
          timestamp: Date.now(),
          type: 'user',
        };
        room.messages.push(fullMessage);
        io.to(roomId).emit('new-message', fullMessage);
      }
    });

    socket.on('disconnect', () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const username = room.users.get(socket.id);
          room.users.delete(socket.id);

          if (username) {
             const systemMessage: Message = {
                id: `${Date.now()}-system`,
                user: 'System',
                text: `${username} has left the room.`,
                timestamp: Date.now(),
                type: 'system',
             };
             room.messages.push(systemMessage);
             io.to(currentRoomId).emit('new-message', systemMessage);
          }
          
          const usersInRoom = getRoomUsers(currentRoomId);
          io.to(currentRoomId).emit('user-list-update', usersInRoom);

          if (room.users.size === 0) {
            rooms.delete(currentRoomId);
          }
        }
      }
    });
  });

  res.end();
}
