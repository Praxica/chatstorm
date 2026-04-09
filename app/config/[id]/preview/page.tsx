import { getAuthenticatedUserId } from '@/lib/utils/auth';
import { ChatService } from '@/lib/services/ChatService';
import { redirect } from 'next/navigation';
import ChatUI from '@/components/ChatUI';

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: configId } = await params;

  try {
    const userId = await getAuthenticatedUserId();

    // Get or create the preview chat for this config
    const previewChat = await ChatService.getOrCreatePreviewChat(configId, userId);

    return (
      <div className="h-screen flex flex-col">
        <ChatUI
          configId={configId}
          chatId={previewChat.id}
          mode="preview"
        />
      </div>
    );
  } catch (error) {
    console.error('[PreviewPage] Error:', error);
    // Redirect to config edit if there's an error
    redirect(`/config/${configId}/edit`);
  }
} 