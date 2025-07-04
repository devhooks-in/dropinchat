import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import PwaInstaller from '@/components/pwa-installer';

export const metadata: Metadata = {
  title: 'TempTalk',
  description: 'Temporary real-time chat rooms.',
  manifest: '/manifest.json',
  applicationName: 'TempTalk',
  appleWebApp: {
    capable: true,
    title: 'TempTalk',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: '#1f2937',
  icons: {
    apple: '/icons/icon-192x192.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
        <PwaInstaller />
      </body>
    </html>
  );
}
