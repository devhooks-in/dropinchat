
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import type { Message, User } from '@/lib/types';
import { rooms } from '@/lib/room-store';
import type { Room } from '@/lib/room-store';

interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

// Map to store timeouts for disconnected users. Key is the old socket.id.
const disconnectionTimeouts = new Map<string, NodeJS.Timeout>();

export default function socketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const io = new IOServer(res.socket.server, {
    maxHttpBufferSize: 2.5e7, // 25MB
  });
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

    socket.on('join-room', (data: { roomId: string, username: string }, callback?: (response: { success: boolean; error?: string; roomState?: any }) => void) => {
      const { roomId, username } = data;
      
      if (!username) {
        if (callback) callback({ success: false, error: 'Username is required.' });
        return;
      }
      
      let room = rooms.get(roomId);

      // Room doesn't exist, let's see if we can create it
      if (!room) {
        const creationInfoJSON = socket.handshake.auth.roomCreationInfo;
        if (creationInfoJSON) {
           try {
            const creationInfo = JSON.parse(creationInfoJSON);
            // We can only create a room if the creation info matches the room ID we're trying to join.
            if (creationInfo.roomId === roomId) {
              rooms.set(roomId, { 
                name: creationInfo.roomName, 
                users: new Map(), 
                messages: [], 
                creatorId: socket.id, 
              });
              room = rooms.get(roomId)!;
            }
           } catch (e) { 
             console.error("Failed to parse room creation info on server", e);
             // If parsing fails, we can't create the room.
             if (callback) callback({ success: false, error: 'Invalid room creation data.' });
             return;
           }
        }
      }
      
      // If after all that, the room still doesn't exist, then it's a failure.
      if (!room) {
        if (callback) callback({ success: false, error: 'Room not found' });
        return;
      }

      currentRoomId = roomId;
      socket.join(roomId);
      
      let isReconnecting = false;
      for (const [oldSocketId, timeoutId] of disconnectionTimeouts.entries()) {
          if (room.users.get(oldSocketId) === username) {
              clearTimeout(timeoutId);
              disconnectionTimeouts.delete(oldSocketId);
              room.users.delete(oldSocketId);
              isReconnecting = true;
              break;
          }
      }
      
      if (!isReconnecting) {
        sendSystemMessage(roomId, `${username} has joined the room.`);
      }
      
      room.users.set(socket.id, username);

      if (callback) {
          callback({
              success: true,
              roomState: {
                  messages: room.messages,
                  users: getRoomUsers(roomId),
                  creatorId: room.creatorId,
                  roomName: room.name,
              }
          });
      }

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
      if (!currentRoomId) {
        return;
      }
      const room = rooms.get(currentRoomId);
      if (!room) return;
      
      if (room.users.has(socket.id)) {
        const username = room.users.get(socket.id)!;
        const wasCreator = room.creatorId === socket.id;

        const timeoutId = setTimeout(() => {
          const currentRoom = rooms.get(currentRoomId!);
          if (currentRoom && currentRoom.users.has(socket.id)) {
            currentRoom.users.delete(socket.id);

            if (currentRoom.users.size === 0) {
              rooms.delete(currentRoomId!);
              return;
            }
            
            let messageSent = false;
            if (wasCreator) {
              const newCreatorId = currentRoom.users.keys().next().value;
              currentRoom.creatorId = newCreatorId;
              const newCreatorUsername = currentRoom.users.get(newCreatorId);
              sendSystemMessage(currentRoomId!, `${username} (the room owner) has left. ${newCreatorUsername} is now the new room owner.`);
              io.to(currentRoomId!).emit('creator-update', currentRoom.creatorId);
              messageSent = true;
            }
            
            if (!messageSent) {
                sendSystemMessage(currentRoomId!, `${username} has left the room.`);
            }
            
            io.to(currentRoomId!).emit('user-list-update', getRoomUsers(currentRoomId!));
          }
          disconnectionTimeouts.delete(socket.id);
        }, 30000); // 30-second grace period

        disconnectionTimeouts.set(socket.id, timeoutId);
      }
    });
  });

  res.end();
}
