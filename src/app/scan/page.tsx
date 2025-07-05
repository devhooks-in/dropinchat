'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const QR_READER_ID = 'qr-reader';

export default function ScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isNavigating = useRef(false);

  useEffect(() => {
    const storedName = localStorage.getItem('dropinchat-username');
    if (!storedName || storedName.trim().length < 3) {
      toast({
        title: 'Set Your Name First',
        description: 'Please set your name on the home page before scanning.',
        variant: 'destructive',
      });
      router.replace('/');
      return;
    }

    if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(QR_READER_ID, {
            verbose: false
        });
    }
    const scanner = scannerRef.current;

    const successCallback = (decodedText: string) => {
        if(scanner.isScanning && !isNavigating.current) {
            isNavigating.current = true;
            setScanResult(decodedText);

            const match = decodedText.match(/\/chat\/([a-zA-Z0-9]+)/);
            if (match && match[1]) {
                const roomId = match[1];
                router.push(`/chat/${roomId}`);
            } else {
                setError('Invalid QR code. Please scan a valid DropInChat room QR code.');
                toast({
                    title: 'Invalid QR Code',
                    description: 'This QR code does not link to a valid chat room.',
                    variant: 'destructive',
                });
                isNavigating.current = false;
                setScanResult(null);
            }
        }
    };

    const errorCallback = (errorMessage: string) => {
        if (errorMessage.includes('Permission denied')) {
            setError('Camera permission denied. Please enable camera access in your browser settings.');
            setIsLoading(false);
        }
    };

    const config = {
      fps: 10,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrboxSize = Math.floor(minEdge * 0.8);
        return {
            width: qrboxSize,
            height: qrboxSize,
        };
      },
      rememberLastUsedCamera: true,
    };

    if (!scanner.isScanning) {
        scanner.start({ facingMode: 'environment' }, config, successCallback, errorCallback)
          .then(() => setIsLoading(false))
          .catch((err) => {
              setError('Could not start camera. Please ensure it is not in use and permissions are granted.');
              setIsLoading(false);
          });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => {
            console.error("Error stopping QR scanner on cleanup:", err);
        });
      }
    };
  }, [router, toast]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg animate-fade-in">
        <CardHeader>
          <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/')}>
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Go Back</span>
              </Button>
              <div>
                <CardTitle>Scan QR Code</CardTitle>
                <CardDescription>Point your camera at a room's QR code to join.</CardDescription>
              </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="relative aspect-square w-full rounded-md overflow-hidden border">
                <div id={QR_READER_ID} className="w-full h-full" />
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="mt-2 text-sm text-muted-foreground">Starting camera...</p>
                    </div>
                )}
                {scanResult && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="mt-2 text-sm text-muted-foreground">Joining room...</p>
                    </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
