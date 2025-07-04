'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function PwaInstaller() {
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(
          (registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          (err) => {
            console.error('ServiceWorker registration failed: ', err);
            toast({
              title: 'PWA Features Failed',
              description: 'Could not install service worker for offline capabilities.',
              variant: 'destructive',
            });
          }
        );
      });
    }
  }, [toast]);

  return null;
}
