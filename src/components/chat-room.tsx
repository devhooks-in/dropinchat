'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import type { Message } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Users, ArrowLeft, ClipboardCopy, MoreVertical, Eraser, Trash2, Pencil } from 'lucide-react';
import NamePromptDialog from './name-prompt-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ChatRoom({ roomId, roomName }: { roomId: string, roomName?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState(roomName || roomId);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
        const scrollViewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
        if (scrollViewport) {
          scrollViewport.scrollTop = scrollViewport.scrollHeight;
        }
    }, 100);
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem('temptalk-username');
    if (storedName) {
      setUsername(storedName);
    } else {
      setIsNameModalOpen(true);
    }
  }, []);

  useEffect(() => {
    // Initialize socket server and connection once
    fetch('/api/socket');

    const socket = io({ transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('user-list-update', (updatedUsers: string[]) => {
      setUsers(updatedUsers);
    });
    
    socket.on('disconnect', () => {
      toast({ title: 'Disconnected', description: 'You have been disconnected from the server.' });
    });

    socket.on('history-cleared', (clearedMessages: Message[]) => {
      setMessages(clearedMessages);
      toast({ title: 'Chat History Cleared', description: 'The room owner has cleared the chat history.' });
    });

    socket.on('room-deleted', () => {
      toast({ title: 'Room Deleted', description: 'The room owner has deleted this room.', variant: 'destructive' });
      router.push('/');
    });

    return () => {
      socket.disconnect();
    };
  }, [router, toast]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket && username) {
      socket.emit('join-room', roomId, roomName, username);

      socket.once('room-state', (data: { messages: Message[], users: string[], creatorId: string | null, roomName: string }) => {
        setMessages(data.messages);
        setUsers(data.users);
        setIsCreator(data.creatorId === socket.id);
        setCurrentRoomName(data.roomName);
      });
    }
  }, [roomId, username, roomName]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNameSubmit = (name: string) => {
    if (username) { // This is a name change
      socketRef.current?.emit('change-name', roomId, name);
    }
    setUsername(name);
    localStorage.setItem('temptalk-username', name);
    setIsNameModalOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && username) {
      socketRef.current?.emit('send-message', {
        roomId,
        message: { user: username, text: input },
      });
      setInput('');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copied!",
      description: "The room link has been copied to your clipboard.",
    });
  };
  
  const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

  const handleClearHistory = () => {
    socketRef.current?.emit('clear-history', roomId);
    setShowClearConfirm(false);
  };

  const handleDeleteRoom = () => {
    socketRef.current?.emit('delete-room', roomId);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <NamePromptDialog isOpen={isNameModalOpen} onNameSubmit={handleNameSubmit} />

      <header className="flex items-center justify-between border-b p-3 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft />
        </Button>
        <div className="text-center">
            <h1 className="text-lg font-bold font-headline">{currentRoomName} <span className="text-sm font-normal text-muted-foreground">({roomId})</span></h1>
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> {users.length} user{users.length !== 1 ? 's' : ''} online
            </div>
        </div>
        <div className="flex items-center space-x-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleCopyLink}>
                        <ClipboardCopy className="h-5 w-5" />
                        <span className="sr-only">Copy Link</span>
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                    <p>Copy Room Link</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setShowClearConfirm(true)}>
                    <Eraser className="mr-2 h-4 w-4" />
                    <span>Clear History</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Room</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col-reverse md:flex-row">
            <Card className="w-full md:w-64 border-0 border-r rounded-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5" /> Online Users</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                    <ul className="space-y-2">
                        {users.map((user, i) => (
                            <li key={`${user}-${i}`} className="flex items-center gap-2 text-sm p-2 rounded-md">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium truncate">{user} {user === username && '(You)'}</span>
                                {user === username && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto flex-shrink-0" onClick={() => setIsNameModalOpen(true)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            <div className="flex-1 flex flex-col h-full">
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${
                          msg.type === 'system'
                            ? 'justify-center'
                            : msg.user === username
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        {msg.type === 'user' && msg.user !== username && (
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(msg.user)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div
                          className={`max-w-xs rounded-lg px-3 py-2 md:max-w-md ${
                            msg.type === 'system'
                              ? 'text-center text-xs text-muted-foreground italic'
                              : msg.user === username
                              ? 'rounded-br-none bg-primary text-primary-foreground'
                              : 'rounded-bl-none bg-secondary text-secondary-foreground'
                          }`}
                        >
                            {msg.type === 'user' && msg.user !== username && <p className="text-xs font-bold">{msg.user}</p>}
                            <p className="text-base whitespace-pre-wrap break-words">{msg.text}</p>
                            <p className={`text-xs opacity-70 ${msg.user === username ? 'text-right' : 'text-left'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        {msg.type === 'user' && msg.user === username && (
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(msg.user)}</AvatarFallback>
                            </Avatar>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="border-t p-4 bg-background">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-card"
                      autoComplete="off"
                    />
                    <Button type="submit" size="icon" disabled={!input.trim()}>
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
            </div>
        </div>
      </main>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear the entire chat history for everyone in this room. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory}>Clear History</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat room and all its messages. All users will be disconnected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRoom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Room</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
