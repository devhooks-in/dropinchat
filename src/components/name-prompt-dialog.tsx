'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface NamePromptDialogProps {
  isOpen: boolean;
  onNameSubmit: (name: string) => void;
}

export default function NamePromptDialog({ isOpen, onNameSubmit }: NamePromptDialogProps) {
  const [name, setName] = useState('');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name.trim().length > 2) {
      onNameSubmit(name.trim());
    } else {
        toast({
            title: "Invalid Name",
            description: "Your name must be at least 3 characters long.",
            variant: "destructive",
        });
    }
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to TempTalk</DialogTitle>
          <DialogDescription>Please enter your name to join the chat.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <Input
              id="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit">Join Chat</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
