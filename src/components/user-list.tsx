'use client';

import type { User } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

interface UserListProps {
  users: User[];
  username: string | null;
  creatorId: string | null;
  onUserTag: (username: string) => void;
  onOpenChangeName: () => void;
}

const getInitials = (name: string) => (name ? name.charAt(0).toUpperCase() : '?');

export default function UserList({ users, username, creatorId, onUserTag, onOpenChangeName }: UserListProps) {
  return (
    <ul className="space-y-1">
      {users.map((user) => (
        <li
          key={user.id}
          className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-accent group"
          onClick={() => {
            if (user.name !== username) {
              onUserTag(user.name);
            }
          }}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 cursor-pointer">
            <span className="font-medium truncate">{user.name}</span>
            {user.name === username && <span className="text-muted-foreground ml-1">(You)</span>}
            {user.id === creatorId && <span className="text-xs text-primary font-semibold ml-1">(Admin)</span>}
          </div>
          {user.name === username && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChangeName();
              }}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Change your name</span>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
