'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import IconPicker from '@/components/IconPicker';
import * as LucideIcons from 'lucide-react';
import { Building2 } from 'lucide-react';

export interface SpaceFormData {
  name: string;
  slug?: string;
  description: string;
  badgeIcon: string;
}

interface SpaceFormFieldsProps {
  formData: SpaceFormData;
  onChange: (field: string, value: any) => void;
  showSlugField?: boolean;
  slugEditable?: boolean;
  existingSlug?: string; // For showing non-editable slug in settings
}

export function SpaceFormFields({ 
  formData, 
  onChange, 
  showSlugField = false,
  slugEditable = true,
  existingSlug
}: SpaceFormFieldsProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Helper function to render the selected icon
  const renderSelectedIcon = (iconName: string) => {
    if (!iconName) return <Building2 className="h-5 w-5" />;
    
    const IconComponent = (LucideIcons as any)[iconName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('').replace(/[^a-zA-Z0-9]/g, '')];
    
    return IconComponent ? <IconComponent className="h-5 w-5" /> : <Building2 className="h-5 w-5" />;
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    onChange('name', newName);
    
    // Auto-generate slug from name if slug field is shown and editable
    if (showSlugField && slugEditable && formData.slug !== undefined) {
      onChange('slug', generateSlug(newName));
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-semibold mb-2">Space Name *</label>
          <input
            type="text"
            className="w-full p-2 border rounded-md"
            value={formData.name}
            onChange={handleNameChange}
            placeholder="Enter space name"
            required
          />
        </div>

        {(showSlugField || existingSlug) && (
          <div>
            <label className="block text-sm font-semibold mb-2">Space URL</label>
            {existingSlug ? (
              <>
                <input
                  type="text"
                  className="w-full p-2 border rounded-md bg-muted"
                  value={`/spaces/${existingSlug}`}
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">This URL cannot be changed</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/spaces/</span>
                  <input
                    type="text"
                    className={`flex-1 p-2 border rounded-md ${!slugEditable ? 'bg-muted' : ''}`}
                    value={formData.slug || ''}
                    onChange={(e) => onChange('slug', e.target.value)}
                    disabled={!slugEditable}
                    placeholder="space-url"
                    pattern="[a-z0-9-]+"
                    title="Only lowercase letters, numbers, and hyphens are allowed"
                    required
                  />
                </div>
                {slugEditable && (
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be your space&apos;s permanent URL. Choose carefully!
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-2">Description</label>
          <textarea
            className="w-full p-2 border rounded-md"
            rows={4}
            value={formData.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Describe what this space is for..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Badge Icon</label>
          <Button 
            variant="outline" 
            className="w-full flex items-center gap-3 h-16 justify-start"
            onClick={() => setShowIconPicker(true)}
            type="button"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded border border-border">
              {renderSelectedIcon(formData.badgeIcon)}
            </div>
            <div className="text-left">
              <div className="font-medium">
                {formData.badgeIcon ? 
                  formData.badgeIcon.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 
                  'Select Icon'
                }
              </div>
              <div className="text-sm text-muted-foreground">
                Choose an icon to display in space badges
              </div>
            </div>
          </Button>
        </div>

      </div>

      {/* Icon Picker Modal */}
      <IconPicker
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={(iconName) => {
          onChange('badgeIcon', iconName);
        }}
        currentIcon={formData.badgeIcon}
      />
    </>
  );
}