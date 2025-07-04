'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LogIn, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function HomePage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const { toast } = useToast();

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    router.push(`/chat/${newRoomId}`);
  };

  const joinRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/chat/${roomId.trim()}`);
    } else {
      toast({
        title: "Error",
        description: "Please enter a Room ID.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold font-headline">TempTalk</CardTitle>
          <p className="text-muted-foreground">Ephemeral real-time chat rooms</p>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <Button onClick={createRoom} className="w-full" size="lg">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create a New Chat Room
          </Button>

          <div className="flex items-center space-x-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={joinRoom} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="roomId" className="text-sm font-medium text-foreground">
                Join an Existing Room
              </label>
              <Input
                id="roomId"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
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
        <p>Messages are deleted when the last user leaves a room.</p>
      </footer>
    </main>
  );
}
