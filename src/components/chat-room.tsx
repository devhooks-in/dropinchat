
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
import { Send, Users, ArrowLeft, MoreVertical, Eraser, Trash2, Pencil, Hash, Link, Paperclip, X, FileText, Download, Share2, Loader2, QrCode, Mic, Square, Play, Maximize, Pause } from 'lucide-react';
import NamePromptDialog from './name-prompt-dialog';
import UserList from './user-list';
import { useToast } from '@/hooks/use-toast';
import { QRCodeCanvas } from 'qrcode.react';
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
  DialogClose,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

const linkify = (text: string) => {
  if (!text) return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function ChatRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState(roomId);
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
  const [canShare, setCanShare] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAttachingFile, setIsAttachingFile] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [roomUrl, setRoomUrl] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Media preview state
  const [previewMedia, setPreviewMedia] = useState<{ name: string; type: string; data: string } | null>(null);

  // Custom audio player state
  const [playingAudio, setPlayingAudio] = useState<string | null>(null); // Stores the ID of the playing audio
  const audioRefs = useRef<Map<string, HTMLAudioElement | null>>(new Map());

  const handlePlayPause = (id: string) => {
    const audioEl = audioRefs.current.get(id);
    if (!audioEl) return;
  
    // If another audio is playing, pause it first
    if (playingAudio && playingAudio !== id) {
      const currentPlayingEl = audioRefs.current.get(playingAudio);
      if (currentPlayingEl) {
        currentPlayingEl.pause();
      }
    }
  
    // Toggle play/pause for the clicked audio
    if (playingAudio === id) {
      audioEl.pause();
      setPlayingAudio(null);
    } else {
      audioEl.play().catch(e => console.error("Audio play failed", e));
      setPlayingAudio(id);
    }
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  const playNotificationSound = useCallback(() => {
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
            return;
        }
      }
      
      const audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state !== 'running') {
        const resumeAudio = () => {
          audioContext?.resume().then(() => {
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
          });
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('touchstart', resumeAudio);
        if (audioContext.state !== 'running') return;
      }

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
    if (typeof navigator !== 'undefined' && navigator.share) {
      setCanShare(true);
    }
    setRoomUrl(window.location.href);
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
  }, []);
  
  // Main socket connection and static listeners
  useEffect(() => {
    fetch('/api/socket');

    const socket = io({ 
      transports: ['websocket'],
      auth: { roomCreationInfo: sessionStorage.getItem('roomCreationInfo') } 
    });
    socketRef.current = socket;

    socket.on('user-list-update', (updatedUsers: User[]) => {
      setUsers(updatedUsers);
    });
    
    socket.on('disconnect', () => {
      toast({ title: 'Disconnected', description: 'You have been disconnected from the server.' });
    });

    socket.on('history-cleared', (clearedMessages: Message[]) => {
      setMessages(clearedMessages);
      setIsClearing(false);
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      audioContextRef.current?.close();
      socket.disconnect();
    };
  }, [router, toast, roomId]);
  
  // New message listener
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    const handleNewMessage = (message: Message) => {
        setMessages(prev => [...prev, message]);
        if (document.hidden && message.user !== username && message.type === 'user') {
            playNotificationSound();
        }
    };

    socket.on('new-message', handleNewMessage);

    return () => {
        socket.off('new-message', handleNewMessage);
    };
  }, [username, playNotificationSound]);

  // Join room effect
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && username && !hasJoined.current) {
      hasJoined.current = true;

      socket.emit('join-room', {
        roomId, 
        username,
      }, (response: { success: boolean, roomState?: any, error?: string }) => {
        if (response.success) {
            const data = response.roomState;
            setMessages(data.messages);
            setUsers(data.users);
            setCreatorId(data.creatorId);
            setIsCreator(data.creatorId === socket.id);
            setCurrentRoomName(data.roomName);
            setIsLoading(false);
            scrollToBottom();
            sessionStorage.removeItem('roomCreationInfo');
        } else {
            router.push('/?error=room_not_found');
        }
      });
    }
  }, [roomId, username, scrollToBottom, router]);
  
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
      if(playingAudio === 'preview') {
        const audioEl = audioRefs.current.get('preview');
        if (audioEl) audioEl.pause();
        setPlayingAudio(null);
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl);
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
  
  const handleShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: `Join: ${currentRoomName}`,
                text: `Join me in the chat room "${currentRoomName}": ${roomUrl}`,
                url: roomUrl,
            });
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') {
                return;
            }
            console.error('Error sharing:', error);
            toast({
                title: 'Could not share',
                description: 'An error occurred while trying to share the room link.',
                variant: 'destructive',
            });
        }
    }
  };

  const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

  const handleClearHistory = () => {
    if(isClearing) return;
    setIsClearing(true);
    socketRef.current?.emit('clear-history', roomId);
    setShowClearConfirm(false);
  };

  const handleDeleteRoom = () => {
    if(isDeleting) return;
    setIsDeleting(true);
    socketRef.current?.emit('delete-room', roomId);
  };

  const handleRenameRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomNameInput.trim() && isCreator && !isRenaming) {
        setIsRenaming(true);
        socketRef.current?.emit('update-room-name', roomId, newRoomNameInput.trim());
        setIsRenameRoomModalOpen(false);
        setNewRoomNameInput('');
        setIsRenaming(false);
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
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 25MB.',
          variant: 'destructive'
        });
        return;
      }
      const reader = new FileReader();
      setIsAttachingFile(true);
      reader.onload = (loadEvent) => {
        setAttachment({
          name: file.name,
          type: file.type,
          data: loadEvent.target?.result as string,
        });
        setIsAttachingFile(false);
      };
      reader.onerror = () => {
        toast({ title: 'Error reading file', variant: 'destructive'});
        setIsAttachingFile(false);
      }
      reader.readAsDataURL(file);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      // onstop handler will handle the rest
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          setAttachment({
            name: `recording-${Date.now()}.webm`,
            type: 'audio/webm',
            data: base64Data,
          });
        };
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
      });

      mediaRecorder.start();
      setIsRecording(true);
      setAttachment(null); // Clear any other selected attachment
      setInput(''); // Clear text input
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast({
        title: 'Microphone Error',
        description: 'Could not access your microphone. Please check permissions.',
        variant: 'destructive',
      });
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
                <span className="sr-only">Go Back</span>
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
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="hover:bg-card hover:text-foreground dark:hover:bg-secondary">
                        <Share2 className="h-5 w-5" />
                        <span className="sr-only">Share</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {canShare && (
                        <DropdownMenuItem onSelect={handleShare}>
                            <Share2 className="mr-2 h-4 w-4" />
                            <span>Share via...</span>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={handleCopyLink}>
                        <Link className="mr-2 h-4 w-4" />
                        <span>Copy Room Link</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleCopyId}>
                        <Hash className="mr-2 h-4 w-4" />
                        <span>Copy Room ID</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsQrModalOpen(true)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        <span>Show QR Code</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            
            <TooltipProvider>
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
              {isLoading ? (
                <div className="flex-1 p-4 space-y-6 animate-pulse">
                  <div className="flex items-end gap-2 justify-start">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-12 w-48" />
                    </div>
                  </div>
                  <div className="flex items-end gap-2 justify-end">
                    <div className="flex flex-col gap-2 items-end">
                      <Skeleton className="h-16 w-40" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                   <div className="flex items-end gap-2 justify-start">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                  </div>
                </div>
              ) : (
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 animate-fade-in-up ${
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
                              ? 'text-center text-[11px] text-muted-foreground italic'
                              : msg.user === username
                              ? 'rounded-br-none bg-user-message text-user-message-foreground'
                              : 'rounded-bl-none bg-secondary text-secondary-foreground'
                          }`}
                        >
                            {msg.type === 'user' && msg.user !== username && <p className="text-xs font-bold text-secondary-foreground">{msg.user}</p>}
                            
                            {msg.attachment?.type.startsWith('image/') ? (
                                <div className="relative my-2 group/attachment cursor-pointer" onClick={() => setPreviewMedia(msg.attachment!)}>
                                    <img src={msg.attachment.data} alt={msg.attachment.name} className="max-w-full max-h-48 rounded-md" />
                                     <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover/attachment:bg-opacity-50 transition-all duration-300 opacity-0 group-hover/attachment:opacity-100 rounded-md">
                                        <Maximize className="h-8 w-8 text-white" />
                                    </div>
                                </div>
                            ) : msg.attachment?.type.startsWith('video/') ? (
                                <div className="relative my-2 group/attachment cursor-pointer bg-black rounded-md" onClick={() => setPreviewMedia(msg.attachment!)}>
                                    <video src={msg.attachment.data} className="max-w-full max-h-48 rounded-md opacity-70" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Play className="h-10 w-10 text-white opacity-80" />
                                    </div>
                                </div>
                            ) : msg.attachment?.type.startsWith('audio/') ? (
                                <div className="my-2 flex items-center gap-2">
                                  <audio
                                    src={msg.attachment.data}
                                    ref={(el) => audioRefs.current.set(msg.id, el)}
                                    onEnded={() => setPlayingAudio(null)}
                                    onPause={() => {
                                      if (playingAudio === msg.id) setPlayingAudio(null);
                                    }}
                                    preload="metadata"
                                  />
                                  <Button size="icon" variant="ghost" className="h-10 w-10 flex-shrink-0" onClick={() => handlePlayPause(msg.id)}>
                                    {playingAudio === msg.id ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                  </Button>
                                  <div className="text-sm min-w-0">
                                    <p className="truncate font-medium">{msg.attachment.name}</p>
                                    <p className="text-xs text-muted-foreground">Audio message</p>
                                  </div>
                                </div>
                            ) : msg.attachment ? (
                                <a href={msg.attachment.data} download={msg.attachment.name} className="grid grid-cols-[auto_1fr] items-center gap-2 my-2 p-2 rounded-md bg-background/20 hover:bg-background/40">
                                    <FileText className="h-6 w-6 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="truncate">{msg.attachment.name}</p>
                                    </div>
                                </a>
                            ) : null}
                            
                            {msg.text && <p className={`whitespace-pre-wrap break-words ${msg.type === 'user' ? 'text-sm' : ''}`}>{linkify(msg.text)}</p>}
                            <p className={`opacity-70 ${msg.type === 'system' ? 'text-[10px]' : `text-[11px] ${msg.user === username ? 'text-user-message-foreground/70' : 'text-secondary-foreground/70 text-left'}`}`}>{isClient ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null}</p>
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
              )}

                <div className="border-t p-4 bg-background">
                    {attachment && (
                        <div className="relative mb-2">
                          {attachment.type.startsWith('audio/') ? (
                            <div className="flex flex-col gap-2 rounded-md border bg-card p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Mic className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-grow min-w-0">
                                    <p className="truncate text-sm font-medium">{attachment.name}</p>
                                    <p className="text-xs text-muted-foreground">{ (attachment.data.length / 1024).toFixed(2) } KB</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setAttachment(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 border-t pt-2 mt-1">
                                <audio
                                  src={attachment.data}
                                  ref={(el) => audioRefs.current.set('preview', el)}
                                  onEnded={() => setPlayingAudio(null)}
                                  onPause={() => {
                                      if (playingAudio === 'preview') setPlayingAudio(null);
                                  }}
                                  preload="metadata"
                                />
                                <Button size="icon" variant="ghost" className="h-10 w-10 flex-shrink-0" onClick={() => handlePlayPause('preview')}>
                                  {playingAudio === 'preview' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                </Button>
                                <p className="text-sm text-muted-foreground">Preview</p>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border bg-card p-2">
                              {attachment.type.startsWith('image/') ? (
                                  <img src={attachment.data} alt="Preview" className="h-12 w-12 rounded-md object-cover flex-shrink-0" />
                              ) : attachment.type.startsWith('video/') ? (
                                  <video src={attachment.data} className="h-12 w-12 rounded-md object-cover flex-shrink-0 bg-black" />
                              ): (
                                  <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{attachment.name}</p>
                                <p className="text-xs text-muted-foreground">{ (attachment.data.length / 1024).toFixed(2) } KB</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setAttachment(null)}>
                                  <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {(isAttachingFile || isRecording) && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/80">
                              <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                          )}
                        </div>
                    )}
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*,application/pdf" />
                    <Button type="button" variant="ghost" size="icon" onClick={handleAttachmentClick} disabled={isRecording}>
                        <Paperclip className="h-5 w-5" />
                        <span className="sr-only">Attach file</span>
                    </Button>
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isRecording ? "Recording audio..." : "Type a message..."}
                      className="flex-1 bg-white"
                      autoComplete="off"
                      disabled={isRecording}
                    />
                     <Button type="button" variant={isRecording ? "destructive" : "ghost"} size="icon" onClick={handleToggleRecording}>
                      {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      <span className="sr-only">{isRecording ? "Stop Recording" : "Record Audio"}</span>
                    </Button>
                    <Button type="submit" size="icon" disabled={(!input.trim() && !attachment) || isRecording}>
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

      <AlertDialog open={showClearConfirm} onOpenChange={(open) => {setShowClearConfirm(open); if(!open) setIsClearing(false);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear the entire chat history for everyone in this room. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} disabled={isClearing}>
              {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => {setShowDeleteConfirm(open); if(!open) setIsDeleting(false);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat room and all its messages. All users will be disconnected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRoom} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isRenameRoomModalOpen} onOpenChange={(open) => {setIsRenameRoomModalOpen(open); if(!open) setIsRenaming(false);}}>
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
              <Button type="submit" disabled={isRenaming}>
                {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Scan to Join Room</DialogTitle>
            <DialogDescription>
              Others can scan this code to join the chat.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 bg-white rounded-md">
            {roomUrl ? (
              <QRCodeCanvas
                value={roomUrl}
                size={220}
                level={"H"}
              />
            ) : (
              <Skeleton className="h-[220px] w-[220px]" />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!previewMedia} onOpenChange={(open) => !open && setPreviewMedia(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-1 bg-transparent border-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Media Preview: {previewMedia?.name}</DialogTitle>
            <DialogDescription>A larger view of the shared media. You can download it from here.</DialogDescription>
          </DialogHeader>
          {previewMedia?.type.startsWith('image/') && (
              <img src={previewMedia.data} alt={previewMedia.name} className="max-w-full max-h-[90vh] object-contain mx-auto rounded-lg" />
          )}
          {previewMedia?.type.startsWith('video/') && (
              <video src={previewMedia.data} controls autoPlay className="w-full max-h-[90vh] object-contain mx-auto rounded-lg" />
          )}
          <DialogFooter className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <Button asChild>
              <a href={previewMedia?.data} download={previewMedia?.name}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
