
import type { NextApiRequest, NextApiResponse } from 'next';
import { rooms } from '@/lib/room-store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { roomId } = req.query;

  if (typeof roomId !== 'string' || !roomId) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  const roomExists = rooms.has(roomId);

  return res.status(200).json({ exists: roomExists });
}
