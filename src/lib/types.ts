export interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: number;
  type: 'user' | 'system';
  attachment?: {
    name: string;
    type: string;
    data: string; // Base64 data URI
  };
}

export interface User {
  id: string;
  name: string;
}
