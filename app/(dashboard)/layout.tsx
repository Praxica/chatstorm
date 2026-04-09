"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useDashboardStore, DashboardView } from '@/lib/stores/dashboardStore'
import { NewConfigButton } from "@/components/dashboard/NewConfigButton"
import { ChevronRight } from "lucide-react"
import { useAuth } from "@clerk/nextjs"
import { InitialDataLoader } from '@/components/InitialDataLoader'
import { useSpaceSafe } from '@/lib/contexts/SpaceContext'
import { useSpacesStore } from '@/lib/stores/spacesStore'

const settingsLinks = [
  { name: 'Models', href: '/settings/models' },
  { name: 'Tokens & Plans', href: '/settings/plans' },
  { name: 'Shared Chats', href: '/settings/chats' },
  { name: 'Shared Designs', href: '/settings/designs' },
]

const baseMainLinks: { name: string; value: DashboardView; href: string }[] = [
  { name: 'Designs', value: 'designs', href: '/' },
  { name: 'Templates', value: 'templates', href: '/templates' },
  { name: 'Chats', value: 'chats', href: '/chats' },
]

const spaceMainLinks: { name: string; value: DashboardView; href: string }[] = [
  { name: 'Designs', value: 'designs', href: '/' },
  { name: 'Templates', value: 'templates', href: '/templates' },
  { name: 'Chats', value: 'chats', href: '/chats' },
  { name: 'Tokens & Plans', value: 'tokens', href: '/tokens' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isSignedIn } = useAuth()
  const activeView = useDashboardStore(state => state.activeView)
  const pathname = usePathname()
  const hasSpaces = useSpacesStore(state => state.hasSpaces)
  
  // Get space context to determine if we should hide settings and generate space-aware URLs
  // Safe version won't throw if not in provider
  const spaceContext = useSpaceSafe();
  const isSpaceContext = spaceContext?.isSpaceContext || false;
  const spaceSlug = spaceContext?.space?.slug || '';
  
  
  // Create main links based on context
  let mainLinksWithSpaces;
  
  if (isSpaceContext) {
    // Use space-specific links which include tokens tab
    mainLinksWithSpaces = [...spaceMainLinks];
  } else {
    // Use base links and conditionally add spaces tab
    mainLinksWithSpaces = [...baseMainLinks];
    
    // Only add spaces tab if user has spaces and not in space context
    if (hasSpaces) {
      // Insert spaces after chats (at index 3)
      mainLinksWithSpaces.splice(3, 0, { 
        name: 'Spaces', 
        value: 'spaces' as DashboardView, 
        href: '/spaces' 
      });
    }
  }
  
  // Generate space-aware or regular dashboard links
  const mainLinks = mainLinksWithSpaces.map(link => ({
    ...link,
    href: isSpaceContext 
      ? (link.href === '/' ? `/spaces/${spaceSlug}/dashboard` : `/spaces/${spaceSlug}/dashboard${link.href}`)
      : link.href
  }));

  const isSettingsActive = settingsLinks.some(l => pathname === l.href)

  if (!isSignedIn) {
    return <>{children}</>
  }

  return (
    <InitialDataLoader>
      <div className="flex h-full bg-white text-black">
        {/* Left Sidebar for Navigation */}
        <div className="w-64 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b">
             <NewConfigButton />
          </div>
          <div className="p-4">
            {mainLinks.map((link) => (
              <div className="pb-1" key={link.value}>
                <Link href={link.href} passHref>
                  <Button
                    variant={activeView === link.value && !isSettingsActive ? "secondary" : "ghost"}
                    className="w-full justify-start px-3"
                  >
                    {link.name}
                  </Button>
                </Link>
              </div>
            ))}
            {!isSpaceContext && (
              <Accordion type="single" collapsible className="w-full" defaultValue={isSettingsActive ? 'settings' : undefined}>
                <AccordionItem value="settings" className="border-none">
                  <AccordionTrigger 
                    className={cn(
                      "w-full justify-start hover:no-underline px-3 py-2 rounded-md text-sm font-medium hover:bg-accent",
                      isSettingsActive && "bg-secondary"
                    )}
                  >
                    Settings 
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 mt-1">
                    <div className="pl-4 space-y-1">
                      {settingsLinks.map(link => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={cn(
                            "group flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-gray-900",
                            pathname === link.href && "text-accent-foreground font-semibold"
                          )}
                        >
                          <span>{link.name}</span>
                          <ChevronRight 
                            className={cn(
                                "h-4 w-4 transition-opacity",
                                pathname === link.href 
                                    ? "opacity-100" 
                                    : "text-gray-400 opacity-0 group-hover:opacity-100"
                            )} 
                          />
                        </Link>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </InitialDataLoader>
  )
} 