'use client';

import { useState, useEffect } from 'react';
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
  title?: string;
  description?: string;
  initialValue?: string;
}

export default function NamePromptDialog({ 
  isOpen, 
  onNameSubmit, 
  title = "Welcome", 
  description = "Please enter your name.",
  initialValue = ''
}: NamePromptDialogProps) {
  const [name, setName] = useState(initialValue);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setName(initialValue);
    }
  }, [isOpen, initialValue]);

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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
