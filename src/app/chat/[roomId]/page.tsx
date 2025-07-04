import ChatRoom from '@/components/chat-room';

type ChatPageProps = {
  params: {
    roomId: string;
  };
  searchParams: {
    name?: string;
  };
};

export default function ChatPage({ params, searchParams }: ChatPageProps) {
  return <ChatRoom roomId={params.roomId} roomName={searchParams.name} />;
}
