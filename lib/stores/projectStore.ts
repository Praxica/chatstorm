import { create, StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  userId: string
}

interface ProjectStore {
  projects: Project[]
  isLoading: boolean
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'userId'>) => Promise<void>
  updateProject: (id: string, project: Omit<Project, 'id' | 'createdAt' | 'userId'>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  loadProjects: () => Promise<void>
  setProjects: (projects: Project[]) => void
  getProject: (id: string) => Project | undefined
}

type ProjectPersist = (
  config: StateCreator<ProjectStore>,
  options: unknown
) => StateCreator<ProjectStore>

export const useProjectStore = create<ProjectStore>()(
  (persist as ProjectPersist)(
    (set, get) => ({
      projects: [],
      isLoading: true,
      
      loadProjects: async () => {
        try {
          const response = await fetch('/api/projects')
          if (!response.ok) throw new Error('Failed to load projects')
          const projects = await response.json()
          set({ projects, isLoading: false })
        } catch (error) {
          console.error('Failed to load projects:', error)
          set({ projects: [], isLoading: false })
        }
      },
      
      addProject: async (projectData) => {
        try {
          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(projectData),
          })
          
          if (!response.ok) throw new Error('Failed to create project')
          const newProject = await response.json()
          
          set((state) => ({ 
            projects: [...state.projects, newProject] 
          }))
        } catch (error) {
          console.error('Error adding project:', error)
          throw error
        }
      },

      updateProject: async (id, projectData) => {
        try {
          const response = await fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(projectData),
          })
          
          if (!response.ok) throw new Error('Failed to update project')
          const updatedProject = await response.json()
          
          set((state) => ({ 
            projects: state.projects.map(p => p.id === id ? updatedProject : p)
          }))
        } catch (error) {
          console.error('Error updating project:', error)
          throw error
        }
      },

      deleteProject: async (id) => {
        try {
          const response = await fetch(`/api/projects/${id}`, {
            method: 'DELETE',
          })
          
          if (!response.ok) throw new Error('Failed to delete project')
          
          set((state) => ({ 
            projects: state.projects.filter(p => p.id !== id)
          }))
        } catch (error) {
          console.error('Error deleting project:', error)
          throw error
        }
      },

      setProjects: (projects) => set({ projects }),

      getProject: (id) => get().projects.find(project => project.id === id)
    }),
    {
      name: 'projects-storage',
      version: 1,
    }
  )
) 