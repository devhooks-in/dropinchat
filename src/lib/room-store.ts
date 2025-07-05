
import type { Message } from '@/lib/types';

export interface Room {
  name: string;
  users: Map<string, string>; // socket.id -> username
  messages: Message[];
  creatorId: string | null;
  speakerId: string | null;
}

// In-memory store for chat rooms.
// WARNING: This will not work in a serverless environment with multiple instances.
// It's suitable for a single-server deployment or development.
export const rooms = new Map<string, Room>();
