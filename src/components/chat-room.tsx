'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import type { Message, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Users, ArrowLeft, MoreVertical, Eraser, Trash2, Pencil, KeyRound, Link, Smile, Paperclip, X, FileText, Download } from 'lucide-react';
import NamePromptDialog from './name-prompt-dialog';
import UserList from './user-list';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ChatRoom({ roomId, roomName }: { roomId: string, roomName?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState(roomName || roomId);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [nameModalConfig, setNameModalConfig] = useState({ title: '', description: '' });
  const [isInitialNamePrompt, setIsInitialNamePrompt] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; type: string; data: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isRenameRoomModalOpen, setIsRenameRoomModalOpen] = useState(false);
  const [isUsersSheetOpen, setIsUsersSheetOpen] = useState(false);
  const [newRoomNameInput, setNewRoomNameInput] = useState('');
  const hasJoined = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(() => {
    // Resume context if it's suspended (autoplay policy)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5 note
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch(e) {
      console.error("Could not play notification sound", e);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
        const scrollViewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
        if (scrollViewport) {
          scrollViewport.scrollTop = scrollViewport.scrollHeight;
        }
    }, 100);
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem('dropinchat-username');
    if (storedName) {
      setUsername(storedName);
    } else {
      setNameModalConfig({
        title: 'Welcome to DropInChat',
        description: 'Please enter your name to join the chat.',
      });
      setIsInitialNamePrompt(true);
      setIsNameModalOpen(true);
    }
    // Browsers require a user gesture to start audio. We'll create the context here,
    // and it will be resumed when the notification sound is first played.
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }
  }, []);

  // Effect for setting up socket connection and listeners that don't depend on state
  useEffect(() => {
    fetch('/api/socket');

    const socket = io({ transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('user-list-update', (updatedUsers: User[]) => {
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

    socket.on('creator-update', (newCreatorId: string) => {
      const amICreator = newCreatorId === socket.id;
      setIsCreator(amICreator);
      setCreatorId(newCreatorId);
      if (amICreator) {
        toast({
          title: 'You are the new room owner!',
          description: 'The previous owner left the room.',
        });
      }
    });

    socket.on('room-name-updated', (newName: string) => {
        setCurrentRoomName(newName);
        toast({ title: 'Room Renamed', description: `The room is now called "${newName}".` });
    });

    return () => {
      socket.disconnect();
    };
  }, [router, toast]);
  
  // Effect for handling new messages, which depends on the current username
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    const handleNewMessage = (message: Message) => {
        setMessages(prev => [...prev, message]);
        // Play sound if the tab is not visible and the message is from another user
        if (document.hidden && message.user !== username && message.type === 'user') {
            playNotificationSound();
        }
    };

    socket.on('new-message', handleNewMessage);

    return () => {
        socket.off('new-message', handleNewMessage);
    };
  }, [username, playNotificationSound]);

  // Effect for joining the room once the username is available
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && username && !hasJoined.current) {
      hasJoined.current = true;
      socket.emit('join-room', roomId, roomName, username);

      socket.once('room-state', (data: { messages: Message[], users: User[], creatorId: string | null, roomName: string }) => {
        setMessages(data.messages);
        setUsers(data.users);
        setCreatorId(data.creatorId);
        setIsCreator(data.creatorId === socket.id);
        setCurrentRoomName(data.roomName);
        scrollToBottom();
      });
    }
  }, [roomId, username, roomName, scrollToBottom]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNameSubmit = (name: string) => {
    if (username) {
      socketRef.current?.emit('change-name', roomId, name);
    }
    setUsername(name);
    localStorage.setItem('dropinchat-username', name);
    setIsNameModalOpen(false);
    if (isInitialNamePrompt) {
      setIsInitialNamePrompt(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachment) && username) {
      socketRef.current?.emit('send-message', {
        roomId,
        message: { user: username, text: input, attachment },
      });
      setInput('');
      setAttachment(null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copied!",
      description: "The room link has been copied to your clipboard.",
    });
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(roomId);
    toast({
      title: "Room ID Copied!",
      description: "The room ID has been copied to your clipboard.",
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

  const handleRenameRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomNameInput.trim() && isCreator) {
        socketRef.current?.emit('update-room-name', roomId, newRoomNameInput.trim());
        setIsRenameRoomModalOpen(false);
        setNewRoomNameInput('');
    }
  };

  const openChangeNameModal = () => {
    setNameModalConfig({
        title: 'Change Your Name',
        description: 'Enter a new name that will be visible to everyone.',
    });
    setIsNameModalOpen(true);
  };

  const handleUserTag = (usernameToTag: string) => {
    setInput(prevInput => `${prevInput}@${usernameToTag} `);
    const inputElement = document.querySelector<HTMLInputElement>('form input[type="text"]');
    inputElement?.focus();
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 5MB.',
          variant: 'destructive'
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setAttachment({
          name: file.name,
          type: file.type,
          data: loadEvent.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <NamePromptDialog 
        isOpen={isNameModalOpen} 
        onOpenChange={(open) => {
            if (!isInitialNamePrompt) {
                setIsNameModalOpen(open);
            }
        }}
        onNameSubmit={handleNameSubmit}
        title={nameModalConfig.title}
        description={nameModalConfig.description}
        initialValue={username || ''}
        isInitialPrompt={isInitialNamePrompt}
      />

      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-card hover:text-foreground dark:hover:bg-secondary" onClick={() => router.push('/')}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Home</span>
            </Button>
            <div>
                <h1 className="truncate text-base font-bold font-headline">{currentRoomName}</h1>
                <p className="text-xs text-muted-foreground">ID: {roomId}</p>
            </div>
        </div>

        <div className="flex items-center gap-1">
            <Button variant="ghost" className="md:hidden hover:bg-card hover:text-foreground dark:hover:bg-secondary" size="icon" onClick={() => setIsUsersSheetOpen(true)}>
                <Users className="h-5 w-5" />
                <span className="sr-only">Show users</span>
            </Button>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-card hover:text-foreground dark:hover:bg-secondary" onClick={handleCopyLink}>
                            <Link className="h-5 w-5" />
                            <span className="sr-only">Copy Room Link</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy Room Link</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-card hover:text-foreground dark:hover:bg-secondary" onClick={handleCopyId}>
                            <KeyRound className="h-5 w-5" />
                            <span className="sr-only">Copy Room ID</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy Room ID</p>
                    </TooltipContent>
                </Tooltip>

                {isCreator && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="hover:bg-card hover:text-foreground dark:hover:bg-secondary" onClick={() => setShowClearConfirm(true)}>
                                    <Eraser className="h-5 w-5" />
                                    <span className="sr-only">Clear History</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Clear History</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setShowDeleteConfirm(true)} className="text-destructive hover:text-destructive focus:text-destructive/90 hover:bg-destructive/10">
                                    <Trash2 className="h-5 w-5" />
                                    <span className="sr-only">Delete Room</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Delete Room</p>
                            </TooltipContent>
                        </Tooltip>
                    </>
                )}
            </TooltipProvider>
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="hover:bg-card hover:text-foreground dark:hover:bg-secondary">
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">More Options</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                     {isCreator && <DropdownMenuItem onSelect={() => { setNewRoomNameInput(currentRoomName); setIsRenameRoomModalOpen(true); }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Rename Room</span>
                    </DropdownMenuItem>}
                    <DropdownMenuItem onSelect={openChangeNameModal}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Change Name</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-row">
            <Card className="hidden md:flex md:flex-col w-64 border-0 md:border-r rounded-none shrink-0">
                <CardHeader className="h-14 flex-row items-center border-b p-4">
                    <CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5" /> Online ({users.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                   <UserList users={users} username={username} creatorId={creatorId} onUserTag={handleUserTag} onOpenChangeName={openChangeNameModal} />
                </CardContent>
            </Card>

            <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-100">
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
                              ? 'rounded-br-none bg-user-message text-user-message-foreground'
                              : 'rounded-bl-none bg-secondary text-secondary-foreground'
                          }`}
                        >
                            {msg.type === 'user' && msg.user !== username && <p className="text-xs font-bold text-secondary-foreground">{msg.user}</p>}
                            
                            {msg.attachment?.type.startsWith('image/') ? (
                                <div className="relative my-2 group/attachment">
                                    <img src={msg.attachment.data} alt={msg.attachment.name} className="max-w-full max-h-48 rounded-md" />
                                    <a href={msg.attachment.data} download={msg.attachment.name} className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover/attachment:bg-opacity-50 transition-all duration-300 opacity-0 group-hover/attachment:opacity-100 rounded-md cursor-pointer">
                                        <Download className="h-8 w-8 text-white" />
                                        <span className="sr-only">Download Image</span>
                                    </a>
                                </div>
                            ) : msg.attachment ? (
                                <a href={msg.attachment.data} download={msg.attachment.name} className="flex items-center gap-2 my-2 p-2 rounded-md bg-background/20 hover:bg-background/40">
                                    <FileText className="h-6 w-6" />
                                    <span className="truncate">{msg.attachment.name}</span>
                                </a>
                            ) : null}
                            
                            {msg.text && <p className="text-base whitespace-pre-wrap break-words">{msg.text}</p>}
                            <p className={`text-xs opacity-70 ${msg.user === username ? 'text-user-message-foreground/70' : 'text-secondary-foreground/70 text-left'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
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
                    {attachment && (
                      <div className="mb-2 flex items-center gap-2 rounded-md border bg-card p-2">
                        {attachment.type.startsWith('image/') ? (
                            <img src={attachment.data} alt="Preview" className="h-12 w-12 rounded-md object-cover" />
                        ): (
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{attachment.name}</p>
                          <p className="text-xs text-muted-foreground">{ (attachment.data.length / 1024).toFixed(2) } KB</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAttachment(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <Button type="button" variant="ghost" size="icon" onClick={handleAttachmentClick}>
                        <Paperclip className="h-5 w-5" />
                        <span className="sr-only">Attach file</span>
                    </Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="ghost" size="icon">
                                <Smile className="h-5 w-5" />
                                <span className="sr-only">Add emoji</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-0">
                            <EmojiPicker
                                onEmojiClick={(emoji) => setInput(input + emoji.emoji)}
                                theme={EmojiTheme.AUTO}
                            />
                        </PopoverContent>
                    </Popover>
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-card"
                      autoComplete="off"
                    />
                    <Button type="submit" size="icon" disabled={!input.trim() && !attachment}>
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
            </div>
        </div>
      </main>

      <Sheet open={isUsersSheetOpen} onOpenChange={setIsUsersSheetOpen}>
        <SheetContent side="left" className="p-0 flex flex-col bg-card">
            <SheetHeader className="h-14 flex-row items-center border-b p-4">
                <SheetTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" /> Online ({users.length})
                </SheetTitle>
            </SheetHeader>
            <CardContent className="flex-1 p-2 overflow-y-auto">
                <UserList users={users} username={username} creatorId={creatorId} onUserTag={(name) => {
                    handleUserTag(name);
                    setIsUsersSheetOpen(false);
                }} onOpenChangeName={() => {
                    openChangeNameModal();
                    setIsUsersSheetOpen(false);
                }} />
            </CardContent>
        </SheetContent>
      </Sheet>

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

      <Dialog open={isRenameRoomModalOpen} onOpenChange={setIsRenameRoomModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Room</DialogTitle>
            <DialogDescription>
              Enter a new name for this room. This will be visible to everyone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameRoom}>
            <div className="py-4">
              <Input
                id="new-room-name"
                value={newRoomNameInput}
                onChange={(e) => setNewRoomNameInput(e.target.value)}
                placeholder="New room name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsRenameRoomModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
