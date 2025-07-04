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

interface Room {
  name: string;
  users: Map<string, string>; // socket.id -> username
  messages: Message[];
  creatorId: string | null;
}

const rooms = new Map<string, Room>();

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
  
  const sendSystemMessage = (roomId: string, text: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const systemMessage: Message = {
      id: `${Date.now()}-system`,
      user: 'System',
      text,
      timestamp: Date.now(),
      type: 'system',
    };
    room.messages.push(systemMessage);
    io.to(roomId).emit('new-message', systemMessage);
  };


  io.on('connection', socket => {
    let currentRoomId: string | null = null;

    socket.on('join-room', (roomId: string, roomName: string | null, username: string) => {
      if (!username) {
        return;
      }
      
      currentRoomId = roomId;
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { name: roomName || roomId, users: new Map(), messages: [], creatorId: socket.id });
      }
      const room = rooms.get(roomId)!;
      
      // Only send "joined" message if they are truly new
      if (!room.users.has(socket.id)) {
        sendSystemMessage(roomId, `${username} has joined the room.`);
      }
      
      room.users.set(socket.id, username);

      socket.emit('room-state', {
        messages: room.messages,
        users: getRoomUsers(roomId),
        creatorId: room.creatorId,
        roomName: room.name,
      });

      io.to(roomId).emit('user-list-update', getRoomUsers(roomId));
    });

    socket.on('update-room-name', (roomId: string, newRoomName: string) => {
      const room = rooms.get(roomId);
      if (room && room.creatorId === socket.id) {
        const username = room.users.get(socket.id) || 'The room owner';
        room.name = newRoomName;
        sendSystemMessage(roomId, `${username} changed the room name to "${newRoomName}".`);
        io.to(roomId).emit('room-name-updated', newRoomName);
      }
    });

    socket.on('change-name', (roomId: string, newUsername: string) => {
        const room = rooms.get(roomId);
        if (room && room.users.has(socket.id)) {
            const oldUsername = room.users.get(socket.id);
            room.users.set(socket.id, newUsername);
            sendSystemMessage(roomId, `${oldUsername} is now known as ${newUsername}.`);
            io.to(roomId).emit('user-list-update', getRoomUsers(roomId));
        }
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

    socket.on('clear-history', (roomId: string) => {
      const room = rooms.get(roomId);
      if (room && room.creatorId === socket.id) {
        const username = room.users.get(socket.id) || 'The room owner';
        const systemMessage: Message = {
          id: `${Date.now()}-system`,
          user: 'System',
          text: `${username} has cleared the chat history.`,
          timestamp: Date.now(),
          type: 'system',
        };
        room.messages = [systemMessage];
        io.to(roomId).emit('history-cleared', room.messages);
      }
    });

    socket.on('delete-room', (roomId: string) => {
      const room = rooms.get(roomId);
      if (room && room.creatorId === socket.id) {
        io.to(roomId).emit('room-deleted');
        io.in(roomId).disconnectSockets(true);
        rooms.delete(roomId);
      }
    });

    socket.on('disconnect', () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const username = room.users.get(socket.id);
          const wasCreator = room.creatorId === socket.id;
          room.users.delete(socket.id);

          if (room.users.size === 0) {
            rooms.delete(currentRoomId);
            return;
          }
          
          if (wasCreator) {
            const newCreatorId = room.users.keys().next().value;
            room.creatorId = newCreatorId;
            const newCreatorUsername = room.users.get(newCreatorId);
            sendSystemMessage(currentRoomId, `${username} (the room owner) has left. ${newCreatorUsername} is now the new room owner.`);
            io.to(currentRoomId).emit('creator-update', room.creatorId);
          } else if (username) {
             sendSystemMessage(currentRoomId, `${username} has left the room.`);
          }
          
          io.to(currentRoomId).emit('user-list-update', getRoomUsers(currentRoomId));
        }
      }
    });
  });

  res.end();
}
