'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/hooks/use-toast';
import { SpaceFormFields, SpaceFormData } from '@/components/spaces/SpaceFormFields';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AddSpacePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState<SpaceFormData>({
    name: '',
    slug: '',
    description: '',
    badgeIcon: '',
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Space name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.slug?.trim()) {
      toast({
        title: "Error",
        description: "Space URL is required",
        variant: "destructive",
      });
      return;
    }

    // Validate slug format
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(formData.slug)) {
      toast({
        title: "Error",
        description: "Space URL can only contain lowercase letters, numbers, and hyphens",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/spaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          badgeIcon: formData.badgeIcon || null,
          signupMode: 'approval', // Default for new spaces
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create space');
      }

      const data = await response.json();
      const newSpace = data.space;
      
      toast({
        title: "Success",
        description: "Your space has been created successfully!",
      });
      
      // Redirect to the new space's admin page
      router.push(`/spaces/${newSpace.slug}/admin`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create space. Please try again.",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="container mx-auto max-w-3xl py-8 px-4">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
          
          <h1 className="text-3xl font-bold mb-2">Create a New Space</h1>
          <p className="text-muted-foreground">
            Set up a new space for your team, class, or community. You&apos;ll be able to customize settings and invite members after creation.
          </p>
        </div>

        <form onSubmit={handleCreateSpace} className="bg-white rounded-lg border p-6">
          <SpaceFormFields
            formData={formData}
            onChange={handleInputChange}
            showSlugField={true}
            slugEditable={true}
          />

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !formData.name.trim() || !formData.slug?.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Space...
                </>
              ) : (
                'Create Space'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}