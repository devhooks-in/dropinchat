import ChatRoom from '@/components/chat-room';

type ChatPageProps = {
  params: {
    roomId: string;
  };
};

export default function ChatPage({ params }: ChatPageProps) {
  return <ChatRoom roomId={params.roomId} />;
}
