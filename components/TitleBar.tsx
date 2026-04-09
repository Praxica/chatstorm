"use client"

import { HelpCircle, Settings, ChevronRight } from 'lucide-react'
import { useAppStateStore } from '@/lib/stores/appStateStore'
import Link from "next/link"
import { UserButton, SignedIn, useAuth } from "@clerk/nextjs";
import { usePathname } from 'next/navigation'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from '@/lib/utils'
import { ConfigMenu } from '@/components/config/ConfigMenu'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChatDropdownMenu } from './ChatDropdownMenu'
import Image from "next/image"

// --- Internal Components ---

// Brand Logo Component
const BrandLogo = () => (
  <>
    <Link href="/" className="flex items-center">
      <Image
        src="/logo_icon.svg"
        alt="Chatstorm Logo"
        width={60}
        height={60}
        priority
        className='ml-[-10px] filter brightness-0 invert'
      />
      <div className="flex items-center">
        <span className="font-mono ml-[-8px] tracking-wide text-base font-bold text-gray-100">CHAT</span>
        <span className="font-mono text-base text-gray-100">STO</span>
        <span className="font-mono text-base text-gray-100 ml-[1px]">R</span>
        <span className="font-mono text-base text-gray-100 ml-[3px]">M</span>
      </div>
    </Link>
    <div className="flex items-baseline gap-1 ml-2 pt-1">
      <p className="text-[0.65rem] text-[#f7339a]/75 font-mono">by</p>
      <a 
        href="https://praxica.com" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-[0.8rem] font-mono hover:text-[#f7339a] transition-colors"
      >
        <span className="font-semibold text-[#f7339a]/90">PRAXICA</span><span className="text-[#f7339a]/80 ml-[5px]">LABS</span>
      </a>
    </div>
  </>
);

// Breadcrumb Item Type
interface BreadcrumbItem {
  label: string;
  href?: string;
  isLink?: boolean;
  isSemibold?: boolean;
  truncate?: boolean;
  maxWidthClass?: string; // e.g., "max-w-[150px] md:max-w-[250px]"
}

// Title Breadcrumb Component
const TitleBreadcrumb = ({ items }: { items: BreadcrumbItem[] }) => (
  <div className="flex items-center gap-1 text-base text-white leading-none">
    {items.map((item, index) => (
      <div key={index} className="flex items-center gap-1">
        {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
        {item.isLink && item.href ? (
          <Link href={item.href} className="p-1 text-gray-300 hover:text-white">
            {item.label}
          </Link>
        ) : (
          <span
            className={cn(
              item.isSemibold && "font-semibold",
              item.truncate && "truncate",
              item.maxWidthClass // Apply max-width class if provided
            )}
          >
            {item.label}
          </span>
        )}
      </div>
    ))}
  </div>
);

const settingsLinks = [
  { name: 'Models', href: '/settings/models' },
  { name: 'Tokens & Plans', href: '/settings/plans' },
  { name: 'Shared Chats', href: '/settings/chats' },
  { name: 'Shared Designs', href: '/settings/designs' },
]

// Action Icons Component
const ActionIcons = ({ isShareView }: { isShareView: boolean }) => (
  <div className="flex items-center gap-1 flex-shrink-0">
    <style>{`
      .cl-userButtonPopoverFooter {
        display: none;
      }
    `}</style>

    {!isShareView && (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/help"
                className="p-1 text-gray-300 hover:text-white transition-colors"
              >
                <HelpCircle className="h-5 w-5" />
                <span className="sr-only">Help</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Help & Documentation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 text-gray-300 hover:text-white transition-colors mr-2"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end">
            {settingsLinks.map(link => (
                <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href}>{link.name}</Link>
                </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    )}

    <SignedIn>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8",
                  }
                }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Manage Account</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </SignedIn>
  </div>
);


// --- Main TitleBar Component ---

export function TitleBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isSignedIn } = useAuth();

  const currentView = useAppStateStore(state => state.currentView)
  const config = useAppStateStore(state => state.config)
  const chat = useAppStateStore(state => state.chat)
  const isLoading = useAppStateStore(state => state.isLoadingViewData)

  // Hide title bar on homepage when not logged in
  if (pathname === '/' && !isLoading && currentView === 'dashboard' && !isSignedIn) {
    return null;
  }

  // Treat preview view similar to share view for ActionIcons (minimal icons)
  const isShareOrPreviewView = currentView === 'share' || currentView === 'preview';

  const renderTitleContent = () => {
    if (isLoading && currentView !== 'dashboard' && currentView !== 'loading' && currentView !== 'unknown') {
      return <BrandLogo />;
    }

    switch (currentView) {
      case 'dashboard':
      case 'unknown':
      default:
        return <BrandLogo />;

      case 'designer':
        // Only show brand logo if config is truly unavailable
        // Don't fall back to logo during minor updates/saves
        if (!config?.title) {
          return <BrandLogo />;
        }

        const designerItems: BreadcrumbItem[] = [
          { label: 'Home', href: '/', isLink: true },
          {
            label: config.title,
            isSemibold: true,
            truncate: true,
            maxWidthClass: "max-w-[200px] md:max-w-[300px] lg:max-w-[400px]"
          }
        ];
        return (
          <div className="flex items-center gap-1">
            <TitleBreadcrumb items={designerItems} />
            {config.id && (
                <ConfigMenu
                configId={config.id}
                configTitle={config.title}
                variant="white"
                onConfigUpdate={() => {}}
                onConfigDelete={() => { router.push('/'); }}
                />
            )}
          </div>
        );

      case 'chat':
        if (!config?.title || (!chat?.title && chat?.id !== 'new')) {
          return <BrandLogo />;
        }
        const configTitleForChat = chat?.configTitle || config.title;
        const chatTitle = chat?.title || (chat?.id === 'new' ? 'New Chat' : '');
        const chatItems: BreadcrumbItem[] = [
          {
            label: configTitleForChat,
            truncate: true,
            maxWidthClass: "max-w-[150px] md:max-w-[250px]",
            isLink: true,
            href: `/config/${chat?.configId || config.id}/edit`
          },
          {
            label: chatTitle,
            isSemibold: true,
            truncate: true,
            maxWidthClass: "max-w-[150px] md:max-w-[250px]"
          }
        ];
        return (
          <div className="flex items-center gap-1">
            <TitleBreadcrumb items={chatItems} />
            {chat?.id && chat.id !== 'new' && config?.id && (
              <ChatDropdownMenu
                chatId={chat.id}
                chatTitle={chatTitle}
                configId={config.id} // Pass the actual config ID for the chat
                onRename={async (chatId, newName) => {
                  const response = await fetch(`/api/chats/${config.id}/chat/${chatId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newName }),
                  });
                  if (response.ok) {
                    useAppStateStore.getState().actions.setChat({
                      ...chat,
                      title: newName
                    });
                  }
                }}
                onDelete={async () => {
                  const response = await fetch(`/api/chats/${config.id}/chat/${chat.id}`, {
                    method: 'DELETE',
                  });
                  if (response.ok) {
                    useAppStateStore.getState().actions.setChat({
                      id: 'new',
                      title: 'New Chat',
                      configId: config.id,
                      configTitle: config.title
                    });
                    router.replace(`/chats/${config.id}/chat/new`);
                  }
                }}
              />
            )}
          </div>
        );

      case 'share':
      case 'preview': // Combined share and preview logic for title display
         // For share/preview, AppDataLoader loads the config (which includes its title).
         // The specific chat/template title is set by ShareView/PreviewView via setGlobalChatState.
         // config.title should be the title of the design/configuration.
         // chat.title should be the title of the shared chat or the template title.
         if (!config?.title || (!chat?.title && currentView === 'share')) {
            // If chat.title is not yet available (e.g. PreviewView/ShareView hasn't updated it),
            // config.title (which is DESIGN_TITLE) might be available first from AppDataLoader.
            // chat.title (which would be TEMPLATE_TITLE or SHARED_CHAT_TITLE) comes later.
            // So if chat.title is missing, we might show just the config.title or brandlogo.
            // This console log helps debug what's available.
            if (isLoading) return <BrandLogo />; // Or a specific loading indicator for title section
            // If not loading, and titles are missing, decide on fallback (e.g. config title only or brandlogo)
            if (config?.title && (!chat?.title && currentView === 'share')) { // Only config title is ready
                const items: BreadcrumbItem[] = [
                    { label: config.title, truncate: true, isSemibold: true, maxWidthClass: "max-w-[200px] md:max-w-[300px]" }
                ];
                return <TitleBreadcrumb items={items} />;
            }
            return <BrandLogo />; // Fallback if neither is ready
         }

         if (currentView === 'preview') {
           const previewItems: BreadcrumbItem[] = [
             {
               label: 'Home',
               href: '/',
               isLink: true
             },
             {
               label: config.title, // This should be the Design/Config title
               truncate: true,
               maxWidthClass: "max-w-[200px] md:max-w-[300px]"
              },
             {
               label: 'Preview',
               isSemibold: true,
               truncate: true,
               maxWidthClass: "max-w-[200px] md:max-w-[300px]"
              }
           ];
           return <TitleBreadcrumb items={previewItems} />;
         }

         // For share view, keep existing logic
         const viewItems: BreadcrumbItem[] = [
           {
             label: config.title, // This should be the Design/Config title
             truncate: true,
             maxWidthClass: "max-w-[200px] md:max-w-[300px]"
            },
           {
             label: chat ? chat.title ?? '' : '', // This should be the Shared Chat title (for share), fallback to empty string if undefined
             isSemibold: true,
             truncate: true,
             maxWidthClass: "max-w-[200px] md:max-w-[300px]"
            }
         ];
         return <TitleBreadcrumb items={viewItems} />;
    }
  }

  return (
    <>
      <div className="bg-black text-white py-1.5 px-4 flex items-center justify-between h-11">
        <div className="flex items-center min-w-0 mr-2">
          {renderTitleContent()}
        </div>
        <ActionIcons
          isShareView={isShareOrPreviewView} // Use combined variable
        />
      </div>
    </>
  )
}