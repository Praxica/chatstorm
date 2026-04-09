'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Settings, ExternalLink } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from "@/lib/utils";

interface Space {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'class' | 'company' | 'team' | 'community';
  ownerId: string;
  settings: Record<string, any>;
  memberCount: number;
  userRole: 'owner' | 'admin' | 'member';
  userStatus: 'pending' | 'active' | 'suspended';
  badgeIcon?: string;
}

export function SpacesList() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const response = await fetch('/api/spaces');
        if (response.ok) {
          const data = await response.json();
          setSpaces(data.spaces || []);
        } else {
          throw new Error('Failed to fetch spaces');
        }
      } catch (error) {
        console.error('Error fetching spaces:', error);
        toast({
          title: "Error",
          description: "Failed to load spaces. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpaces();
  }, [toast]);

  const renderSpaceIcon = (iconName?: string) => {
    if (!iconName) {
      return <Building2 className="h-5 w-5" />;
    }
    
    // Convert to PascalCase for Lucide component names
    const pascalCaseIconName = iconName.charAt(0).toUpperCase() + iconName.slice(1).toLowerCase();
    
    const IconComponent = (LucideIcons as any)[pascalCaseIconName];
    if (IconComponent) {
      return <IconComponent className="h-5 w-5" />;
    }
    
    return <Building2 className="h-5 w-5" />;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'member': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const canAdmin = (role: string) => role === 'owner' || role === 'admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Building2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading spaces...</p>
        </div>
      </div>
    );
  }

  if (spaces.length === 0) {
    return null; // This component should only show if there are spaces
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Spaces</h2>
          <p className="text-muted-foreground">
            Spaces you&apos;re a member of
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {spaces.map((space) => (
          <div key={space.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0">
                  <Badge variant="secondary" className="text-xl px-3 py-1 flex items-center gap-2">
                    {renderSpaceIcon(space.badgeIcon)}
                    {space.name}
                  </Badge>
                </div>
                
                <div className="flex-1 min-w-0">
                  {space.description && (
                    <p className="text-sm text-muted-foreground">
                      {space.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs", getRoleColor(space.userRole))}>
                  {space.userRole}
                </Badge>
                
                <Link href={`/spaces/${space.slug}/dashboard`}>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
                
                {canAdmin(space.userRole) && (
                  <Link href={`/spaces/${space.slug}/admin`}>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-1" />
                      Admin
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}