import { create } from 'zustand'

interface Template {
  id: string
  title: string
  description?: string
  tags: string[]
  authorId: string
  installs: number
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
  previewChatId?: string
  categoryId?: string
  author: {
    id: string
    email: string
  }
  category?: {
    id: string
    name: string
    description?: string
  }
}

interface TemplateCategory {
  id: string
  name: string
  description?: string
  _count: {
    templates: number
  }
}

interface TemplatesState {
  templates: Template[]
  categories: TemplateCategory[]
  isLoading: boolean
  error: string | null
  actions: {
    setTemplates: (templates: Template[]) => void
    setCategories: (categories: TemplateCategory[]) => void
    setLoading: (isLoading: boolean) => void
    setError: (error: string | null) => void
    fetchTemplates: (params?: { categoryId?: string; search?: string; tags?: string[]; spaceId?: string }) => Promise<void>
    fetchCategories: () => Promise<void>
    installTemplate: (templateId: string, spaceId?: string) => Promise<{ success: boolean; configId?: string }>
  }
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  templates: [],
  categories: [],
  isLoading: true,
  error: null,
  actions: {
    setTemplates: (templates) => set({ templates }),
    setCategories: (categories) => set({ categories }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    
    fetchTemplates: async (params = {}) => {
      const { setLoading, setError, setTemplates } = get().actions
      setLoading(true)
      setError(null)
      
      try {
        const searchParams = new URLSearchParams()
        if (params.categoryId) searchParams.set('categoryId', params.categoryId)
        if (params.search) searchParams.set('search', params.search)
        if (params.tags?.length) searchParams.set('tags', params.tags.join(','))
        if (params.spaceId) searchParams.set('spaceId', params.spaceId)
        
        const response = await fetch(`/api/templates?${searchParams.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch templates')
        
        const templates = await response.json()
        setTemplates(templates)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch templates')
      } finally {
        setLoading(false)
      }
    },
    
    fetchCategories: async () => {
      const { setLoading, setError, setCategories } = get().actions
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch('/api/template-categories')
        if (!response.ok) throw new Error('Failed to fetch categories')
        
        const categories = await response.json()
        setCategories(categories)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch categories')
      } finally {
        setLoading(false)
      }
    },
    
    installTemplate: async (templateId: string, spaceId?: string) => {
      const { setError } = get().actions
      setError(null)
      
      try {
        const response = await fetch(`/api/templates/${templateId}/install`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: spaceId ? JSON.stringify({ spaceId }) : undefined,
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to install template')
        }
        
        return await response.json()
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to install template')
        return { success: false }
      }
    },
  },
})) 