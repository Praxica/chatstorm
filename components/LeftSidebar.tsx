'use client'

import { usePathname, useRouter } from 'next/navigation'
import ConfigRoundEdit from './ConfigRoundEdit'
import ChatProgress from './ChatProgress'

export default function LeftSidebar() {
  const pathname = usePathname() ?? ''
  const router = useRouter()

  // Extract the configId ID from the pathname
  const configId = pathname.split('/')[2]

  // Check if we're on the config route
  const isConfiguring = pathname.endsWith('/edit')

  return (
    <div className="w-72 bg-white border-r border-gray-200">
      {isConfiguring ? (
        <ConfigRoundEdit configId={configId} onBack={() => router.push(`/config/${configId}/preview`)} />
      ) : (
        <ChatProgress configId={configId} onEditClick={() => router.push(`/config/${configId}/edit`)} />
      )}
    </div>
  )
}