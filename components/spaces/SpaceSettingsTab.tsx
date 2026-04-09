'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/hooks/use-toast';
import { SpaceFormFields, SpaceFormData } from '@/components/spaces/SpaceFormFields';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SpaceSettingsTabProps {
  space: any;
  templates: any[];
  onSpaceUpdate?: (updatedSpace: any) => void;
}

export default function SpaceSettingsTab({ space, templates, onSpaceUpdate }: SpaceSettingsTabProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('general-info');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfigs, setDeleteConfigs] = useState(false);
  
  // Form state - separate general info from signup settings
  const [generalFormData, setGeneralFormData] = useState<SpaceFormData>({
    name: space.name || '',
    description: space.description || '',
    badgeIcon: space.badgeIcon || '',
  });
  
  const [signupFormData, setSignupFormData] = useState({
    signupMode: space.signupMode || 'approval',
    allowedEmailDomain: space.allowedEmailDomain || '',
    autoInstallTemplates: space.autoInstallTemplates || [],
    joinInstructions: space.joinInstructions || '',
    defaultTokenPlanId: space.defaultTokenPlanId || 'none',
  });
  
  const [tokenPlans, setTokenPlans] = useState<any[]>([]);
  const [loadingTokenPlans, setLoadingTokenPlans] = useState(true);

  useEffect(() => {
    fetchTokenPlans();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.slug]);

  const fetchTokenPlans = async () => {
    try {
      setLoadingTokenPlans(true);
      const response = await fetch(`/api/spaces/${space.slug}/token-plans`);
      if (response.ok) {
        const data = await response.json();
        setTokenPlans(data.tokenPlans || []);
      }
    } catch (error) {
      console.error('Error fetching token plans:', error);
    } finally {
      setLoadingTokenPlans(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGeneralInputChange = (field: string, value: any) => {
    setGeneralFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSignupInputChange = (field: string, value: any) => {
    setSignupFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTemplateToggle = (templateId: string) => {
    setSignupFormData(prev => ({
      ...prev,
      autoInstallTemplates: prev.autoInstallTemplates.includes(templateId)
        ? prev.autoInstallTemplates.filter((id: string) => id !== templateId)
        : [...prev.autoInstallTemplates, templateId]
    }));
  };

  const handleDeleteSpace = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/spaces/${space.slug}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deleteConfigs: deleteConfigs,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete space');
      }

      const successMessage = deleteConfigs 
        ? "Space and all chat designs have been deleted."
        : "Space deleted. Your chat designs have been moved to your personal dashboard.";

      toast({
        title: "Space deleted",
        description: successMessage,
      });

      // Redirect to space creation page - modal stays open with loading until redirect completes
      router.push('/spaces/add');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete space. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/spaces/${space.slug}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...generalFormData,
          ...signupFormData,
          // Normalize multi-domain input: split commas, trim, lowercase, de-dupe, join with commas
          allowedEmailDomain: typeof signupFormData.allowedEmailDomain === 'string'
            ? (() => {
                const tokens = signupFormData.allowedEmailDomain
                  .split(',')
                  .map((d) => d.trim().toLowerCase())
                  .filter((d) => d.length > 0)
                const unique = Array.from(new Set(tokens))
                return unique.join(',')
              })()
            : signupFormData.allowedEmailDomain,
          // Convert "none" back to empty string for API
          defaultTokenPlanId: signupFormData.defaultTokenPlanId === 'none' ? '' : signupFormData.defaultTokenPlanId,
        }),
      });

      if (response.ok) {
        const updatedSpace = await response.json();
        toast({
          title: "Settings Saved",
          description: "Your space settings have been updated successfully.",
        });
        onSpaceUpdate?.(updatedSpace);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="container mx-auto max-w-6xl h-full flex flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Main content */}
          <div className="flex-1 px-8 py-6">
            <div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Space Settings</h2>
                <p className="text-muted-foreground mb-6">
                  Configure your space&apos;s basic information and preferences.
                </p>
              </div>

              <div id="general-info" className="pt-4 border-t mt-8">
                <h3 className="text-lg font-semibold mb-3">General Information</h3>
              </div>

              <SpaceFormFields
                formData={generalFormData}
                onChange={handleGeneralInputChange}
                showSlugField={false}
                existingSlug={space.slug}
              />

              <div id="user-signups" className="pt-6 border-t mt-8">
                <h3 className="text-lg font-semibold mb-3">User Signups</h3>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="block text-sm font-semibold mb-2">Signup Mode</label>
                  <div className="space-y-3">
                    <label className="flex items-start space-x-3">
                      <input
                        type="radio"
                        name="signupMode"
                        value="closed"
                        checked={signupFormData.signupMode === 'closed'}
                        onChange={(e) => handleSignupInputChange('signupMode', e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">Closed</div>
                        <div className="text-sm text-muted-foreground">Login only, no new registrations</div>
                      </div>
                    </label>
                    <label className="flex items-start space-x-3">
                      <input
                        type="radio"
                        name="signupMode"
                        value="open"
                        checked={signupFormData.signupMode === 'open'}
                        onChange={(e) => handleSignupInputChange('signupMode', e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">Open</div>
                        <div className="text-sm text-muted-foreground">Anyone can register and get immediate access</div>
                      </div>
                    </label>
                    <label className="flex items-start space-x-3">
                      <input
                        type="radio"
                        name="signupMode"
                        value="approval"
                        checked={signupFormData.signupMode === 'approval'}
                        onChange={(e) => handleSignupInputChange('signupMode', e.target.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">Approval</div>
                        <div className="text-sm text-muted-foreground">New users need admin approval</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Allowed Email Domain (Optional)</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    placeholder="example.edu"
                    value={signupFormData.allowedEmailDomain}
                    onChange={(e) => handleSignupInputChange('allowedEmailDomain', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Auto-Install Templates</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {templates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No templates available. Create templates in the Templates tab first.
                      </p>
                    ) : (
                      templates.map((template) => (
                        <div key={template.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`template-${template.id}`}
                            checked={signupFormData.autoInstallTemplates.includes(template.id)}
                            onChange={() => handleTemplateToggle(template.id)}
                            className="rounded border-gray-300"
                          />
                          <label 
                            htmlFor={`template-${template.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {template.title}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Default Token Plan</label>
                  <Select
                    value={signupFormData.defaultTokenPlanId}
                    onValueChange={(value) => handleSignupInputChange('defaultTokenPlanId', value)}
                    disabled={loadingTokenPlans}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a default token plan for new members" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default plan</SelectItem>
                      {tokenPlans
                        .filter(plan => plan.isActive)
                        .sort((a, b) => a.tokenLimit - b.tokenLimit)
                        .map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} ({plan.tokenLimit.toLocaleString()} tokens {plan.cadence.toLowerCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    This token plan will be automatically assigned to new members who join the space.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Join Instructions</label>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    rows={4}
                    value={signupFormData.joinInstructions}
                    onChange={(e) => handleSignupInputChange('joinInstructions', e.target.value)}
                    placeholder="Instructions for users joining this space (e.g., 'Welcome to our class! Please complete the orientation before accessing materials.')"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    These instructions will be shown to new users when they join the space.
                  </p>
                </div>
              </div>

              <div id="danger-zone" className="pt-6 border-t mt-8">
                <h3 className="text-lg font-semibold mb-3 text-red-600">Danger Zone</h3>
                <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <h4 className="font-medium text-red-600 mb-2">Delete Space</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Once you delete a space, there is no going back. Please be certain.
                  </p>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      setDeleteConfigs(false); // Reset checkbox when opening modal
                      setShowDeleteDialog(true);
                    }}
                  >
                    Delete This Space
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Table of Contents Sidebar */}
          <div className="w-64 ml-8 py-6">
            <div className="sticky top-6 pl-8 border-l border-border py-6">
              <h4 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                On this page
              </h4>
              <nav className="space-y-2 pl-2">
                <button
                  onClick={() => scrollToSection('general-info')}
                  className={`block w-full text-sm transition-colors text-left whitespace-nowrap ${
                    activeSection === 'general-info'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  General Information
                </button>
                <button
                  onClick={() => scrollToSection('user-signups')}
                  className={`block w-full text-sm transition-colors text-left whitespace-nowrap ${
                    activeSection === 'user-signups'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  User Signups
                </button>
                <button
                  onClick={() => scrollToSection('danger-zone')}
                  className={`block w-full text-sm transition-colors text-left whitespace-nowrap ${
                    activeSection === 'danger-zone'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Danger Zone
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed footer with action buttons */}
      <div className="flex justify-end py-4 px-6 border-t bg-background">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Delete Space Confirmation Modal */}
      <AlertDialog 
        open={showDeleteDialog} 
        onOpenChange={(open) => {
          if (!isDeleting) {
            setShowDeleteDialog(open);
          }
        }}
      >
        <AlertDialogContent className="bg-white border border-gray-400">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Space</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Are you sure you want to delete &quot;{space.name}&quot;? This action cannot be undone.
              </p>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-md">
                <input
                  type="checkbox"
                  id="deleteConfigs"
                  checked={deleteConfigs}
                  onChange={(e) => setDeleteConfigs(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="deleteConfigs" className="text-sm">
                  <div className="font-medium">Also delete Chat Designs</div>
                  <div className="text-muted-foreground">
                    If unchecked, space chat designs will be moved to user dashboards
                  </div>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-gray-200 hover:bg-gray-100 border-gray-300"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-500 disabled:bg-red-400" 
              onClick={handleDeleteSpace}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Space"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}