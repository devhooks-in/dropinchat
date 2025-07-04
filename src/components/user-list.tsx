'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

interface UserListProps {
  users: string[];
  username: string | null;
  onOpenChangeName: () => void;
}

const getInitials = (name: string) => (name ? name.charAt(0).toUpperCase() : '?');

export default function UserList({ users, username, onOpenChangeName }: UserListProps) {
  return (
    <ul className="space-y-2">
      {users.map((user, i) => (
        <li key={`${user}-${i}`} className="flex items-center gap-2 text-sm p-2 rounded-md">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{getInitials(user)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <span className="font-medium">{user}</span>
            {user === username && <span className="text-muted-foreground"> (You)</span>}
          </div>
          {user === username && (
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto flex-shrink-0" onClick={onOpenChangeName}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Change your name</span>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
