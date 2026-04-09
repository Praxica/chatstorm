'use client'

import { use, useContext, useEffect } from 'react'
import ChatUI from "@/components/ChatUI"
import { ChatMessagesContext } from '@/lib/contexts/ChatMessagesContext'

export default function ChatPage({ 
  params 
}: { 
  params: Promise<{ configId: string; chatId: string }> 
}) {
  const {configId, chatId} = use(params)
  const { setMessages, setScrollToMessageFn } = useContext(ChatMessagesContext)
  
  useEffect(() => {
  }, [configId, chatId]);
  
  return (
    <ChatUI 
      configId={configId} 
      chatId={chatId} 
      mode="user" 
      onMessagesUpdate={setMessages}
      setScrollToMessageFn={setScrollToMessageFn}
    />
  )
}