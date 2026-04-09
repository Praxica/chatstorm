'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChatUI from '../../../components/ChatUI'
import LeftSidebar from '../../../components/LeftSidebar'
import RightSidebar from '../../../components/RightSidebar'
import { ConfigDataLoader } from '../../../components/config/ConfigDataLoader'

export default function ChatLayout({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: configId } = React.use(params)
  const router = useRouter()
  const [previewChatId, setPreviewChatId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Only handle navigation to home if no configId
  useEffect(() => {
    if (!configId) {
      router.push('/')
    }
  }, [configId, router])

  // Fetch or create preview chat for this config
  useEffect(() => {
    if (!configId) return

    const fetchPreviewChat = async () => {
      try {
        const response = await fetch(`/api/configs/${configId}/preview-chat`)
        if (!response.ok) {
          throw new Error('Failed to fetch preview chat')
        }
        const data = await response.json()
        setPreviewChatId(data.chatId)
      } catch (error) {
        console.error('[ChatLayout] Failed to fetch preview chat:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreviewChat()
  }, [configId])

  if (!configId) return null

  // Show loading state while fetching preview chat
  if (isLoading) {
    return (
      <ConfigDataLoader configId={configId}>
        <div className="flex h-full w-full overflow-hidden bg-gray-100">
          <LeftSidebar />
          <main className="flex-1 flex flex-col h-full overflow-hidden items-center justify-center">
            <div className="text-gray-500">Loading preview...</div>
          </main>
          <RightSidebar />
        </div>
      </ConfigDataLoader>
    )
  }

  // Show error if preview chat couldn't be loaded
  if (!previewChatId) {
    return (
      <ConfigDataLoader configId={configId}>
        <div className="flex h-full w-full overflow-hidden bg-gray-100">
          <LeftSidebar />
          <main className="flex-1 flex flex-col h-full overflow-hidden items-center justify-center">
            <div className="text-red-500">Failed to load preview chat</div>
          </main>
          <RightSidebar />
        </div>
      </ConfigDataLoader>
    )
  }

  return (
    <ConfigDataLoader configId={configId}>
      <div className="flex h-full w-full overflow-hidden bg-gray-100">
        <LeftSidebar />
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          <ChatUI key={previewChatId} configId={configId} chatId={previewChatId} mode="preview" />
        </main>
        <RightSidebar />
      </div>
    </ConfigDataLoader>
  )
} 