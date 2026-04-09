import { useEffect, useState } from 'react'
import { useTemplatesStore } from '@/lib/stores/templatesStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter } from 'next/navigation'
import { Loader2, Search, ChevronRight, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import * as LucideIcons from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSpaceSafe } from '@/lib/contexts/SpaceContext'

interface TemplatesListProps {
  spaceId?: string;
}

export function TemplatesList({ spaceId }: TemplatesListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags] = useState<string[]>([])
  const [isInstalling, setIsInstalling] = useState(false)
  const [installSuccess, setInstallSuccess] = useState<{ success: boolean; configId?: string } | null>(null)
  
  const {
    templates,
    categories,
    isLoading,
    error,
    actions: { fetchTemplates, fetchCategories, installTemplate },
  } = useTemplatesStore()

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Helper function to render space badge icon
  const renderSpaceIcon = (iconName: string | null | undefined) => {
    if (!iconName) return <Building2 className="h-4 w-4 mr-2" />;
    
    const IconComponent = (LucideIcons as any)[iconName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('').replace(/[^a-zA-Z0-9]/g, '')];
    
    return IconComponent ? <IconComponent className="h-4 w-4 mr-2" /> : <Building2 className="h-4 w-4 mr-2" />;
  };

  // Get space context if available (safe - won't throw)
  const spaceContext = useSpaceSafe();
  const space = spaceContext?.space || null;

  useEffect(() => {
    // Only fetch if filters are applied (search, category, tags)
    // Initial load is handled by InitialDataLoader
    if (selectedCategory || search || selectedTags.length > 0) {
      fetchTemplates({
        categoryId: selectedCategory || undefined,
        search: search || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        spaceId: spaceId || undefined,
      })
    }
  }, [fetchTemplates, selectedCategory, search, selectedTags, spaceId])

  const handleInstall = async (templateId: string) => {
    setIsInstalling(true)
    setInstallSuccess(null)
    const result = await installTemplate(templateId, spaceId)
    setIsInstalling(false)
    setInstallSuccess(result)
  }

  const handleEditConfig = () => {
    if (installSuccess?.configId) {
      router.push(`/config/${installSuccess.configId}/edit`)
    }
  }

  const handleCloseModal = () => {
    setInstallSuccess(null)
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with space badge */}
      <div className="flex items-center gap-2 mb-4">
        {space && (
          <>
            <Badge variant="secondary" className="text-xl px-3 py-1 flex items-center">
              {renderSpaceIcon(space.badgeIcon)}
              {space.name}
            </Badge>
            <ChevronRight className="w-5 h-5 text-gray-400 mx-1" />
          </>
        )}
        <h2 className="text-2xl font-semibold">Templates</h2>
      </div>
      
      {/* Search and Filters - Hidden when in space context */}
      {!space && (
        <div className="space-y-3">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "rounded-full px-3",
                      selectedCategory === null
                        ? "bg-black hover:bg-black/90 text-white hover:text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    )}
                    onClick={() => setSelectedCategory(null)}
                  >
                    All
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {templates.length} template{templates.length === 1 ? ' is' : 's are'} available
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {categories.map((category) => (
              <TooltipProvider key={category.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "rounded-full px-3",
                        selectedCategory === category.id
                          ? "bg-black hover:bg-black/90 text-white hover:text-white"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      )}
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {category.name}
                      <span className={cn(
                        "ml-1 text-xs",
                        selectedCategory === category.id ? "text-gray-300" : "text-gray-500"
                      )}>
                        {category._count.templates}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {category._count.templates} template{category._count.templates === 1 ? ' is' : 's are'} categorized by {category.name}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}

      {/* Templates List */}
      <ScrollArea className="h-[calc(100vh-160px)]">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No templates found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 border rounded-lg flex flex-col hover:border-gray-400 transition-colors"
              >
                <div className="flex-grow">
                  <h3 className="font-semibold leading-tight">{template.title}</h3>
                  {template.description && (
                    <p className="text-sm text-gray-500 mt-2">
                      {template.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  {!spaceId && (
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <div>
                        {template.installs} {template.installs === 1 ? 'install' : 'installs'}
                      </div>
                      <div>
                        {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {template.previewChatId && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              className="flex-1 bg-gray-100 hover:bg-gray-200"
                              onClick={() => window.open(`/preview/${template.id}`, '_blank')}
                            >
                              Preview
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Preview a chat from this template
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className={cn("flex-1", template.previewChatId ? "flex-1" : "w-full")}
                            onClick={() => handleInstall(template.id)}
                          >
                            Install
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Add this template to your account
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Installation Modal */}
      <Dialog open={isInstalling || installSuccess !== null} onOpenChange={() => {}}>
        <DialogContent>
          {isInstalling ? (
            <>
              <DialogHeader>
                <DialogTitle>Installing Template</DialogTitle>
                <DialogDescription>
                  Please wait while we set up your new chat design...
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            </>
          ) : installSuccess?.success ? (
            <>
              <DialogHeader>
                <DialogTitle>Template Installed Successfully</DialogTitle>
                <DialogDescription>
                  Your new chat design is ready to use.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={handleCloseModal}>
                  Continue in Dashboard
                </Button>
                <Button onClick={handleEditConfig}>
                  Edit Chat Design
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Installation Failed</DialogTitle>
                <DialogDescription>
                  There was an error installing the template. Please try again.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleCloseModal}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 