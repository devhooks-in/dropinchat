import ChatRoom from '@/components/chat-room';

type ChatPageProps = {
  params: {
    roomId: string;
  };
  searchParams: {
    name?: string;
    create?: string;
  };
};

export const dynamic = 'force-dynamic';

export default function ChatPage({ params, searchParams }: ChatPageProps) {
  const isCreating = searchParams.create === 'true';
  return <ChatRoom roomId={params.roomId} roomName={searchParams.name} isCreating={isCreating} />;
}
