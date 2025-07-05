import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import type { Message, User } from '@/lib/types';

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
// Map to store timeouts for disconnected users. Key is the old socket.id.
const disconnectionTimeouts = new Map<string, NodeJS.Timeout>();

export default function socketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const io = new IOServer(res.socket.server);
  res.socket.server.io = io;

  const getRoomUsers = (roomId: string): User[] => {
    const room = rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.users.entries()).map(([id, name]) => ({ id, name }));
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
      
      let isReconnecting = false;
      // --- Reconnection Logic ---
      // Look for a disconnected user with the same name in the same room.
      for (const [oldSocketId, timeoutId] of disconnectionTimeouts.entries()) {
          // Check if the disconnected user belongs to this room and has the same name
          if (room.users.get(oldSocketId) === username) {
              clearTimeout(timeoutId);
              disconnectionTimeouts.delete(oldSocketId);
              // The old entry is stale and represents the disconnected state. Remove it.
              room.users.delete(oldSocketId);
              isReconnecting = true;
              // Assuming one user per name for reconnection logic.
              break;
          }
      }
      // --- End Reconnection Logic ---
      
      if (!isReconnecting) {
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
        if (room && room.users.has(socket.id)) {
          const username = room.users.get(socket.id)!;
          const wasCreator = room.creatorId === socket.id;

          // Set a timeout to remove the user after a grace period.
          const timeoutId = setTimeout(() => {
            const currentRoom = rooms.get(currentRoomId!);
            // Only remove if they haven't reconnected (i.e., the old socket ID is still in users).
            if (currentRoom && currentRoom.users.has(socket.id)) {
              currentRoom.users.delete(socket.id);

              if (currentRoom.users.size === 0) {
                rooms.delete(currentRoomId!);
                return; // Room is empty, no need to send updates
              }
              
              if (wasCreator) {
                const newCreatorId = currentRoom.users.keys().next().value;
                currentRoom.creatorId = newCreatorId;
                const newCreatorUsername = currentRoom.users.get(newCreatorId);
                sendSystemMessage(currentRoomId!, `${username} (the room owner) has left. ${newCreatorUsername} is now the new room owner.`);
                io.to(currentRoomId!).emit('creator-update', currentRoom.creatorId);
              } else {
                 sendSystemMessage(currentRoomId!, `${username} has left the room.`);
              }
              
              io.to(currentRoomId!).emit('user-list-update', getRoomUsers(currentRoomId!));
            }
            disconnectionTimeouts.delete(socket.id);
          }, 60000); // 1-minute grace period

          disconnectionTimeouts.set(socket.id, timeoutId);
        }
      }
    });
  });

  res.end();
}
