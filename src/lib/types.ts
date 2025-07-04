export interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: number;
  type: 'user' | 'system';
}

export interface User {
  id: string;
  name: string;
}
