
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, PlusCircle, MessageSquare, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [joinRoomId, setJoinRoomId] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState< 'create' | 'join' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'room_not_found') {
      toast({
        title: "Room Not Found",
        description: "The room you tried to join doesn't exist or has been deleted. Please create a new room or join another one.",
        variant: "destructive",
        duration: 8000,
      });
      router.replace('/', { scroll: false });
    }
    
    const storedName = localStorage.getItem('dropinchat-username');
    if (storedName) {
      setUsername(storedName);
    }
  }, [searchParams, router, toast]);

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
    if (loading || !validateUsername()) return;

    if (!newRoomName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a room name.',
        variant: 'destructive',
      });
      return;
    }
    setLoading('create');
    const newRoomId = Math.random().toString(36).substring(2, 9);
    const creationInfo = {
      roomId: newRoomId,
      roomName: newRoomName.trim(),
      isCreating: true,
    };
    sessionStorage.setItem('roomCreationInfo', JSON.stringify(creationInfo));
    router.push(`/chat/${newRoomId}`);
  };

  const joinRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || !validateUsername()) return;
    
    if (joinRoomId.trim()) {
      setLoading('join');
      router.push(`/chat/${joinRoomId.trim()}`);
    } else {
      toast({
        title: 'Error',
        description: 'Please enter a Room ID.',
        variant: 'destructive',
      });
    }
  };
  
  const isUsernameValid = username.trim().length >= 3;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg animate-fade-in">
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
              className="bg-white"
            />
          </div>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Room</TabsTrigger>
              <TabsTrigger value="join">Join Room</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="pt-4">
               <form onSubmit={createRoom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName">New Room Name</Label>
                  <Input
                    id="roomName"
                    placeholder="Enter a name for your new room"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={!!loading || !isUsernameValid}>
                  {loading === 'create' ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2 h-5 w-5" />
                  )}
                  Create & Join Room
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="join" className="pt-4">
              <form onSubmit={joinRoom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinRoomId">Join with Room ID</Label>
                  <Input
                    id="joinRoomId"
                    placeholder="Enter Room ID"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <Button type="submit" className="w-full" variant="default" size="lg" disabled={!!loading || !isUsernameValid}>
                  {loading === 'join' ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-5 w-5" />
                  )}
                  Join with ID
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>Chat rooms are private. Messages are deleted when the last user leaves.</p>
      </footer>
    </main>
  );
}
