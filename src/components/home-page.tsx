'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, PlusCircle, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

export default function HomePage() {
  const router = useRouter();
  const [joinRoomId, setJoinRoomId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [username, setUsername] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const storedName = localStorage.getItem('dropinchat-username');
    if (storedName) {
      setUsername(storedName);
    }
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setUsername(name);
    if (name.trim()) {
      localStorage.setItem('dropinchat-username', name.trim());
    } else {
      localStorage.removeItem('dropinchat-username');
    }
  };

  const validateUsername = () => {
    if (username.trim().length < 3) {
      toast({
        title: 'Invalid Name',
        description: 'Your name must be at least 3 characters long.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const createRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateUsername()) return;

    if (!newRoomName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a room name.',
        variant: 'destructive',
      });
      return;
    }
    const newRoomId = Math.random().toString(36).substring(2, 9);
    router.push(`/chat/${newRoomId}?name=${encodeURIComponent(newRoomName.trim())}`);
  };

  const joinRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateUsername()) return;
    
    if (joinRoomId.trim()) {
      router.push(`/chat/${joinRoomId.trim()}`);
    } else {
      toast({
        title: 'Error',
        description: 'Please enter a Room ID.',
        variant: 'destructive',
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold font-headline">DropInChat</CardTitle>
          </div>
          <CardDescription>Real-time private chat rooms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="username">Your Name</Label>
            <Input
              id="username"
              placeholder="Enter your name (min. 3 characters)"
              value={username}
              onChange={handleUsernameChange}
              className="bg-card"
            />
          </div>

          <form onSubmit={createRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomName">New Room Name</Label>
              <Input
                id="roomName"
                placeholder="Enter a name for your new room"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="bg-card"
              />
            </div>
            <Button type="submit" className="w-full" size="lg">
              <PlusCircle className="mr-2 h-5 w-5" />
              Create & Join Room
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <form onSubmit={joinRoom} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="joinRoomId">Join an Existing Room</Label>
              <Input
                id="joinRoomId"
                placeholder="Enter Room ID"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="bg-card"
              />
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              <LogIn className="mr-2 h-5 w-5" />
              Join Room
            </Button>
          </form>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>Chat rooms are private. Messages are deleted when the last user leaves.</p>
      </footer>
    </main>
  );
}
