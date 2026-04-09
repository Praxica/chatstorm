import { useRouter } from 'next/navigation'
import { useConfigsStore } from '@/lib/stores/configsStore'
import { useSpaceSafe } from '@/lib/contexts/SpaceContext'
import { v4 as uuidv4 } from 'uuid'
import { DEV_CONFIG_ID } from '@/lib/constants'

export function useCreateConfig() {
  const router = useRouter()
  const addConfig = useConfigsStore((state) => state.addConfig)
  const spaceContext = useSpaceSafe()

  const createConfig = async (title: string, projectIds: string[]) => {
    // Get fresh space context values when the button is clicked
    const isSpaceContext = spaceContext?.isSpaceContext || false
    const spaceId = spaceContext?.space?.id || null

    const configId = uuidv4()

    const newConfig = {
      id: configId,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      title,
      rounds: [],
      userId: DEV_CONFIG_ID,
      projectIds,
      ...(isSpaceContext && spaceId && { spaceId })
    }

    try {
      const response = await fetch('/api/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      })

      if (!response.ok) {
        throw new Error('Failed to create config')
      }

      const savedConfig = await response.json()
      addConfig(savedConfig)

      router.push(`/config/${configId}/edit`)

      return savedConfig
    } catch (error) {
      console.error('Error creating config:', error)
      throw error
    }
  }

  return { createConfig }
}
