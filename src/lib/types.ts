export interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: number;
  type: 'user' | 'system';
}
