import ChatRoom from '@/components/chat-room';

export const dynamic = 'force-dynamic';

export default function ChatPage({ params }: { params: { roomId: string } }) {
  return <ChatRoom roomId={params.roomId} />;
}
